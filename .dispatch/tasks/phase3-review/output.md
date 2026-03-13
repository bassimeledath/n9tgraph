# Phase 3 Review: Flow Diagram Visual Fixes

## Changes Made

### `src/layout/flow-layout.ts`
- **LAYER_GAP**: 240 → 340 — More horizontal space between layers (USER → RESPONSES API → MODEL/RUNTIME). Eliminates the cramped look.
- **NODE_GAP**: 120 → 180 — More vertical separation between MODEL (upper-right) and RUNTIME CONTAINER (lower-right), matching the reference's generous spacing.
- **Annotation positioning**: Increased offset from 12px → 20px on all sides, preventing annotation text from sitting too close to node borders.

### `src/render/flow-renderer.ts`
- **Edge spread**: 80 → 150 — Much wider perpendicular spread for parallel edges between the same node pair. This separates the outgoing/return edges visually (e.g., RESPONSES API↔MODEL).
- **Edge label placement**: Labels placed at t=0.30 from source node. For opposing edges (A→B and B→A), each label sits near its source, naturally separating them across the full edge length. The increased spread ensures labels are on different edge lines.
- **Removed perpendicular label offset hack** — with the larger edge spread, labels sitting on their edge lines are already well-separated.

## Before vs After
- **Before**: Edge labels "PROMPT + SHELL INSTRUCTION + STDOUT/STDERR" and "SHELL COMMANDS" overlapped badly between RESPONSES API and MODEL. Diagram was horizontally cramped. Annotation collided with edge labels.
- **After**: All labels are clearly separated. Generous spacing between layers and nodes. Annotation sits cleanly to the right of RESPONSES API, between the MODEL and RUNTIME edge paths.

## Verification
- `responses-api.n9` — Matches reference layout closely: USER left, RESPONSES API center, MODEL upper-right, RUNTIME lower-right, all labels readable.
- `codex-debugging.n9` — Sequence diagram renders correctly, no regressions.
- `streaming-shell.n9` — Sequence diagram renders correctly, no regressions.
