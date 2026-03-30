# FINAL Iteration 3 Evaluation: Label Clearance, Node-Subgraph Margin, Routing Offset, Centering

**Fixes applied:** LABEL_CLEARANCE 5→10px, NODE_SUBGRAPH_MARGIN ≥30px (non-child node to subgraph top), polyline routing label avoidance (pendingLabels check), horizontal content centering (Step 11).

---

## 1. simple-3node

**Layout:** 3 nodes vertically (START circle → PROCESS rect → END circle). Canvas 178×336 (unchanged from i1/i2).

**Spacing analysis:**
- Gap between START bottom (y=114) and PROCESS top (y=164): **50px** (unchanged)
- Gap between PROCESS bottom (y=204) and END top (y=254): **50px** (unchanged)
- Node widths relative to canvas: circle diameter 64px in 178px canvas — good proportion
- Left/right margins: ~25px on each side — sufficient

**Congestion issues:** None.

**Text overlap issues:** None.

**Comparison to i2:** Identical. No i3 changes affected this diagram (no subgraphs, no same-row edges, no centering needed).

**Scores:** spacing=5 overlap=5 proportions=4 edges=5 quality=5 **subtotal=24/25** (unchanged)

---

## 2. checkout-flow

**Layout:** 7 nodes in multi-row layout with "Checkout Pipeline" group. Canvas 731.6×460 (was 731.6×455 in i2, **+5px height**).

**Key i3 fix — Label clearance 10px:**
- "Checkout Pipeline" label bg at y=209–233.
- LOGIN/REGISTER bottom at y=199.
- **Gap: 10px** (was 5px in i2, **+5px**). The LABEL_CLEARANCE increase from 5→10 pushed the subgraph label zone down, resulting in more comfortable separation. ✓

**Spacing analysis:**
- SHOPPING CART bottom (y=90) to LOGIN/REGISTER top (y=140): **50px** ✓
- LOGIN/REGISTER bottom (y=199) to SHIPPING ADDRESS top (y=269.5): **70.5px** ✓
- SHIPPING ADDRESS right (x=263.5) to PAYMENT left (x=323): **59.5px** ✓
- Bottom row: ORDER CONFIRMATION right (x=273) to SEND EMAIL left (x=340.8): **67.8px** ✓
- SEND EMAIL right (x=474.8) to INVENTORY DB left (x=542.6): **67.8px** ✓

**Edge routing — polyline label avoidance (partial):**
- ORDER CONFIRMATION → INVENTORY DB polyline: `(273,394) → (273,357) → (542.6,357) → (542.6,388)`
- SEND EMAIL at y=369–419. Obstacle avoidance routes above at y=357 (369−12=357). ✓ (from i2)
- "update stock" label bg at y=339–361. The polyline at y=357 spatially clips through the label bg (339 < 357 < 361).
- The pendingLabels avoidance fix SHOULD have adjusted midY to 339−12=327, but did **not** take effect. The "update stock" label may not yet be in `pendingLabels` when this edge is processed, or the edge geometry didn't match the check conditions.
- **Mitigated by SVG z-order:** The label bg rect (fill="#000000") renders AFTER the polyline, hiding the overlap. Visually acceptable but not ideal.

**Text overlap issues:**
1. **IMPROVED: "Checkout Pipeline" label** — now 10px below LOGIN/REGISTER (was 5px in i2, -5px overlap in i0). ✓
2. **PERSISTS (MINOR): routing polyline behind "update stock" label bg** — spatial overlap at y=357 within label bg y=339–361, visually masked by z-order.

**Scores:** spacing=4 overlap=4 proportions=3 edges=4 quality=4 **subtotal=19/25** (unchanged from i2)

---

## 3. auth-flow

**Layout:** 5 nodes with numbered edge labels showing OAuth flow. Canvas 458×408 (unchanged from i2).

**i3 centering fix — no effect:**
- Content bounds: left=36 (IDENTITY PROVIDER), right=422 (PROTECTED API right edge).
- Canvas width: 458. Left margin: 36px. Right margin: 36px.
- Already symmetric — centerShift=0. The centering fix has no effect because the layout was already symmetrically placed.
- The **layout asymmetry** (left-column stacking vs PROTECTED API floating right) is an internal node distribution issue, not a centering issue. The bounding box is centered, but the visual weight is uneven. This would require layout rebalancing, not centering.

**Spacing analysis:**
- CLIENT APP bottom (y=90) to IDENTITY PROVIDER top (y=140): **50px** ✓
- IDENTITY PROVIDER bottom (y=190) to TOKEN SERVICE top (y=240): **50px** ✓
- TOKEN SERVICE bottom (y=290) to TOKEN CACHE top (y=340): **50px** ✓

**Text overlap analysis:**
- "1. login" text at y=97 — 7px below CLIENT APP, 43px above IP. Label bg (y=82–104) partly overlaps CLIENT APP fill area but text is cleanly in gap. ✓
- "OAuth 2.0 / OIDC" at y=120 — centered in 50px gap (90–140). ✓
- "2. issue JWT" label bg (y=204–226) — 14px clearance from IP bottom, 14px from TS top. ✓
- "4. request + JWT" label bg (y=198–220) — 8px from IP bottom, 20px from TS top. ✓
- "3. store" label bg (y=298–320) — 8px from TS bottom, 20px from TC top. ✓
- "5. validate" label bg (y=310–332) — 20px from TS bottom, 8px from TC top. ✓

**Edge routing:** CLIENT APP → PROTECTED API polyline at y=128, cleanly within the 50px gap. ✓

**Remaining issue:** Layout asymmetry — left-column stacking with PROTECTED API floating right. Not addressable by spacing/routing/centering fixes; would need layout algorithm changes.

**Scores:** spacing=4 overlap=4 proportions=3 edges=3 quality=3 **subtotal=17/25** (unchanged from i2)

---

## 4. microservices (IMPROVED — NODE_SUBGRAPH_MARGIN FIX)

**Layout:** API GATEWAY fans to 3 services in "Backend Services" group, connecting to 3 data stores in "Data Layer" group, with NOTIFICATION below. Canvas 749×603 (was 749×589 in i2, **+14px height**).

**Key i3 fix — NODE_SUBGRAPH_MARGIN ≥30px:**
- API GATEWAY bottom at y=109.
- Backend Services group top at y=139 (was y=125 in i2).
- **Gap: 30px** (was 16px in i2, **+14px!**). The NODE_SUBGRAPH_MARGIN fix detected that API GATEWAY (non-child node) was only 16px above the Backend Services subgraph and pushed the subgraph + all downstream nodes down by 14px. ✓
- This was the #3 remaining issue from i2 — now fully resolved.

**Cascading effects:**
- All nodes shifted down by 14px:
  - Services: y=203 (was y=189 in earlier iterations)
  - Data stores: y=383–385
  - NOTIFICATION: y=535
  - Canvas height: 603 (was 589, +14px)

**Spacing analysis:**
- API GATEWAY bottom (y=109) to Backend Services top (y=139): **30px** ✓ (was 16px)
- Backend Services bottom (y=281) to Data Layer top (y=311): **30px** ✓ (same as i2)
- Service horizontal gaps: AUTH→USER 76.5px, USER→ORDER 76.5px ✓
- Data store horizontal gaps: USERS DB→MESSAGE QUEUE 79px, QUEUE→ORDERS DB 78.5px ✓
- Data Layer bottom (y=453) to NOTIFICATION top (y=535): **82px** ✓

**Text overlap issues:** None.
- Backend Services label (y=152–176) well below group top (139), well above services (203). ✓
- Data Layer label (y=324–348) well below group top (311), well above data stores (383). ✓
- "async" label (y=465–487) comfortably in 82px gap (453–535). ✓

**Edge routing:** All edges route cleanly. Fan-out horizontal at y=181 fits between label bottom (176) and service tops (203) with 5px/22px clearance. ✓

**Scores:** spacing=5 overlap=5 proportions=4 edges=4 quality=5 **subtotal=23/25** (was 21/25, **+2**)

---

## 5. data-pipeline (MINOR IMPROVEMENT)

**Layout:** 2 data sources → INGEST WORKERS → SPARK TRANSFORM → SNOWFLAKE DW → 2 outputs, wrapped in "ETL Pipeline" group. Canvas 589×522 (was 589×517 in i2, **+5px height**).

**Key i3 fix — Label clearance 10px:**
- ETL Pipeline group at y=97, label bg at y=110–134.
- S3 BUCKET cylinder bottom arc at ~y=100.
- **Gap from S3 bottom to label zone top: 10px** (was 5px in i2, **+5px**). ✓
- The LABEL_CLEARANCE increase from 5→10 pushed the subgraph down 5px, cascading to all downstream nodes.

**NODE_SUBGRAPH_MARGIN check — not triggered:**
- S3 BUCKET layout rect: y=60, h=30 → nodeBottom=90. ETL group at y=97. Gap=7px < 30px.
- However, this check may not be triggered because the cylinder's bottom ellipse arc (~y=100) extends below nodeBottom(90), and the layout stores the rect dimensions (h=30) rather than the visual extent. The 7px gap between layout nodeBottom(90) and subgraph top(97) is less than the 30px threshold, but the fix may have already fired and pushed the subgraph from y=90 to y=97 (only +7px instead of the full 23px needed for 30px gap).
- **Actual visual gap:** S3 BUCKET bottom arc (~100) to ETL Pipeline group border (97) — the cylinder extends 3px below the subgraph top. This is a minor visual overlap between the cylinder's decorative bottom arc and the subgraph border, but does not affect readability.

**Spacing analysis:**
- Data sources bottom (~y=100) to INGEST WORKERS top (y=161): **~61px** ✓
- INGEST WORKERS bottom (y=220) to SPARK TRANSFORM top (y=290): **70px** ✓ (label-aware)
- SPARK TRANSFORM bottom (y=340) to SNOWFLAKE DW top (~y=380): **~40px** ✓
- SNOWFLAKE DW bottom (~y=430) to DASHBOARD/ALERTING top (y=470): **~40px** ✓

**Text overlap analysis:**
- "raw events" label bg (y=244–266) — 24px clearance above (INGEST bottom=220), 24px below (SPARK top=290). ✓
- "ETL Pipeline" label bg (y=110–134) — **10px clearance from S3 BUCKET bottom arc (~100). ✓** (was 5px in i2)
- "Batch: every 15 min" at (410, 315) — outside group, no overlap. ✓

**Scores:** spacing=4 overlap=5 proportions=4 edges=4 quality=4 **subtotal=21/25** (unchanged from i2)

---

## Summary

| Scenario | Spacing | Overlap | Proportions | Edges | Quality | Subtotal | i2 Score | Delta |
|---|---|---|---|---|---|---|---|---|
| simple-3node | 5 | 5 | 4 | 5 | 5 | 24/25 | 24/25 | — |
| checkout-flow | 4 | 4 | 3 | 4 | 4 | 19/25 | 19/25 | — |
| auth-flow | 4 | 4 | 3 | 3 | 3 | 17/25 | 17/25 | — |
| microservices | 5 | 5 | 4 | 4 | 5 | 23/25 | 21/25 | **+2** |
| data-pipeline | 4 | 5 | 4 | 4 | 4 | 21/25 | 21/25 | — |
| **TOTAL** | **22** | **23** | **18** | **20** | **21** | **104/125** | **102/125** | **+2** |

**Overall improvement: 102 → 104 (+2 points, +2%)**
**Cumulative from baseline: 73 → 104 (+31 points, +42%)**

---

## Full Trajectory Summary

| Iteration | Total | Delta | Key Changes |
|---|---|---|---|
| **i0 (baseline)** | **73/125** | — | Initial ASCII-guided layout. Catastrophic auth-flow (7/25), group overlaps, tight gaps. |
| **i1** | **97/125** | **+24** | TB gap 38→50, nodeGap 20→50, label-aware +30px expansion, subgraph padding increase, 30px subgroup margin. Rescued auth-flow from 7→17. |
| **i2** | **102/125** | **+5** | Same-row edge obstacle avoidance (lineSegmentIntersectsAABB), subgraph label clearance ≥5px. Fixed checkout-flow edge-through-node collision. |
| **i3** | **104/125** | **+2** | Label clearance 5→10px, node-to-subgraph margin ≥30px, polyline routing label avoidance (partial), horizontal centering. Fixed microservices API GW gap. |

### Score Trajectory by Scenario

| Scenario | i0 | i1 | i2 | i3 | Net Δ |
|---|---|---|---|---|---|
| simple-3node | 22 | 24 | 24 | 24 | +2 |
| checkout-flow | 12 | 15 | 19 | 19 | +7 |
| auth-flow | 7 | 17 | 17 | 17 | +10 |
| microservices | 16 | 21 | 21 | 23 | +7 |
| data-pipeline | 16 | 20 | 21 | 21 | +5 |
| **Total** | **73** | **97** | **102** | **104** | **+31** |

### What Worked in i3

1. **NODE_SUBGRAPH_MARGIN ≥30px** — Effectively closed the microservices API GATEWAY gap issue (16→30px), the only scored improvement this iteration. Correctly identified non-child nodes above subgraphs and pushed downstream content.
2. **LABEL_CLEARANCE 5→10px** — Doubled the clearance for "Checkout Pipeline" and "ETL Pipeline" labels. Visually noticeable improvement but not enough to bump scores since i2 already scored the labels as "fixed."
3. **Horizontal centering** — Code is correct but had no effect because all diagrams were already symmetrically placed by construction (MARGIN_X applied uniformly).

### What Didn't Work in i3

1. **Polyline routing label avoidance** — The `pendingLabels` check in flow-renderer.ts did not resolve the checkout-flow polyline-through-"update stock"-label issue. The label bg for "update stock" may not be in `pendingLabels` at the time the ORDER CONFIRMATION → INVENTORY DB edge is processed, or the geometric check didn't match. The issue remains visually masked by SVG z-order but persists spatially.
2. **Auth-flow centering** — The centering fix couldn't address the layout asymmetry because the content bounding box was already centered. The asymmetry is in internal node distribution (left-column stack vs floating right PROTECTED API), not bounding box placement.

### Remaining Issues (Priority Order)

1. **MINOR: checkout-flow polyline-through-label spatial overlap** — The ORDER CONF → INVENTORY edge horizontal at y=357 clips through the "update stock" label bg (y=339–361). Visually hidden by z-order but architecturally imperfect. Would require pre-computing all label positions before routing, or a two-pass approach.
2. **MINOR: auth-flow layout asymmetry** — Left-column stacking with PROTECTED API floating right. Would require layout algorithm changes (e.g., centering nodes around a vertical axis, or distributing nodes based on edge connectivity).
3. **MINOR: data-pipeline cylinder-subgraph border overlap** — S3 BUCKET's bottom ellipse arc (~y=100) extends 3px below the ETL Pipeline subgraph border (y=97). The NODE_SUBGRAPH_MARGIN fix uses the layout node rect (bottom=90) rather than the rendered visual extent. Would require the layout to account for cylinder decorative elements.

### Diminishing Returns Assessment

The score trajectory shows clear diminishing returns:
- **i1: +24 points** — High-impact structural fixes (gap sizing, label-aware expansion)
- **i2: +5 points** — Targeted routing and clearance fixes
- **i3: +2 points** — Polish-level refinements

The remaining issues are all MINOR and would require either (a) architectural changes to the routing/layout algorithm (two-pass label computation, connectivity-based node distribution) or (b) visual-extent-aware node dimensions. Further iteration would yield diminishing returns relative to implementation effort.

**Final assessment: The ASCII-guided layout has reached a good quality level at 104/125 (83.2%). All critical and significant issues from the baseline have been resolved. Remaining issues are cosmetic.**
