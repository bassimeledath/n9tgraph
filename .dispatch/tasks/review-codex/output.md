# Review: ASCII-Guided Layout Implementation

## Findings

### 1) High — LR grid→pixel mapping uses wrong axis dimensions
- `src/layout/ascii-layout.ts:199-205` computes `colWidths` from node widths and `rowHeights` from node heights.
- In LR mode, placement then uses `rowHeights` as horizontal layer widths and `colWidths` as vertical lane heights (`src/layout/ascii-layout.ts:235-244`, `src/layout/ascii-layout.ts:263-264`).
- This is axis-inverted for LR and can under-allocate horizontal space for wide nodes (negative centering offsets, overlap/collision risk).

### 2) High — Subgraph bounds can go negative and get clipped
- First row starts at `MARGIN_TOP` (`src/layout/ascii-layout.ts:226-230`), but subgraph bounds always subtract `SUBGRAPH_PAD_TOP` (`src/layout/ascii-layout.ts:299-300`).
- For top-row children, `subgraph.y` can be negative.
- Canvas dimensions only consider max extents, not min extents (`src/layout/ascii-layout.ts:347-350`), so negative content is outside the `viewBox` origin and can be clipped.

### 3) Medium — Missing reference handling is silent (nodes/edges disappear without errors)
- Unknown grid IDs are ignored rather than rejected (`src/layout/ascii-layout.ts:191-193`).
- Connectors are accepted without endpoint validation (`src/layout/ascii-layout.ts:282-291`), and renderer drops unresolved edges (`src/render/flow-renderer.ts:586-589`).
- Missing `subgraph.childIds` and `annotation.near` refs are silently skipped (`src/layout/ascii-layout.ts:296-297`, `src/layout/ascii-layout.ts:319-320`).
- Result: malformed inputs can render partially with no diagnostic signal.

### 4) Medium — Duplicate IDs are not validated (last-write-wins)
- Duplicate `boxes[].id` overwrite prior entries in `boxMap` (`src/layout/ascii-layout.ts:167-174`).
- Duplicate grid placement of the same ID overwrites prior coordinates (`src/layout/ascii-layout.ts:192-194`).
- This can silently move/replace nodes and desynchronize author intent vs output.

### 5) Medium — Title offset assumes single-line title while renderer supports wrapped titles
- Grid layout reserves fixed `TITLE_HEIGHT` when title exists (`src/layout/ascii-layout.ts:212`).
- Renderer wraps long titles into multiple lines (`src/render/flow-renderer.ts:1224-1257`).
- Reference flow layout computes dynamic multi-line title offset (`src/layout/flow-layout.ts:1014-1016`).
- Long titles can overlap top-row nodes/subgraphs in ASCII-guided mode.

### 6) Low — MCP ASCII path computes layout twice and can report misleading counts
- `n9t.render-ascii` calls `layoutFromGrid(parsed)` and then `renderFromGrid(parsed)` (which calls `layoutFromGrid` again) (`src/mcp-server.ts:817-818`, `src/render/svg.ts:101-103`).
- Reported `nodeCount`/`edgeCount` come from raw input arrays (`src/mcp-server.ts:827-828`, `src/mcp-server.ts:849-850`), not validated/resolved rendered entities.

## Checked Areas Without Blocking Issues
- Type wiring is coherent end-to-end: `AsciiGuidedInput` + `renderFromGrid` are exported (`src/index.ts:3-4`) and MCP tool is registered (`src/mcp-server.ts:806-873`).
- Edge handling approach matches existing flow pipeline: `fromPt/toPt` are placeholder zeros (`src/layout/ascii-layout.ts:289-290`, `src/layout/flow-layout.ts:782`) and renderer computes actual attachment points during render (`src/render/flow-renderer.ts:586-599`, `src/render/flow-renderer.ts:817-823`).
