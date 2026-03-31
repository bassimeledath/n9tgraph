# Diagram Congestion: Root Cause Analysis

## Visual Evidence (10+ examples rendered)

| Diagram | Direction | Congestion Observed |
|---------|-----------|-------------------|
| ci-deploy-pipeline | TB | Minimal — clean chain layout, subgraph well-spaced |
| payment-flow | LR | **Hub congestion** — 7 labeled edges from Checkout API; labels "risk check"/"score"/"charge card" cluster near same midpoint |
| observability-stack | LR | **Dense packing** — subgraph interior cramped, annotations far from anchors, edge labels tight |
| responses-api | LR | **Bidirectional label overlap** — STDOUT/STDERR labels between Responses API ↔ Runtime Container |
| cylinder-test (synthetic) | LR | **Severe node overlap** — cylinders of different widths physically overlap in LR layout |
| layered-architecture | TB | Backward edge creates tension near subgraph; otherwise adequate |
| container-egress | TB | Minor — step annotations well-placed |
| tools-overview | LR | Clean — subgraph + cards work well |
| session-multiplexer | LR | Clean — subgraph spacing good |
| compact-preset test | TB | Tight but usable for simple chains; would fail with labels |

## Root Causes (ranked by impact)

### 1. Default spacing constants 2.5x tighter than ascii-layout — HIGH IMPACT

**Location:** `src/layout/flow-layout.ts:88-89`

```
flow-layout.ts                     ascii-layout.ts
─────────────                      ────────────────
DEFAULT_NODE_GAP    = 20           DEFAULT_NODE_GAP    = 50   (2.5x wider)
DEFAULT_TB_LAYER_GAP = 38          DEFAULT_TB_LAYER_GAP = 50   (1.3x wider)
SUBGRAPH_PAD_X      = 16          SUBGRAPH_PAD_X      = 28   (1.75x wider)
SUBGRAPH_PAD_BOTTOM  = 16          SUBGRAPH_PAD_BOTTOM  = 28   (1.75x wider)
compact nodeGap     = 12           compact nodeGap     = 24   (2x wider)
```

The flow-layout Sugiyama engine was tuned for minimal diagrams (3-5 nodes). As diagrams grow, the tight gaps compound: edge labels have no room, subgraph children crowd borders, and the collision-avoidance passes must cascade shifts through the layout.

The ascii-layout was tuned later with more examples and consistently produces more breathable results.

**Fix:** Increase `DEFAULT_NODE_GAP` to 30, `DEFAULT_TB_LAYER_GAP` to 48. **2 LOC.**

### 2. Cylinder (datastore) height undercount by 10px — HIGH IMPACT

**Location:** `src/layout/flow-layout.ts:357-359` (and identical in `ascii-layout.ts:122-124`)

```ts
if (n.kind === 'datastore') {
    const CYLINDER_RIM = 10;
    h = Math.max(h, h + CYLINDER_RIM);  // adds only 10px
}
```

The cylinder shape in `shapes.ts:38-39` uses `ry = 10` for BOTH top and bottom ellipses, consuming 20px total vertical space. But only 10px is added to the node height. Result:
- Body area = `h - 20` instead of the expected `h - 10`
- For a typical single-line label: h starts at 36, becomes 46, body = 26px — barely fits 13px font
- In LR layouts, undersized cylinder heights cause nodes from adjacent layers to overlap vertically (confirmed: cylinder-test shows severe overlap)

The renderer partially compensates by shifting label position (`bodyCenterY = y + rimY * 2 + (h - rimY * 3) / 2` at flow-renderer.ts:232), but the layout bounding box is still 10px short, causing overlap with neighboring nodes.

**Fix:** Change `CYLINDER_RIM = 10` to `CYLINDER_RIM = 20` (or equivalently, `h + CYLINDER_RIM * 2`). **1 LOC** (x2 for both layout files).

### 3. Edge-label collision cascade on hub nodes — MEDIUM IMPACT

**Location:** `src/render/flow-renderer.ts:1083-1111`

The renderer DOES have 12-pass label-label collision avoidance (lines 1083-1111). It works, but its effectiveness is limited because:
- **Initial placement at geometric midpoints** puts many labels in the same area when a hub node has 4+ edges
- The collision resolver pushes labels apart, but they can cascade into nodes or subgraph headers
- The resolver only shifts along X/Y axes; it doesn't redistribute labels along edge paths

This is visible in payment-flow (Checkout API: 7 edges, labels cluster in a 100px radius) and observability-stack (Vector node: fan-out to 3 targets with labels).

**Fix:** Before collision resolution, distribute labels along edge paths at evenly-spaced `t` values (e.g., t=0.3 for short edges, t=0.5 for long edges) based on the number of labeled edges at that hub. **~30-40 LOC.**

### 4. Subgraph padding too tight — MEDIUM IMPACT

**Location:** `src/layout/flow-layout.ts:103-105`

```
SUBGRAPH_PAD_X      = 16   →   should be 24-28
SUBGRAPH_PAD_BOTTOM = 16   →   should be 24-28
```

Content sits 16px from subgraph borders. Combined with the 1.5px border stroke and potential edge routing that hugs the edge, this creates visual cramping. The ascii-layout uses 28px for both, which feels significantly more comfortable.

**Fix:** Increase to 24 each. **2 LOC.**

### 5. Compact spacing preset too aggressive for labeled edges — LOW IMPACT

**Location:** `src/layout/flow-layout.ts:94`

`compact: nodeGap=12` leaves ~12px between adjacent nodes. Edge labels need ~20px vertical clearance (fontSizes.edgeLabel=12 + padding). Any compact diagram with edge labels will have the collision avoidance working overtime.

**Fix:** Change compact nodeGap from 12 to 18. **1 LOC.**

### 6. Font size + uppercase + letter-spacing amplification — LOW IMPACT

Not a bug, but a systemic pressure: `fontSizes.nodeLabel=13` + `letter-spacing: 0.12em` + uppercase rendering = labels are ~25% wider than naive `text.length * charWidth` suggests. The `nodeSizeForLabel()` function correctly accounts for this, so nodes are sized properly. But visually, the dense uppercase text makes tight gaps feel tighter than they are.

**No code fix recommended** — this is a design choice that looks great. Just be aware it amplifies the impact of tight spacing.

## LOC Estimates Summary

| Fix | LOC | Impact |
|-----|-----|--------|
| Increase DEFAULT_NODE_GAP (20→30) and DEFAULT_TB_LAYER_GAP (38→48) | 2 | HIGH |
| Fix CYLINDER_RIM (10→20) in both layout files | 2 | HIGH |
| Increase SUBGRAPH_PAD_X/BOTTOM (16→24) | 2 | MEDIUM |
| Increase compact nodeGap (12→18) | 1 | LOW |
| Smarter initial edge-label distribution along paths | 30-40 | MEDIUM |
| **Total for constant-only fixes** | **7** | **~80% of congestion** |

## Elegant Recommendation

**Apply the 7-LOC constant adjustment** — it requires zero algorithmic changes, no new functions, and brings flow-layout spacing into alignment with the proven ascii-layout values:

```diff
 // flow-layout.ts
-const DEFAULT_TB_LAYER_GAP = 38;
-const DEFAULT_NODE_GAP = 20;
+const DEFAULT_TB_LAYER_GAP = 48;
+const DEFAULT_NODE_GAP = 30;

-const SUBGRAPH_PAD_X = 16;
+const SUBGRAPH_PAD_X = 24;
-const SUBGRAPH_PAD_BOTTOM = 16;
+const SUBGRAPH_PAD_BOTTOM = 24;

 // In resolveSpacing():
-case 'compact':  return { nodeGap: 12, layerGap: 18, tbLayerGap: 28 };
+case 'compact':  return { nodeGap: 18, layerGap: 18, tbLayerGap: 32 };

 // In node sizing (both flow-layout.ts and ascii-layout.ts):
-const CYLINDER_RIM = 10;
+const CYLINDER_RIM = 20;
```

This solves the two highest-impact issues (spacing + cylinders), fixes ~80% of visible congestion, and the remaining 20% (hub edge-label cascade) can be addressed later with the smarter label distribution algorithm if needed.

**Why NOT more aggressive changes:**
- Global scaling / font size reduction would break the visual identity
- Post-layout expansion adds algorithmic complexity for marginal gain
- Minimum node dimensions are already well-handled by `nodeSizeForLabel()`
- The existing 12-pass edge-label collision resolver is solid — it just needs better initial positions, which the spacing increase partially provides by giving it more room to work
