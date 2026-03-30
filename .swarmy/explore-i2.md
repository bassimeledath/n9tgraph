# Iteration 2 Evaluation: Edge Routing + Subgraph Label Clearance

**Fixes applied:** Same-row TB edge obstacle avoidance (lineSegmentIntersectsAABB check, route above/below blocking node with 12px clearance), subgraph label clearance ≥5px (Step 8a pushes subgraph + downstream nodes when non-child node bottom intrudes into label zone).

---

## 1. simple-3node

**Layout:** 3 nodes vertically (START circle → PROCESS rect → END circle). Canvas 178×336 (unchanged from i1).

**Spacing analysis:**
- Gap between START bottom (y=114) and PROCESS top (y=164): **50px** (same as i1)
- Gap between PROCESS bottom (y=204) and END top (y=254): **50px** (same as i1)
- Node widths relative to canvas: circle diameter 64px in 178px canvas — good proportion
- Left/right margins: ~25px on each side — sufficient

**Congestion issues:** None.

**Text overlap issues:** None.

**Comparison to i1:** Identical. No i2 changes affected this diagram.

**Scores:** spacing=5 overlap=5 proportions=4 edges=5 quality=5 **subtotal=24/25** (unchanged)

---

## 2. checkout-flow (MAJOR IMPROVEMENT — CRITICAL BUG FIXED)

**Layout:** 7 nodes in multi-row layout with "Checkout Pipeline" group. Canvas 731.6×455 (was 731.6×449 in i1, +6px height from label clearance adjustment).

**Spacing analysis:**
- SHOPPING CART bottom (y=90) to LOGIN/REGISTER top (y=140): **50px** (same as i1)
- LOGIN/REGISTER bottom (y=199) to SHIPPING ADDRESS top (y=264.5): **65.5px** (same as i1)
- SHIPPING ADDRESS right (x=263.5) to PAYMENT left (x=323): **59.5px** (same as i1)
- Bottom row gaps: ORDER CONFIRMATION right (x=273) to SEND EMAIL left (x=340.8): **67.8px**, SEND EMAIL right (x=474.8) to INVENTORY DB left (x=542.6): **67.8px** (same as i1)

**Key i2 fix — Edge obstacle avoidance:**
- **FIXED: ORDER CONFIRMATION → INVENTORY DB edge no longer passes through SEND EMAIL!**
- Old (i0/i1): Straight line from (273, 389) to (542.6, 389) cutting diagonally through SEND EMAIL's bounding box (x=340.8–474.8, y=364–414). This was the #1 CRITICAL issue.
- New (i2): Polyline routes (273, 389) → (273, 352) → (542.6, 352) → (542.6, 383.3). The edge goes UP from ORDER CONFIRMATION to y=352, traverses horizontally **12px above SEND EMAIL** (top=364), then descends to INVENTORY DB.
- The obstacle avoidance correctly identified SEND EMAIL as blocking and routed above it.

**Key i2 fix — Subgraph label clearance:**
- "Checkout Pipeline" label bg at y=204–228.
- LOGIN/REGISTER bottom at y=199.
- **Gap: 5px** (was 1px in i1, was -5px overlap in i0). The label clearance fix pushed the subgraph down to ensure ≥5px clearance. ✓

**Minor issue — routing polyline clips through "update stock" label bg:**
- The ORDER CONFIRMATION → INVENTORY DB polyline horizontal at y=352 passes through the "update stock" label bg (y=334–356, x=359.8–455.8).
- However, the label bg rect (black fill) is rendered AFTER the polyline in SVG z-order, so the line appears to go "behind" the label. Visually acceptable but not ideal.

**Text overlap issues:**
1. **FIXED: Edge-through-node collision** — the #1 critical issue from i0/i1 is completely resolved
2. **IMPROVED: "Checkout Pipeline" label** — now 5px below LOGIN/REGISTER (was 1px in i1, was 5px overlap in i0)
3. **MINOR: routing polyline behind "update stock" label** — cosmetic, line hidden behind label bg

**Scores:** spacing=4 overlap=4 proportions=3 edges=4 quality=4 **subtotal=19/25** (was 15/25, **+4**)

---

## 3. auth-flow

**Layout:** 5 nodes with numbered edge labels showing OAuth flow. Canvas 458×408 (unchanged from i1).

**Spacing analysis:**
- CLIENT APP bottom (y=90) to IDENTITY PROVIDER top (y=140): **50px** (same as i1)
- IDENTITY PROVIDER bottom (y=190) to TOKEN SERVICE top (y=240): **50px** (same as i1)
- TOKEN SERVICE bottom (y=290) to TOKEN CACHE top (y=340): **50px** (same as i1)

**Text overlap analysis:**
- "1. login" text at y=97 — 7px below CLIENT APP, 43px above IP. Label bg (y=82–104) partly overlaps CLIENT APP fill area but text is cleanly in gap. ✓
- "OAuth 2.0 / OIDC" at y=120 — centered in 50px gap (90–140). ✓
- "2. issue JWT" label bg (y=204–226) — 14px clearance from IP bottom, 14px from TS top. ✓
- "4. request + JWT" label bg (y=198–220) — 8px from IP bottom, 20px from TS top. ✓
- "3. store" label bg (y=298–320) — 8px from TS bottom, 20px from TC top. ✓
- "5. validate" label bg (y=310–332) — 20px from TS bottom, 8px from TC top. ✓

**Edge routing:** CLIENT APP → PROTECTED API polyline at y=128, cleanly within the 50px gap. No collisions.

**Comparison to i1:** Identical. No i2 changes affected this diagram (no same-row edges, no non-child nodes near subgraph labels).

**Remaining issue:** Layout asymmetry — left-column stacking with PROTECTED API floating right. This is a proportions issue, not addressable by spacing/routing fixes.

**Scores:** spacing=4 overlap=4 proportions=3 edges=3 quality=3 **subtotal=17/25** (unchanged)

---

## 4. microservices

**Layout:** API GATEWAY fans to 3 services in "Backend Services" group, connecting to 3 data stores in "Data Layer" group, with NOTIFICATION below. Canvas 749×589 (unchanged from i1).

**Spacing analysis:**
- API GATEWAY bottom (y=109) to Backend Services top (y=125): **16px** (same as i1)
- Backend Services bottom (y=267) to Data Layer top (y=297): **30px** ✓ (same as i1)
- Service horizontal gaps: AUTH→USER 76.5px, USER→ORDER 76.5px ✓
- Data store horizontal gaps: USERS DB→MESSAGE QUEUE 79px, QUEUE→ORDERS DB 78.5px ✓
- Data Layer bottom (y=439) to NOTIFICATION top (y=521): **82px** ✓

**Text overlap issues:** None.
- Backend Services label (y=138–162) well below group top (125), well above services (189). ✓
- Data Layer label (y=310–334) well below group top (297), well above data stores (369). ✓
- "async" label (y=451–473) comfortably in 82px gap. ✓

**Edge routing:** All edges route cleanly. No same-row edge collisions.

**Comparison to i1:** Identical. No i2 changes affected this diagram.

**Remaining issue:** API GATEWAY to Backend Services gap (16px) is functional but snug.

**Scores:** spacing=4 overlap=5 proportions=4 edges=4 quality=4 **subtotal=21/25** (unchanged)

---

## 5. data-pipeline (MINOR IMPROVEMENT)

**Layout:** 2 data sources → INGEST WORKERS → SPARK TRANSFORM → SNOWFLAKE DW → 2 outputs, wrapped in "ETL Pipeline" group. Canvas 589×517 (was 589×501 in i1, **+16px height** from label clearance adjustment).

**Key i2 fix — Subgraph label clearance:**
- S3 BUCKET cylinder bottom arc at ~y=100.
- ETL Pipeline group starts at y=92, label bg at y=105–129.
- In i1, the label bg top (y=89 in i1) was ~1px below S3 BUCKET body line — minor overlap with cylinder arc.
- In i2, the label bg top is at y=105, providing **5px clearance** from S3 BUCKET bottom (~100). ✓
- The clearance fix pushed the subgraph (and all nodes below) down, increasing canvas height by 16px.

**Spacing analysis:**
- Data sources (~y=100) to INGEST WORKERS top (y=156): **~56px** (was ~40px in i1, +16px from clearance cascade)
- INGEST WORKERS bottom (y=215) to SPARK TRANSFORM top (y=285): **70px** ✓ (same as i1 — label-aware expansion)
- SPARK TRANSFORM bottom (y=335) to SNOWFLAKE DW top (y=385): **50px** (was 40px in i1, +10px from cascade)
- SNOWFLAKE DW bottom (~y=425) to DASHBOARD/ALERTING top (y=465): **~40px** (same as i1)

**Text overlap analysis:**
- "raw events" label bg (y=239–261) — 24px clearance above (from INGEST bottom=215), 24px below (to SPARK top=285). ✓
- "ETL Pipeline" label bg (y=105–129) — **5px clearance from S3 BUCKET bottom (~100). FIXED.** (was ~1px in i1)
- "Batch: every 15 min" at (410, 310) — outside group, no overlap. ✓

**Scores:** spacing=4 overlap=5 proportions=4 edges=4 quality=4 **subtotal=21/25** (was 20/25, **+1**)

---

## Summary

| Scenario | Spacing | Overlap | Proportions | Edges | Quality | Subtotal | i1 Score | Delta |
|---|---|---|---|---|---|---|---|---|
| simple-3node | 5 | 5 | 4 | 5 | 5 | 24/25 | 24/25 | — |
| checkout-flow | 4 | 4 | 3 | 4 | 4 | 19/25 | 15/25 | **+4** |
| auth-flow | 4 | 4 | 3 | 3 | 3 | 17/25 | 17/25 | — |
| microservices | 4 | 5 | 4 | 4 | 4 | 21/25 | 21/25 | — |
| data-pipeline | 4 | 5 | 4 | 4 | 4 | 21/25 | 20/25 | **+1** |
| **TOTAL** | **21** | **23** | **18** | **20** | **20** | **102/125** | **97/125** | **+5** |

**Overall improvement: 97 → 102 (+5 points, +5%)**
**Cumulative from baseline: 73 → 102 (+29 points, +40%)**

## What Worked Well

1. **Same-row edge obstacle avoidance** — The `lineSegmentIntersectsAABB` check correctly identified SEND EMAIL as blocking the ORDER CONFIRMATION → INVENTORY DB edge and routed a polyline 12px above it. This resolved the #1 CRITICAL issue from i0/i1.
2. **Subgraph label clearance ≥5px** — Both "Checkout Pipeline" and "ETL Pipeline" labels now have guaranteed minimum 5px clearance from non-child nodes. The cascading push-down correctly shifted all downstream nodes.
3. **Targeted fixes** — Only diagrams with the specific issues were affected; diagrams that were already clean (simple-3node, auth-flow, microservices) remained unchanged.

## Remaining Issues (Priority Order)

1. **MINOR: checkout-flow routing polyline clips through "update stock" label bg** — The polyline horizontal at y=352 passes through the "update stock" label bg (y=334–356). Visually hidden behind the black bg rect (SVG z-order), but the line path and label overlap spatially. Could be addressed by offsetting the route higher (y < 334) or relocating the label.
2. **MINOR: auth-flow layout asymmetry** — Left-column stack with PROTECTED API floating right. Not a spacing/routing issue; would need layout rebalancing.
3. **MINOR: microservices API GATEWAY to Backend Services gap** — Only 16px. Functional but could be more generous.
4. **MINOR: checkout-flow "Checkout Pipeline" label** — Exactly 5px clearance (minimum threshold). Could benefit from more breathing room.

## Iteration Assessment

The i2 fixes were **surgical and effective**. The two targeted changes — edge obstacle avoidance and label clearance — addressed the most impactful remaining issues without regression. The checkout-flow diagram went from having a critical routing defect (edge passing through a node) to clean routing with proper obstacle avoidance. All remaining issues are cosmetic/minor.

The score trajectory (73 → 97 → 102) shows diminishing returns as expected — the high-impact structural issues (gap sizing, label-aware expansion, group separation) were addressed in i1, and i2 cleaned up the routing and label clearance edge cases. Further improvements would require addressing layout proportions (auth-flow asymmetry) or fine-tuning polyline routing offsets.
