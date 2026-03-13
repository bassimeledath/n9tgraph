# Polish Pass 2: Output Summary

## Changes Made

### 1. responses-api.n9 — Edge label overlap fixed

**Problem**: The two edges between RESPONSES API and MODEL had overlapping labels ("PROMPT + SHELL INSTRUCTION + STDOUT/STDERR" and "SHELL COMMANDS").

**Fix** (3 changes):
- **Taller service nodes**: Removed the `&& sublabel` condition so all service nodes get `h = max(h, 120)`. This makes RESPONSES API tall enough to vertically overlap both MODEL and RUNTIME CONTAINER, giving the multi-edge spread algorithm room to separate the edges.
- **Wider multi-edge spread**: Increased spread from 65→80px for labeled multi-edge pairs.
- **Increased LAYER_GAP**: 140→160px gives more horizontal room between columns for edge labels.

### 2. layered-architecture.n9 — Orthogonal edge routing for TB mode

**Problem**: All cross-row edges were diagonal lines crossing each other.

**Fix**: Added orthogonal routing for TB (top-to-bottom) layouts in `flow-renderer.ts`:
- **Forward edges** (source above target): Exit from bottom center of source, enter top center of target. If not vertically aligned, route as Z-shaped polyline (down → horizontal → down) through the midpoint between rows.
- **Back-edges** (target above source, e.g. TYPES→UTILS): Route along the left side of the diagram — exit left of source, go left to margin, go up, enter left of target.
- **Vertically aligned edges** (|dx| < 10px): Straight vertical line.

Only applies to TB direction (only layered-architecture.n9 uses TB), so no impact on LR diagrams.

### 3. observability-stack.n9 — More horizontal room near CODEX

**Problem**: Edge labels between CODEX↔CODEBASE cramped with nearby annotations.

**Fix**: The LAYER_GAP increase (140→160) gives 20px more horizontal room per layer gap, reducing visual cramping. Pill-shaped nodes for API nodes were already rendering correctly (rx=999).

## Files Modified

- `src/layout/flow-layout.ts`:
  - Added `direction` to `FlowLayout` interface
  - Increased `LAYER_GAP` from 140 to 160
  - Service nodes always get `h = max(h, 120)` (removed sublabel condition)
  - Included `direction` in layout output

- `src/render/flow-renderer.ts`:
  - Added `polylineEdge` import
  - Added `direction` parameter to `renderEdges`
  - Added TB orthogonal routing (Z-shape forward, left-side back-edge)
  - Increased multi-edge label spread from 65 to 80

## Verification

All 11 diagrams render successfully with no regressions. Final PNGs copied to `~/Downloads/n9tgraph-output/`.
