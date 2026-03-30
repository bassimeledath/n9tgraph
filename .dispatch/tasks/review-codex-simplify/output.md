# Code Review: ascii-layout.ts Simplification + flow-renderer.ts same-row obstacle avoidance

## Scope
- Reviewed `src/layout/ascii-layout.ts` end-to-end, with emphasis on post-processing passes.
- Reviewed `src/render/flow-renderer.ts` around lines 740-800 in the full routing context.

## 1) Post-processing consolidation opportunities (ascii-layout.ts)

### Current pass structure
`ascii-layout.ts` currently applies multiple sequential mutating passes after initial node/subgraph placement:
- Step 8a label-clearance shift (`337-367`)
- Step 8a2 node-to-subgraph top gap shift (`369-391`)
- Step 8b adjacent-subgraph margin shift (`393-415`)
- Step 10 global negative/min-margin shift (`447-471`)
- Step 11 horizontal centering shift (`473-493`)

There is significant duplication in how Y shifts are applied:
- Repeated loops over all nodes and subgraphs with a `yThreshold` check (`358-363`, `383-388`, `407-412`).

### Consolidation recommendation
Refactor to a small post-layout engine:
1. Add shared mutators:
- `shiftAll(dx, dy)` for global shifts.
- `shiftBelowY(yThreshold, dy)` for cascade shifts.

2. Merge Step 8a + 8a2 + 8b into one "vertical constraints" pass:
- Build a list of violated constraints (label zone, node->subgraph top margin, subgraph->subgraph margin).
- Apply each violation through `shiftBelowY`.
- Iterate until no violations or max iterations (e.g. 3) to avoid order-dependent artifacts.

3. Merge Step 10 + Step 11 into one normalization pass:
- Compute content bounds once.
- Derive `shiftX`/`shiftY` for min margins and optional centering from one bounds snapshot.
- Apply one `shiftAll`.

### Expected impact
- Removes duplicated shift loops and centralizes coordinate mutation.
- Makes pass ordering explicit and testable.
- Estimated reduction: **~45-70 LOC** in `ascii-layout.ts`.

## 2) Constants to extract to a config object

### ascii-layout.ts
Extract these magic numbers into an `ASCII_LAYOUT_CONFIG` object with grouped domains:
- Canvas/margins: `MARGIN_X`, `MARGIN_TOP`, `TITLE_HEIGHT` (`49-51`)
- Grid spacing defaults: `DEFAULT_LAYER_GAP`, `DEFAULT_TB_LAYER_GAP`, `DEFAULT_NODE_GAP` (`52-54`)
- Node sizing: `ACTOR_W`, `ACTOR_H`, `MIN_NODE_W`, `CIRCLE_R`, `MAX_NODE_LABEL_CHARS` (`55-58`, `62`)
- Subgraph padding: `SUBGRAPH_PAD_X`, `SUBGRAPH_PAD_TOP`, `SUBGRAPH_PAD_BOTTOM` (`59-61`)
- Label/sublabel spacing literals currently inline:
  - `SUBLABEL_GAP = 10` (`132`)
  - row-gap label extra `30` (`249`)
  - subgraph label zone `13/37` and label clearance `10` (`338-341`)
  - node-subgraph margin `30` (`370`)
  - subgraph-subgraph margin `30` (`394`)
  - center epsilon `1` (`485`)
  - annotation offsets `20` (`429-432`)

### flow-renderer.ts (for consistency with routing behavior)
The new obstacle logic should use shared routing constants, not branch-local literals:
- `SAME_ROW_CLEARANCE = 12` (`754`)
- Back-edge route offsets `BASE_CLEARANCE = 40`, `PER_EDGE_OFFSET = 20`, target drop `15` (`718-719`, `734`)
- Existing `EDGE_CLEARANCE = 12` values in nearby branches (`616`, `876`)

Suggested split: `layoutConfig` and `routingConfig`, imported where needed.

## 3) Code smells / maintainability issues

1. Repeated mutation loops in `ascii-layout.ts`:
- Same pattern copied in three places (apply Y shift to nodes + subgraphs).
- Increases bug risk when one branch is updated and others are not.

2. O(N*M*K) membership checks:
- `sg.childIds.includes(n.id)` inside nested loops (`348`, `373`) repeatedly scans arrays.
- Convert `childIds` to `Set` once per subgraph for cleaner code and lower constant factors.

3. Order-sensitive mutation:
- Subgraph/nodes are shifted while iterating constraints, so results depend on iteration order.
- This makes behavior harder to reason about and can drift as new passes are added.

4. Implicit/derived constants encoded as raw numbers:
- `LABEL_ZONE_TOP/BOTTOM` (`13/37`) rely on font assumptions from a comment.
- If typography changes, this becomes stale unless manually updated.

5. `flow-renderer.ts` same-row branch duplicates logic already present in non-TB obstacle branch (`873-911`):
- Similar obstacle detect -> pick detour axis -> render polyline pattern exists twice with minor differences.
- Candidate for a shared helper like `routeAroundSingleObstacle(...)`.

6. Type weakening:
- `nodeCenter(sameRowBlocking as any)` (`765`) introduces avoidable `any` usage.

## 4) Regression risk: same-row obstacle avoidance in flow-renderer.ts

### Risk level
**Medium** for visual regressions in TB Sugiyama layouts with same-rank edges.

### Why
- The change is scoped to `direction === 'TB' && siblings.length === 1` and the `!isForward && !isBackward` branch (same-row edges), so not all Sugiyama edges are affected.
- It introduces new bend routing when straight line intersects one obstacle.

### Specific regression vectors
1. First-hit obstacle only (`756-761`):
- Routes around the first matching node and stops; resulting polyline can still cross another obstacle.

2. Label avoidance is one-sided and order-dependent (`774-786`):
- Only checks already-added `pendingLabels`; later labels are unknown.
- Edge draw order can change final routes.

3. No subgraph-label-zone avoidance in this branch:
- Forward branch adjusts around subgraph label zones (`650-656`, `680-686`), same-row branch does not.

4. Aggressive trigger from clearance-expanded intersection:
- `lineSegmentIntersectsAABB(..., 12)` can reroute edges that are merely near obstacles, changing established straight-edge appearance.

### Practical conclusion
- Unlikely to break all Sugiyama diagrams, but likely to alter a subset with same-row links and dense neighborhoods.
- Behavior is beneficial in many overlap cases, but currently not robust enough to be fully predictable.

## 5) Concrete refactor suggestions with estimated LOC reduction

1. Introduce `shiftBelowY` + `shiftAll` helpers in `ascii-layout.ts` and replace three duplicated blocks.
- Estimated reduction: **~20-30 LOC**.

2. Merge Step 8a/8a2/8b into `applyVerticalClearanceConstraints(nodes, subgraphs, config)`.
- Estimated reduction: **~20-30 LOC**.

3. Merge Step 10/11 into `normalizeLayoutPosition({ centerX: true })` with single bounds calc.
- Estimated reduction: **~10-15 LOC**.

4. Extract routing constants into `routingConfig` and unify obstacle detour code in `flow-renderer.ts`.
- Estimated reduction: **~15-25 LOC** in renderer (mostly deduplication), plus readability gains.

### Total expected net reduction
- `ascii-layout.ts`: **~45-70 LOC**
- `flow-renderer.ts`: **~15-25 LOC**
- Combined: **~60-95 LOC** (depending on helper granularity)
