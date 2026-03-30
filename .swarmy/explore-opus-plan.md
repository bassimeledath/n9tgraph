# ASCII-Guided n9tgraph Rendering: Architecture Plan

## Problem Statement

n9tgraph's Sugiyama layout (`layoutFlow()`) produces "wonky" node positioning — the algorithm struggles with cycle handling, crossing minimization, and aspect ratio control, especially for complex diagrams. LLMs writing `.n9` DSL have no spatial intuition and rely entirely on the layout engine to decide where nodes go.

**Core insight**: LLMs are excellent at spatial reasoning when they can SEE the layout as ASCII. perfect-ascii already provides a JSON→ASCII pipeline with collision-free box placement and connector routing. If the LLM designs the layout in ASCII, n9tgraph can extract those positions and feed them into its existing SVG renderer — getting beautiful themed output with human-guided spatial arrangement.

---

## Current Pipeline (what stays, what changes)

```
CURRENT:
  .n9 DSL → PEG parser → FlowDiagram AST → layoutFlow() [Sugiyama] → FlowLayout → renderFlow() → SVG
                                                ↑ REPLACE THIS

NEW:
  Augmented JSON → ascii-layout.ts [grid-based] → FlowLayout → renderFlow() → SVG
                                                                  ↑ UNCHANGED
```

**Stays exactly as-is**: `renderFlow()`, `shapes.ts`, `theme.ts`, `patterns.ts`, `edges.ts`, `text-measure.ts`, `svg.ts` (the SVG wrapper), all type definitions in `flow-layout.ts` (`FlowLayout`, `PositionedNode`, `PositionedEdge`, etc.)

**Changes**: A new layout module replaces the Sugiyama algorithm. A new input parser replaces the PEG grammar (for this input path). The MCP server gets a new tool.

---

## Design Decision: JSON-First, Not ASCII-Parsing

Two approaches were considered:

| Approach | Mechanism | Pros | Cons |
|---|---|---|---|
| **A: Parse ASCII output** | Run perfect-ascii CLI → parse the character grid to find `+---+` boxes and `---→` connectors | Fully decoupled from perfect-ascii internals | Fragile regex/character parsing; loses all n9tgraph metadata (kind, fill, sublabel); ambiguous connector overlap; requires CLI subprocess |
| **B: Use JSON directly** | LLM generates augmented perfect-ascii JSON; n9tgraph reads the grid + metadata and computes pixel positions | Reliable; preserves all n9tgraph styling metadata; no subprocess needed; trivial grid→pixel mapping | Must replicate perfect-ascii's simple grid-sizing logic (~30 lines) |

**Recommendation: Approach B (JSON-first)**. The ASCII rendering is a human preview feature. The spatial blueprint is the JSON `grid` array — it unambiguously encodes which node is at which row/column. Parsing ASCII art to recover that information is unnecessarily fragile and lossy.

The LLM can still run `perfect-ascii` CLI to preview the layout visually, but n9tgraph consumes the JSON directly.

---

## Augmented JSON Format

The input format is a superset of perfect-ascii's `diagram` mode. Fields that perfect-ascii ignores (marked with `// n9t`) are consumed only by n9tgraph.

```typescript
interface AsciiGuidedInput {
  diagram: {
    title?: string;
    boxes: Array<{
      id: string;                          // Box identifier
      label: string;                       // Display text
      body?: string[];                     // Multi-line body (for codeblocks)
      // ── n9tgraph extensions ──
      kind?: FlowNodeKind;                 // 'service' | 'component' | 'external' | 'actor' | 'datastore' | 'circle' | 'label'  (default: 'component')
      properties?: Properties;             // {fill, sublabel, emphasis, shape, border, badge, color, 'border-style', 'min-width', 'min-height'}
    }>;
    grid: (string | null)[][];             // 2D grid layout — row-major, box IDs or null
    connectors: Array<{
      from: string;                        // Source box ID
      to: string;                          // Target box ID
      label?: string;                      // Edge label text
      // ── n9tgraph extensions ──
      arrow?: FlowEdge['arrow'];           // '-->' | '<--' | '<-->' | '-.->' | '<-.-'  (default: '-->')
      dashed?: boolean;                    // Override dashed from arrow type
      properties?: Properties;             // {color, step}
    }>;
    lanes?: string[];                      // Optional row labels (ignored by n9tgraph, used for ASCII preview)
    // ── n9tgraph extensions ──
    direction?: FlowDirection;             // 'TB' | 'LR'  (default: 'TB')
    theme?: ThemeName;                     // 'default' | 'white'
    spacing?: SpacingPreset;               // 'compact' | 'balanced' | 'spacious'
    subgraphs?: Array<{
      id: string;
      label: string;
      childIds: string[];                  // Box IDs that belong to this subgraph
      properties?: Properties;             // {fill, badge, 'border-style'}
    }>;
    annotations?: Array<{
      text: string;
      near: string;                        // Box ID
      side?: 'top' | 'bottom' | 'left' | 'right';
      properties?: Properties;
    }>;
  };
}
```

**Backwards compatibility**: perfect-ascii CLI ignores unknown fields (`kind`, `properties`, `direction`, etc.). The augmented JSON is valid perfect-ascii input for preview purposes.

### Example

```json
{
  "diagram": {
    "title": "Checkout Flow",
    "direction": "TB",
    "theme": "default",
    "spacing": "balanced",
    "boxes": [
      {"id": "user", "label": "Customer", "kind": "actor"},
      {"id": "web", "label": "Web App", "kind": "component", "properties": {"fill": "dotgrid"}},
      {"id": "api", "label": "API Gateway", "kind": "service", "properties": {"fill": "hero", "sublabel": "main entry"}},
      {"id": "auth", "label": "Auth Service", "kind": "component"},
      {"id": "orders", "label": "Orders", "kind": "component"},
      {"id": "db", "label": "PostgreSQL", "kind": "datastore", "properties": {"fill": "crosshatch"}}
    ],
    "grid": [
      ["user"],
      ["web"],
      ["api"],
      ["auth", null, "orders"],
      [null, "db", null]
    ],
    "connectors": [
      {"from": "user", "to": "web", "label": "browse"},
      {"from": "web", "to": "api", "arrow": "-->", "properties": {"step": "1"}},
      {"from": "api", "to": "auth", "label": "validate", "arrow": "-->"},
      {"from": "api", "to": "orders", "label": "place order", "arrow": "-->"},
      {"from": "auth", "to": "db", "arrow": "-.->" , "label": "read"},
      {"from": "orders", "to": "db", "arrow": "-->", "label": "write"}
    ],
    "subgraphs": [
      {"id": "backend", "label": "Backend Services", "childIds": ["auth", "orders", "db"], "properties": {"fill": "dotgrid", "badge": "PRIVATE"}}
    ]
  }
}
```

This same JSON, piped to `perfect-ascii`, renders a clean ASCII preview. n9tgraph reads it and produces a styled SVG.

---

## New Module: `ascii-layout.ts`

**Location**: `src/layout/ascii-layout.ts`

**Signature**:
```typescript
export function layoutFromGrid(input: AsciiGuidedInput): FlowLayout
```

**Algorithm** (step by step):

### Step 1: Parse and validate the JSON input
- Validate required fields (`boxes`, `grid`, `connectors`)
- Build box lookup map: `Map<string, BoxDef>`
- Verify all grid cell IDs and connector IDs reference existing boxes
- Default `kind` to `'component'`, `arrow` to `'-->'`, `direction` to `'TB'`

### Step 2: Compute node pixel sizes (reuse existing logic)
For each box, compute `{w, h}` in pixels using n9tgraph's existing sizing logic from `text-measure.ts`:

```typescript
// Reuse the same sizing logic as flow-layout.ts lines 305-424
function computeNodeSize(box: BoxDef, spacing: SpacingValues): {w: number, h: number} {
  if (box.kind === 'actor') return { w: ACTOR_W, h: ACTOR_H + labelHeight };
  if (box.kind === 'circle') return { w: CIRCLE_R * 2, h: CIRCLE_R * 2 };
  // Standard node sizing: account for label wrapping, sublabel, min-width/min-height
  const labelLines = wrapLabel(box.label, MAX_NODE_LABEL_CHARS);
  let w = Math.max(MIN_NODE_W, nodeSizeForLabel(box.label) + 16);
  let h = labelLines.length * (fontSizes.nodeLabel * 1.4) + 24;
  if (box.properties?.sublabel) {
    const subLines = wrapLabel(box.properties.sublabel, 34);
    h += subLines.length * (fontSizes.edgeLabel * 1.4) + SUBLABEL_GAP;
  }
  // Apply min-width/min-height overrides
  if (box.properties?.['min-width']) w = Math.max(w, parseInt(box.properties['min-width']));
  if (box.properties?.['min-height']) h = Math.max(h, parseInt(box.properties['min-height']));
  return { w, h };
}
```

### Step 3: Grid→pixel coordinate mapping

The grid defines rows and columns. Each grid cell holds one node (or null). The grid is the spatial blueprint.

```
Grid topology:            Pixel layout:
[A] [B] [C]             ┌─A─┐  ┌─B─┐  ┌─C─┐
[D] [_] [E]             ┌─D─┐         ┌─E─┐
[_] [F] [_]                    ┌─F─┐
```

**Column width**: `colWidths[c] = max pixel width of any node in column c`
**Row height**: `rowHeights[r] = max pixel height of any node in row r`

**Position computation**:
```typescript
const { nodeGap, layerGap, tbLayerGap } = resolveSpacing(input.diagram.spacing);

// For TB direction:
// x-positions: columns are separated by nodeGap
let colX: number[] = [];  // left edge of each column
let x = MARGIN_X;
for (let c = 0; c < numCols; c++) {
  colX[c] = x;
  x += colWidths[c] + nodeGap;
}

// y-positions: rows are separated by tbLayerGap (same as Sugiyama layer gap)
let rowY: number[] = [];  // top edge of each row
let y = MARGIN_TOP + (title ? TITLE_HEIGHT : 0);
for (let r = 0; r < numRows; r++) {
  rowY[r] = y;
  y += rowHeights[r] + tbLayerGap;
}

// Node positions: centered within their grid cell
for each (boxId, row, col):
  node.x = colX[col] + (colWidths[col] - node.w) / 2;
  node.y = rowY[row] + (rowHeights[row] - node.h) / 2;
```

For **LR direction**: swap the axis — columns become layers (horizontal spacing = layerGap), rows become vertical positions (vertical spacing = nodeGap).

### Step 4: Build PositionedNode[]

```typescript
const nodes: PositionedNode[] = boxes.map(box => ({
  id: box.id,
  label: box.label,
  kind: box.kind ?? 'component',
  properties: box.properties ?? {},
  x: computedX[box.id],
  y: computedY[box.id],
  w: computedW[box.id],
  h: computedH[box.id],
}));
```

### Step 5: Build PositionedEdge[]

Edges get `fromPt` and `toPt` set to `{x: 0, y: 0}` — the renderer's `connectionPoint()` function computes actual attachment points on node boundaries. This is the same as the existing Sugiyama pipeline.

```typescript
const edges: PositionedEdge[] = connectors.map(conn => ({
  from: conn.from,
  to: conn.to,
  arrow: conn.arrow ?? '-->',
  label: conn.label,
  dashed: conn.dashed ?? (conn.arrow === '-.->' || conn.arrow === '<-.-'),
  properties: conn.properties,
  fromPt: { x: 0, y: 0 },
  toPt: { x: 0, y: 0 },
}));
```

### Step 6: Build PositionedSubgraph[]

For each subgraph definition, compute the bounding box that encloses all its child nodes:

```typescript
for (const sg of input.diagram.subgraphs ?? []) {
  const childNodes = sg.childIds.map(id => positionedNodeMap.get(id)).filter(Boolean);
  const minX = Math.min(...childNodes.map(n => n.x)) - SUBGRAPH_PAD_X;
  const minY = Math.min(...childNodes.map(n => n.y)) - SUBGRAPH_PAD_TOP;
  const maxX = Math.max(...childNodes.map(n => n.x + n.w)) + SUBGRAPH_PAD_X;
  const maxY = Math.max(...childNodes.map(n => n.y + n.h)) + SUBGRAPH_PAD_BOTTOM;

  subgraphs.push({
    id: sg.id,
    label: sg.label,
    properties: sg.properties ?? {},
    x: minX, y: minY,
    w: maxX - minX, h: maxY - minY,
    childIds: sg.childIds,
  });
}
```

### Step 7: Build PositionedAnnotation[]

Annotations are positioned relative to their `near` node, offset by side:

```typescript
for (const ann of input.diagram.annotations ?? []) {
  const node = positionedNodeMap.get(ann.near);
  const side = ann.side ?? 'right';
  // Offset from node by ~20px on the specified side
  annotations.push({
    text: ann.text,
    x: side === 'right' ? node.x + node.w + 20 : side === 'left' ? node.x - 20 : node.x + node.w / 2,
    y: side === 'top' ? node.y - 20 : side === 'bottom' ? node.y + node.h + 20 : node.y + node.h / 2,
    originX: node.x + node.w / 2,
    originY: node.y + node.h / 2,
    anchorX: node.x + node.w / 2,
    anchorY: node.y + node.h / 2,
    properties: ann.properties,
  });
}
```

### Step 8: Compute canvas dimensions

```typescript
const width = Math.max(...nodes.map(n => n.x + n.w), ...subgraphs.map(s => s.x + s.w)) + MARGIN_X;
const height = Math.max(...nodes.map(n => n.y + n.h), ...subgraphs.map(s => s.y + s.h)) + MARGIN_TOP;

// Compute titleMaxWidth for title wrapping
const titleMaxWidth = width - 2 * MARGIN_X;
```

### Step 9: Return FlowLayout

```typescript
return {
  width, height,
  direction: input.diagram.direction ?? 'TB',
  theme: input.diagram.theme,
  title: input.diagram.title,
  titleMaxWidth,
  nodes,
  edges,
  annotations,
  subgraphs,
  overflows: [],       // Not needed — grid layout doesn't truncate
  codeblocks: [],      // TODO: support if needed
};
```

---

## MCP Server Integration

### New Tool: `n9t.render-ascii`

Add a new MCP tool alongside the existing `n9t.render`:

```typescript
server.tool("n9t.render-ascii", {
  input: z.string().describe("Augmented perfect-ascii JSON (diagram mode with n9tgraph extensions)"),
  format: z.enum(["svg", "png"]).default("svg"),
  scale: z.number().optional().default(2),
}, async ({ input, format, scale }) => {
  // 1. Parse JSON
  const parsed = JSON.parse(input) as AsciiGuidedInput;

  // 2. Layout via grid
  const layout = layoutFromGrid(parsed);

  // 3. Render via existing flow renderer
  const content = renderFlow(layout);
  let svg = wrapSvg(layout, content, parsed.diagram.theme);

  // 4. Optional PNG conversion
  if (format === 'png') {
    const resvg = new Resvg(svg, { fitTo: { mode: 'zoom', value: scale } });
    const png = resvg.render().asPng();
    return { image: png.toString('base64') };
  }

  return { svg, width: layout.width, height: layout.height };
});
```

### Updated Tool: `n9t.grammar`

The grammar tool should include the augmented JSON format reference alongside the existing DSL reference, so LLMs know both input formats exist.

### MCP Tool Selection Guidance

The MCP server description should guide LLMs:
- **`n9t.render`**: Use for quick diagrams where automatic layout is fine
- **`n9t.render-ascii`**: Use when you need precise control over spatial arrangement, or when the automatic layout produces suboptimal results. Design the layout as a perfect-ascii grid, add n9tgraph styling metadata, and get beautiful themed SVG output.

---

## Integration with `svg.ts` (render dispatcher)

The `render()` function in `svg.ts` currently dispatches by `ast.type`. We need a new entry point that bypasses the AST entirely:

```typescript
// New function in svg.ts
export function renderFromGrid(input: AsciiGuidedInput): string {
  const layout = layoutFromGrid(input);
  const content = renderFlow(layout);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}">
${allDefs()}
<rect width="100%" height="100%" fill="${colors.bg}"/>
<g class="diagram">
${content}
</g>
</svg>`;

  if (input.diagram.theme === 'white') {
    svg = applyWhiteTheme(svg);
  }

  return svg;
}
```

---

## File Changes Summary

| File | Change | Lines (est.) |
|---|---|---|
| `src/layout/ascii-layout.ts` | **NEW** — grid-based layout engine | ~200 |
| `src/render/svg.ts` | Add `renderFromGrid()` export | ~15 |
| `src/mcp-server.ts` | Add `n9t.render-ascii` tool | ~80 |
| `src/index.ts` | Export `renderFromGrid` | ~1 |

**No changes to**: `flow-renderer.ts`, `shapes.ts`, `theme.ts`, `patterns.ts`, `edges.ts`, `text-measure.ts`, `grammar.pegjs`, `ast.ts`, `flow-layout.ts`

---

## Risks and Mitigations

### Risk 1: Features hard to derive from grid — Subgraphs
**Severity**: Medium
**Issue**: Subgraphs in the current DSL are containers with nested nodes. In grid layout, nodes are placed individually in cells — subgroups are declared separately.
**Mitigation**: The `subgraphs` array in the augmented JSON explicitly lists `childIds`. The layout computes bounding boxes from those child positions. This is actually simpler and more reliable than the Sugiyama subgraph-aware layout.

### Risk 2: Features hard to derive from grid — Annotations
**Severity**: Low
**Issue**: Annotations need `near` node + `side` placement. The current DSL handles this with `annotation "text" near NODE side right`.
**Mitigation**: The augmented JSON includes `annotations` array with `near` and `side` fields. The annotation positioning code in the new layout module mirrors the existing logic. Easy.

### Risk 3: Features hard to derive from grid — CodeBlocks
**Severity**: Low
**Issue**: CodeBlocks are positioned within the flow layout. They can be treated as boxes in the grid with special rendering.
**Mitigation**: Defer support initially. CodeBlocks are rarely used and can be added later by treating them as special grid cells with `kind: 'codeblock'`. The `body` field in perfect-ascii boxes maps naturally to codeblock content.

### Risk 4: Edge routing quality
**Severity**: Medium
**Issue**: The existing renderer computes `fromPt`/`toPt` connection points and does collision-avoidance routing. With grid layout, nodes are better positioned, so edge routing should be BETTER than Sugiyama (fewer crossings since the human/LLM designed the layout). But edge routing still depends on the renderer's internal logic.
**Mitigation**: No change needed. The renderer's edge routing (`edges.ts`) works on `PositionedNode[]` positions regardless of how they were computed. It handles backward edges, U-shaped routing, obstacle avoidance, and label placement. All of this continues to work.

### Risk 5: Grid cell spanning / merged cells
**Severity**: Low
**Issue**: A node might conceptually span multiple grid columns (e.g., a wide service node above two narrow nodes).
**Mitigation**: Phase 1 does NOT support cell spanning. If a node is wider than its column, the column widens to accommodate it. For Phase 2, add optional `colspan`/`rowspan` on grid cells.

### Risk 6: LR direction support
**Severity**: Medium
**Issue**: The grid is row-major (rows = top-to-bottom). For LR diagrams, rows should map to columns and columns to rows.
**Mitigation**: For LR direction, transpose the interpretation: grid rows become columns (left-to-right layers), grid columns become rows (vertical positions within a layer). The position computation simply swaps axes. The renderer already handles LR/TB via the `direction` field.

### Risk 7: Title word-wrapping and max-width
**Severity**: Low
**Issue**: `titleMaxWidth` is computed from canvas width. Grid layout may produce different canvas widths than Sugiyama.
**Mitigation**: Compute `titleMaxWidth = canvasWidth - 2 * MARGIN_X` after all node positions are finalized. Same formula as existing code.

---

## What the LLM Workflow Looks Like

```
1. LLM receives user's diagram request
2. LLM designs the layout as a perfect-ascii JSON grid
   - Decides which nodes go where on the grid
   - Assigns n9tgraph kinds and styling properties
   - Defines connectors with arrow types and labels
3. (Optional) LLM runs `perfect-ascii` CLI to preview the ASCII layout
   - Confirms spatial arrangement looks right
   - Adjusts grid if needed
4. LLM calls `n9t.render-ascii` with the augmented JSON
5. n9tgraph produces beautiful themed SVG with the LLM's exact spatial arrangement
```

The LLM's spatial reasoning happens in ASCII space (where it excels), and n9tgraph's visual excellence happens in SVG space (where it excels). Best of both worlds.

---

## Phase Plan

### Phase 1: Core grid layout (MVP)
- `ascii-layout.ts` with `layoutFromGrid()`
- Support: nodes (all kinds), edges (all arrow types), subgraphs, title
- MCP tool: `n9t.render-ascii`
- Direction: TB only

### Phase 2: Full feature parity
- LR direction support (axis transposition)
- Annotation positioning
- CodeBlock support (grid cells with `kind: 'codeblock'`)
- Cell spanning (`colspan`)
- Spacing presets applied to grid gaps

### Phase 3: LLM optimization
- Update `n9t.grammar` tool to include grid format reference
- Add grid-specific warnings (overlapping subgraphs, orphan connectors)
- ASCII preview integration (run perfect-ascii CLI from MCP, return both ASCII and SVG)
