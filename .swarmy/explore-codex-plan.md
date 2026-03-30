# ASCII-Guided n9tgraph Rendering Architecture (Research Plan)

## 1) Non-Negotiable Constraint
- Keep `src/render/flow-renderer.ts` styling/visual behavior unchanged.
- New path is: `ASCII (+ metadata) -> parsed FlowLayout-like object -> existing renderFlow()`.
- Do **not** run Sugiyama layout for this path; ASCII is the layout authority.

## 2) Existing n9tgraph Contract To Target

### Flow renderer input contract (what must be produced)
`renderFlow(layout: FlowLayout)` expects:
- `layout.width`, `layout.height`
- `layout.direction` (`LR`/`TB`)
- `layout.theme`, `layout.title`, `layout.titleMaxWidth` (optional)
- `layout.nodes: PositionedNode[]`
- `layout.edges: PositionedEdge[]`
- optional: `annotations`, `subgraphs`, `overflows`, `codeblocks`

`PositionedNode` fields that materially affect rendering:
- Required: `id`, `label`, `kind`, `properties`, `x`, `y`, `w`, `h`
- `kind` must be one of: `service | component | external | actor | datastore | label | circle`

`PositionedEdge` fields used by renderer:
- Required: `from`, `to`, `arrow`, `dashed`, `properties`
- Optional: `label`
- `arrow` values: `--> | <-- | <--> | -.-> | <-.-`
- Note: `fromPt`/`toPt` exist in type, but renderer recomputes geometry from nodes.

### Styling semantics already encoded in renderer (must feed via properties)
Node properties consumed: `fill`, `shape`, `border`, `sublabel`, `emphasis`, `min-height`, `min-width`.
Edge properties consumed: `color`, `step` (+ `dashed` boolean).
Subgraph properties consumed (if used later): `fill`, `border-style`, `badge`.

## 3) Proposed End-to-End Pipeline
1. LLM produces:
- Perfect-ASCII JSON (normally `diagram` mode)
- A sidecar metadata object with semantic info (node kind/fill/edge style/etc.)

2. `perfect-ascii` renders the ASCII text.

3. New n9tgraph ASCII parser ingests:
- ASCII text grid
- Metadata sidecar

4. Parser emits `AsciiParsedFlow` (intermediate):
- `boxes[]` with char-grid bounding boxes
- `connectorTraces[]` with polylines in char coordinates
- extracted/free-text labels near connectors

5. Mapper converts intermediate -> `FlowLayout`:
- Nodes get absolute pixel boxes from ASCII coordinates
- Edges get semantic fields from metadata + traced connectivity
- `renderFlow(layout)` called unchanged

## 4) Metadata Format (Sidecar)
Use sidecar JSON (or YAML) keyed by stable IDs; ASCII provides geometry only.

```json
{
  "version": "ascii-flow-v1",
  "diagram": {
    "direction": "LR",
    "theme": "default",
    "title": "Optional title"
  },
  "nodes": [
    {
      "id": "API",
      "match": { "label": "API", "occurrence": 1 },
      "kind": "service",
      "properties": {
        "fill": "hero",
        "sublabel": "Fast path",
        "emphasis": "primary"
      }
    }
  ],
  "edges": [
    {
      "id": "E1",
      "from": "API",
      "to": "DB",
      "arrow": "-->",
      "label": "writes",
      "dashed": false,
      "properties": {
        "color": "accent",
        "step": "1"
      },
      "match": { "label": "writes", "occurrence": 1 }
    }
  ]
}
```

Design rules:
- IDs and style semantics come from metadata, not inferred from ASCII text.
- `match` block resolves ambiguous duplicate labels.
- Metadata is validated strictly (unknown keys rejected).
- Missing metadata falls back conservatively: `kind=component`, empty properties.

## 5) ASCII Parsing Strategy (Regex + Grid Walk)

### A. Normalize to char grid
- Split lines, right-pad to max width.
- Track `(row, col)` for every character.
- Preserve raw lines for diagnostics.

### B. Detect boxes (hybrid regex + structural checks)
Use corners + border validation:
- Top border candidate: `+---...---+`
- Minimum box height: 3 rows
- Side walls must be `|` on interior rows
- Bottom border must mirror top border

Useful row-level regex checks:
- Border row: `^\+-{2,}\+$`
- Content row: `^\|.*\|$`

Algorithm:
1. Scan each `+` as potential top-left.
2. Find matching top-right `+` on same row with only `-` between.
3. Search downward for matching bottom row.
4. Validate vertical walls and inner rows.
5. Record `{top,left,right,bottom,width,height}`.

### C. Extract node text from box interior
- Primary label: first non-empty interior text row (centered by perfect-ascii).
- If separator row exists (`+---+` inside), subsequent rows are body text.
- Trim edge padding spaces.

### D. Build connector graph outside boxes
Treat these chars as connector primitives:
- horizontal: `-`
- vertical: `|`
- junction: `+`
- arrowheads: `< > ^ v`

Exclude all chars strictly inside detected box rectangles (except border contact ports).

### E. Trace connector paths
- Start from each arrowhead cell.
- Walk backward through connector graph until reaching a source port on a box boundary.
- At `+`, continue with direction-preserving priority; fallback to shortest valid continuation.
- Record polyline waypoints at direction changes.

### F. Extract edge labels near traces
- Candidate text = non-connector, non-box chars in a small corridor around each trace.
- Attach nearest text cluster to trace.
- If ambiguous/missing, use metadata `edges[].label`.

## 6) Mapping Parsed ASCII -> FlowLayout

### Node geometry mapping
Choose fixed char-to-pixel scale constants:
- `CELL_W` (e.g., 10)
- `CELL_H` (e.g., 18)
- `MARGIN_X/Y`

Then:
- `x = MARGIN_X + left * CELL_W`
- `y = MARGIN_Y + top * CELL_H`
- `w = (right - left + 1) * CELL_W`
- `h = (bottom - top + 1) * CELL_H`

### Edge mapping
- `from`/`to`: from traced box endpoints (or metadata if trace disambiguation needed).
- `arrow`/`dashed`/`properties`/`label`: metadata-first; ASCII inferred as fallback.
- `fromPt`/`toPt`: fill with endpoint centers (type completeness only).

### Canvas mapping
- `width/height` from max node extents + margins.
- `direction` from metadata (required; do not guess unless fallback mode).
- Start with empty `annotations/subgraphs/codeblocks` for v1.

## 7) Simplify vs Preserve

### Can be simplified (bypass in ASCII path)
- `layoutFlow` graph layering, cycle removal, crossing minimization, aspect and spacing heuristics.
- AST parsing for flow DSL in this path.
- Subgraph/annotation auto-placement initially.

### Must remain exactly from existing renderer
- Node shape rendering and pattern fills.
- Edge drawing style, arrow markers, label visuals, collision nudging.
- Theme behavior (`default`/`white`) and SVG defs/patterns.

## 8) Risk Register + Mitigations
- Ambiguous merged connector trunks:
  - Mitigation: metadata edge list is authoritative; trace used for geometry verification.
- Duplicate box labels:
  - Mitigation: metadata `match.occurrence` or explicit stable IDs.
- Lane separators (`label |`) mistaken as connectors:
  - Mitigation: ignore connector chars left of first box column.
- Dashed flow edges are not native in perfect-ascii `diagram` output:
  - Mitigation: carry dashed semantics in metadata.
- Complex text near connectors causing false label capture:
  - Mitigation: metadata-first labeling, ASCII labels as fallback only.

## 9) Implementation Sequence (No Code Yet)
1. Define/lock `ascii-flow-v1` metadata schema.
2. Build ASCII box extractor with strict structural validation + diagnostics.
3. Build connector graph tracer and endpoint-to-box resolution.
4. Build metadata overlay + resolver for duplicate labels.
5. Build mapper to `FlowLayout` object.
6. Add snapshot fixtures (ASCII + metadata -> SVG) to verify renderer parity/stability.
7. Add failure modes with clear parser errors (unclosed box, orphan arrowhead, unresolved edge match).

