# Polish Pass: Summary

## Fixes Applied

### 1. request-lifecycle.n9 — Raw markdown syntax
- **Problem**: Notes showed literal `**2**` markdown syntax instead of clean text. Multi-line notes (`\n`) rendered as literal characters.
- **Fix**: Updated `renderNotes()` in `sequence-renderer.ts` to parse `**bold**` syntax and split on literal `\n` for multi-line rendering. Updated `layoutNoteElem()` in `sequence-layout.ts` to compute proper width/height for multi-line notes with bold-stripped measurements.
- **Files changed**: `src/render/sequence-renderer.ts`, `src/layout/sequence-layout.ts`

### 2. responses-api — Edge label overlap
- **Problem**: Edge labels "PROMPT + SHELL INSTRUCTION + STDOUT/STDERR" and "SHELL COMMANDS" between RESPONSES API↔MODEL overlapped. Not enough vertical space between MODEL and RUNTIME CONTAINER.
- **Fix**: Increased multi-edge spread from 35px to 65px for edges with labels (`flow-renderer.ts`). Increased `NODE_GAP` from 40 to 80 to give more vertical room between nodes in the same layer (`flow-layout.ts`).
- **Files changed**: `src/render/flow-renderer.ts`, `src/layout/flow-layout.ts`

### 3. observability-stack — Annotation overlap
- **Problem**: Annotations around CODEX and CODEBASE overlapped with edge labels. "UI Journey" was placed on the right side where edges go.
- **Fix**: Changed annotation positions in the `.n9` file: "UI Journey" moved from `side right` to `side bottom`, "Test" moved from `side right` to `side bottom`. This avoids competition with edge labels.
- **Files changed**: `examples/observability-stack.n9`

### 4. layered-architecture — Edge crossings and layout
- **Problem**: UTILS was centered at top, causing excessive edge crossings (especially the TYPES→UTILS back edge). Large vertical gaps between rows.
- **Fix**: Added `refineCoordinatesTB()` function that repositions single-node layers using the median of all connected neighbors' x-coordinates (including back edges). This aligns UTILS above PROVIDERS/TYPES, reducing crossings. Added `TB_LAYER_GAP = 100` (separate from LR's `LAYER_GAP = 140`) for more compact vertical spacing.
- **Files changed**: `src/layout/flow-layout.ts`

## Other Diagrams Reviewed (No Changes Needed)
- tools-overview — Clean match
- session-multiplexer — Clean match
- skill-loading — Clean match
- container-egress — Clean match
- codex-debugging — Clean match
- streaming-shell — Clean match
- codex-knowledge — Clean match

## Output
All 11 PNGs copied to `~/Downloads/n9tgraph-output/`.
