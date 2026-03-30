# Code Review: ascii-layout.ts & flow-renderer.ts (lines 740-800)

**Scope**: Structural complexity, redundant computation, magic numbers, dead code, error handling, renderer regression risk, architecture.

---

## 1. Constant Duplication with Misleading Comment — HIGH

**File**: `src/layout/ascii-layout.ts:47-62`

The comment says `// ─── Constants (mirrored from flow-layout.ts) ───────────` but several values actually **diverge**:

| Constant | ascii-layout.ts | flow-layout.ts |
|---|---|---|
| `DEFAULT_TB_LAYER_GAP` | **50** | 38 |
| `DEFAULT_NODE_GAP` | **50** | 20 |
| `SUBGRAPH_PAD_X` | **28** | 16 |
| `SUBGRAPH_PAD_TOP` | **64** | 56 |
| `SUBGRAPH_PAD_BOTTOM` | **28** | 16 |

This is a maintenance trap. The "mirrored" comment implies they should match, but they intentionally differ (presumably for better ASCII-guided spacing). If someone updates `flow-layout.ts` constants they'll assume ascii-layout.ts is already in sync.

**Suggestion**: Either (a) extract shared constants into a `layout-constants.ts` module and have ascii-layout import + override where needed, making the deltas explicit, or (b) at minimum change the comment to `// ─── Constants (based on flow-layout.ts, intentionally divergent) ───` and annotate each override.

---

## 2. Duplicated `computeNodeSize` Logic — HIGH

**File**: `src/layout/ascii-layout.ts:81-156`

`computeNodeSize()` is essentially a copy of the node sizing logic in `flow-layout.ts` (lines ~300-420). The two implementations must stay in sync for the ASCII layout to produce geometrically compatible results. Any bug fix applied to one must be manually ported to the other.

**Suggestion**: Extract a shared `computeNodeSize(box, fontSizes)` function into a common module (e.g. `layout-utils.ts`) and import from both files. The interface differs slightly (ascii-layout uses `BoxDef`, flow-layout uses its own node type), but the computation is identical — a thin adapter would suffice.

---

## 3. Repeated Shift-Everything-Below Pattern — MEDIUM

**File**: `src/layout/ascii-layout.ts:337-415` (Steps 8a, 8a2, 8b)

Three separate post-processing loops (8a, 8a2, 8b) each use the identical "push everything below a threshold down" pattern:

```ts
const yThreshold = <value> - 1;
for (const nd of nodes) { if (nd.y > yThreshold) nd.y += shift; }
for (const s of subgraphs) { if (s.y > yThreshold) s.y += shift; }
```

This pattern appears 5 times across these three steps.

**Suggestion**: Extract a `shiftBelow(yThreshold, shift, nodes, subgraphs)` helper. More importantly, consider merging Steps 8a and 8a2 into a single pass since both check non-child nodes against subgraph bounds — 8a checks label zone clearance, 8a2 checks top-edge margin. They could be combined into one loop with `maxShift = Math.max(labelShift, marginShift)` applied once per subgraph.

---

## 4. Step 10/11 Redundant Element Iteration — MEDIUM

**File**: `src/layout/ascii-layout.ts:447-493`

Step 10 (negative coord fixup) and Step 11 (horizontal centering) each independently iterate all nodes, subgraphs, and annotations to apply x/y shifts. These two passes could be combined into a single pass that computes the total shift (negative fixup + centering) and applies it once.

**Suggestion**: Compute `totalShiftX = fixupShiftX + centerShift` and `totalShiftY = fixupShiftY` before the loop, then apply once. This also eliminates the double-computation of content bounds (Step 10 computes min coords, Step 11 recomputes max coords — both could be done in one scan).

---

## 5. Magic Numbers in Subgraph Label Clearance — MEDIUM

**File**: `src/layout/ascii-layout.ts:339-341`

```ts
const LABEL_CLEARANCE = 10;
const LABEL_ZONE_TOP = 13;
const LABEL_ZONE_BOTTOM = 37;
```

These are locally scoped constants with inline comments, but `13` and `37` are derived from `fontSizes.subtitle` (14) and a text height of 24 — this derivation is only documented in a comment. If `fontSizes.subtitle` changes, these numbers become wrong.

**Suggestion**: Compute from `fontSizes.subtitle` rather than hardcoding: `LABEL_ZONE_TOP = (SUBGRAPH_PAD_TOP - fontSizes.subtitle) / 2` or similar, matching the rendering logic that produces these positions.

---

## 6. flow-renderer.ts: Obstacle Avoidance Finds Only First Blocker — MEDIUM

**File**: `src/render/flow-renderer.ts:756-762`

The same-row obstacle detection breaks on the first blocking node:

```ts
if (lineSegmentIntersectsAABB(fromPt, toPt, node, SAME_ROW_CLEARANCE)) {
  sameRowBlocking = node;
  break;  // <— only handles one obstacle
}
```

If there are multiple blocking nodes in a row, the route detours around the first but may clip the second. The non-TB path (line 877-884) has the same pattern.

**Suggestion**: This may be acceptable for typical diagrams, but worth documenting the limitation. For a proper fix, iterate all blockers and pick the detour `midY` that clears all of them (the forward-edge code at line 660-668 already does this correctly).

---

## 7. flow-renderer.ts: SAME_ROW_CLEARANCE vs EDGE_CLEARANCE — LOW

**File**: `src/render/flow-renderer.ts:616,754,876`

`EDGE_CLEARANCE = 12` is declared three times across the function (lines 616, 876, and implicitly via `SAME_ROW_CLEARANCE = 12` at line 754). They're all the same value but use two different names.

**Suggestion**: Declare once at function scope: `const EDGE_CLEARANCE = 12;` and use everywhere.

---

## 8. Regression Risk: Non-TB Obstacle Avoidance — MEDIUM

**File**: `src/render/flow-renderer.ts:873-911`

The non-TB (Sugiyama/LR) obstacle avoidance block at lines 873-911 is structurally similar to the TB same-row block but has key differences:
- It handles both horizontal and vertical edges (the TB path only handles horizontal same-row).
- It does **not** check `pendingLabels` for clearance (unlike the TB path at lines 774-786).
- It does **not** handle backward edges differently.

If the ASCII layout produces LR diagrams, these edges will go through this code path without the label clearance logic, potentially causing label-over-edge overlaps.

**Suggestion**: Port the `pendingLabels` clearance check (lines 774-786) into the non-TB obstacle avoidance block for consistency.

---

## 9. No Dead Code Found — N/A

All functions and code paths in `ascii-layout.ts` are reachable. The `colHeights` array computed at Step 4 is used in the LR branch at Step 5, so it's not dead despite looking unused in TB mode.

---

## 10. Error Handling Gaps — LOW

**File**: `src/layout/ascii-layout.ts:274`

When a box is defined but not placed in the grid, it's silently skipped (`if (!pos) continue`). If a connector references an unplaced box, the edge will have `fromPt: {0,0}` and `toPt: {0,0}` since edges are built from `diagram.connectors` without checking node existence (Step 7, line 303). The renderer will then draw an edge from (0,0) to (0,0).

**Suggestion**: Filter edges to only include those where both `from` and `to` exist in `nodeMap`, matching how `flow-layout.ts` handles this.

---

## 11. Architecture: Should Logic Be Extracted? — HIGH (strategic)

`ascii-layout.ts` is 511 lines with a clean step-by-step structure. The main extraction opportunities:

1. **`computeNodeSize`** → shared module (see Finding #2). This is the highest-value extraction.
2. **Layout constants** → shared module (see Finding #1).
3. **Shift helpers** → small utility, but reduces 5 copies to 1 (see Finding #3).
4. **Steps 8a/8a2/8b** could be a `resolveSubgraphOverlaps(nodes, subgraphs)` function (~80 lines extracted). This would make `layoutFromGrid` a cleaner orchestration function.

The step-by-step structure (Steps 1-12) is actually a strength — it reads top-to-bottom and each step has a clear purpose. The main concern is the duplicated sizing logic, not the step count.

---

## Summary

| # | Finding | Impact | Fix Effort |
|---|---------|--------|------------|
| 1 | Constant duplication with misleading comment | HIGH | Low |
| 2 | Duplicated `computeNodeSize` across files | HIGH | Medium |
| 3 | Repeated shift-everything pattern (5x) | MEDIUM | Low |
| 4 | Redundant iteration in Steps 10/11 | MEDIUM | Low |
| 5 | Magic numbers for label zone geometry | MEDIUM | Low |
| 6 | Single-blocker obstacle avoidance | MEDIUM | Medium |
| 7 | Redundant EDGE_CLEARANCE declarations | LOW | Trivial |
| 8 | Non-TB path missing label clearance | MEDIUM | Low |
| 9 | No dead code | N/A | — |
| 10 | Silent edge-to-unplaced-node | LOW | Low |
| 11 | Architecture extraction opportunities | HIGH (strategic) | Medium |

**Top 3 recommendations** (highest value per effort):
1. Extract shared constants module — prevents divergence bugs
2. Extract shared `computeNodeSize` — eliminates the most dangerous duplication
3. Merge Steps 8a + 8a2 and extract shift helper — reduces the post-processing from 3 passes to 1-2
