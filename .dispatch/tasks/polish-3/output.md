# Polish Pass 3: Summary

## Changes Made

### `src/layout/flow-layout.ts`
1. **Reduced LAYER_GAP** (160 → 120): Brings horizontally-adjacent layers closer, reducing diagonal edge angles
2. **Reduced base NODE_GAP** (80 → 55): Makes subgraphs with multiple nodes more compact vertically
3. **Dynamic per-layer NODE_GAP**: Added `computeLayerGap()` — layers with labeled multi-edge pairs (e.g., responses-api's MODEL/RUNTIME_CONTAINER) get wider gaps (55 + 80 per extra edge in pair = 135px) to prevent label overlap
4. **Service node height based on edge pairs**: Services connected to 2+ neighbors via labeled multi-edge pairs get taller (e.g., 200px for 2 groups) so they visually span the vertical range of their connections
5. **Same-layer edge detection for TB mode**: Iterative algorithm in `assignLayers()` that detects edges where removing them would place the target at the source's layer. These edges are excluded from layer assignment, enabling correct same-row grouping (e.g., Providers + App Wiring+UI in the same row)

### `examples/layered-architecture.n9`
Added 5 horizontal same-row edges:
- `PROVIDERS --> APP_WIRING_UI` (row 1)
- `SERVICE --> RUNTIME`, `RUNTIME --> UI` (row 2)
- `TYPES --> CONFIG`, `CONFIG --> REPO` (row 3)

## Visual Improvements

| Diagram | Before | After |
|---------|--------|-------|
| tools-overview | MODEL far left, wide diagonal fan to subgraph | MODEL closer, subgraph compact, reduced angles |
| responses-api | MODEL/RUNTIME_CONTAINER too close (flat) | Clear vertical separation, service spans range |
| layered-architecture | 4 columns, no horizontal arrows | 4 rows with horizontal same-row arrows matching reference |
| session-multiplexer | Already close | Verified clean horizontal edge pairs |

## No Regressions
All 11 diagrams render successfully: codex-debugging, codex-knowledge, container-egress, layered-architecture, observability-stack, request-lifecycle, responses-api, session-multiplexer, skill-loading, streaming-shell, tools-overview.
