# Baseline Evaluation (i0): ASCII-Guided Layout — Congestion & Text Overlap Focus

## 1. simple-3node

**Layout:** 3 nodes vertically (START circle → PROCESS rect → END circle). Canvas 178×312.

**Spacing analysis:**
- Gap between START bottom (y=114) and PROCESS top (y=152): **38px** — adequate
- Gap between PROCESS bottom (y=192) and END top (y=230): **38px** — adequate
- Node widths relative to canvas: circle diameter 64px in 178px canvas — good proportion
- Left/right margins: ~25px on each side — sufficient

**Congestion issues:** None significant.

**Text overlap issues:** None.

**Verdict:** Clean, simple diagram. Hard to mess up with only 3 nodes. Spacing is uniform and sufficient. No labels on edges means no overlap risk.

**Scores:** spacing=4 overlap=5 proportions=4 edges=5 quality=4 **subtotal=22/25**

---

## 2. checkout-flow

**Layout:** 7 nodes in a multi-row layout with a "Checkout Pipeline" group. Canvas 659.6×401.

**Spacing analysis:**
- SHOPPING CART bottom (y=90) to LOGIN/REGISTER top (y=128): **38px** — ok
- LOGIN/REGISTER bottom (y=187) to SHIPPING ADDRESS top (y=234.5): **47.5px** — ok but "Checkout Pipeline" label sits in this gap
- SHIPPING ADDRESS right edge (x=251.5) to PAYMENT left edge (x=281): **29.5px** — TIGHT
- Bottom row: ORDER CONFIRMATION (x=52–261), SEND EMAIL (x=298.8–432.8), INVENTORY DB (x=470.6–623.6) — three nodes spanning full width with only ~37px gaps

**Congestion issues:**
1. **Bottom row is cramped**: Three wide nodes (ORDER CONFIRMATION 209px, SEND EMAIL 134px, INVENTORY DB 153px) crammed into 660px with minimal breathing room
2. **SHIPPING ADDRESS to PAYMENT gap** (29.5px horizontal) is too tight — nodes nearly touch
3. **"Checkout Pipeline" group label** at y=182–206 overlaps LOGIN/REGISTER node bottom edge (y=187) by 5px — the label background rect starts inside the node's bounding area

**Text overlap issues:**
1. **CRITICAL: Edge from ORDER CONFIRMATION to INVENTORY DB passes through SEND EMAIL node** — SVG line from (261, 347) to (470.6, 341.3) cuts diagonally through SEND EMAIL (x=298.8–432.8, y=322–372). This is a severe edge-through-node collision.
2. **"Checkout Pipeline" label overlaps LOGIN/REGISTER** — label background at y=182 intrudes into the LOGIN/REGISTER node area (bottom at y=187)
3. **"update stock" text at y=307 sits on the routing polyline** that passes through y=305.5 — text and edge nearly coincide

**Scores:** spacing=3 overlap=2 proportions=3 edges=2 quality=2 **subtotal=12/25**

---

## 3. microservices

**Layout:** API GATEWAY fans to 3 services in "Backend Services" group, which connect to 3 data stores in "Data Layer" group, with NOTIFICATION below. Canvas 665×457.

**Spacing analysis:**
- API GATEWAY bottom (y=109) to Backend Services group top (y=113): **4px** — VERY TIGHT
- Backend Services group bottom (y=235) vs Data Layer group top (y=223): **OVERLAP by 12px** — groups collide
- Service nodes horizontal gaps: AUTH→USER 46.5px, USER→ORDER 46.5px — adequate
- Data store horizontal gaps: USERS DB→MESSAGE QUEUE 49px, MESSAGE QUEUE→ORDERS DB 48.5px — adequate
- MESSAGE QUEUE bottom (y=321) to NOTIFICATION top (y=389): **68px** — generous

**Congestion issues:**
1. **Group containers overlap by 12px** — Backend Services extends to y=235, Data Layer starts at y=223. The two group borders visually intersect, creating a messy double-border effect
2. **API GATEWAY sits only 4px above Backend Services group border** — node and group border nearly touch with no breathing room
3. **Services row tight within group** — the services fill most of the group width with ~46px gaps, leaving minimal margin to group borders

**Text overlap issues:**
1. **Overlapping group borders** create visual confusion where Backend Services bottom and Data Layer top intersect (y=223–235)
2. Group labels ("Backend Services", "Data Layer") are readable but positioned in areas where borders overlap

**Scores:** spacing=3 overlap=3 proportions=4 edges=3 quality=3 **subtotal=16/25**

---

## 4. auth-flow ⚠️ WORST PERFORMER

**Layout:** 5 nodes with numbered edge labels showing OAuth flow. Canvas 458×318.

**Spacing analysis:**
- CLIENT APP bottom (y=90) to IDENTITY PROVIDER top (y=110): **20px** — SEVERELY TIGHT
- IDENTITY PROVIDER bottom (y=160) to TOKEN SERVICE top (y=180): **20px** — SEVERELY TIGHT
- TOKEN SERVICE bottom (y=230) to TOKEN CACHE top (y=250): **20px** — SEVERELY TIGHT
- All vertical gaps are uniformly 20px, which is completely insufficient for a diagram with edge labels in every gap

**Congestion issues:**
1. **ALL vertical gaps are only 20px** — this is the minimum viable spacing and far too tight for labeled edges. Every gap is crammed with an edge, an arrowhead, and a label.
2. **"OAuth 2.0 / OIDC" annotation at y=90** crammed into the 20px gap between CLIENT APP and IDENTITY PROVIDER, competing with the "1. login" label
3. **Left column stacking** — CLIENT APP, IDENTITY PROVIDER, TOKEN SERVICE, TOKEN CACHE are stacked tightly on the left (x≈36–236) while PROTECTED API floats alone on the right (x=260–422) with vast empty space. Poor use of canvas width.
4. **Edge from CLIENT APP to PROTECTED API** (polyline at y=98) routed through the 20px gap between CLIENT APP and IDENTITY PROVIDER, crossing the "OAuth 2.0 / OIDC" text area

**Text overlap issues — ALL SEVERE:**
1. **"1. login" label (y=106–128) overlaps IDENTITY PROVIDER top (y=110)** — label background extends 18px into the node
2. **"2. issue JWT" label (y=150–172) overlaps IDENTITY PROVIDER bottom (y=160)** — label background extends 12px into the node
3. **"4. request + JWT" label (y=150–172) also overlaps IDENTITY PROVIDER bottom** — same y-range as "2. issue JWT", both labels intrude into the node
4. **"3. store" label (y=220–242) overlaps TOKEN SERVICE bottom (y=230)** — label background extends 10px into the node
5. **"5. validate" label (y=220–242) overlaps TOKEN SERVICE bottom** — same issue
6. **"OAuth 2.0 / OIDC" at y=90** collides with CLIENT APP bottom edge and the "1. login" label area

Every single edge label in this diagram overlaps a node border. The 20px gaps make it impossible to fit labels without collision.

**Scores:** spacing=1 overlap=1 proportions=2 edges=2 quality=1 **subtotal=7/25**

---

## 5. data-pipeline

**Layout:** 2 data sources → INGEST WORKERS → SPARK TRANSFORM → SNOWFLAKE DW → 2 outputs, wrapped in "ETL Pipeline" group. Canvas 565×423.

**Spacing analysis:**
- POSTGRES effective bottom (~y=100) to INGEST WORKERS top (y=128): **28px** — tight
- INGEST WORKERS bottom (y=187) to SPARK TRANSFORM top (y=215): **28px** — tight, with "raw events" label in this gap
- SPARK TRANSFORM bottom (y=265) to SNOWFLAKE DW top (y=293): **28px** — tight
- SNOWFLAKE DW bottom (y=343) to DASHBOARD/ALERTING top (y=371): **28px** — tight but label-free
- POSTGRES right edge (x=168) to S3 BUCKET left edge (x=225): **57px** — adequate

**Congestion issues:**
1. **Uniform 28px vertical gaps** are tight but functional — better than auth-flow's 20px but still cramped
2. **"raw events" label** in the 28px gap between INGEST WORKERS (bottom y=187) and SPARK TRANSFORM (top y=215) leaves only ~7px clearance above SPARK TRANSFORM
3. **ETL Pipeline group is narrow** (w=213) relative to its contents — SPARK TRANSFORM (w=181) fills 85% of the group width, leaving only 16px margin on each side
4. **POSTGRES cylinder positioned outside the group** (its center at x=110.5 is left of group left edge x=181) — data sources visually float outside the container they feed into

**Text overlap issues:**
1. **"raw events" label background (y=185.4–207.4)** starts within ~1.6px of INGEST WORKERS bottom (y=187) — nearly touching/overlapping
2. **"ETL Pipeline" group label (y=85–109)** overlaps with S3 BUCKET cylinder body area (y=60–90) by 5px vertically
3. **"Batch: every 15 min" annotation** at (398, 240) is outside the group to the right — no overlap but visually disconnected

**Scores:** spacing=3 overlap=3 proportions=4 edges=3 quality=3 **subtotal=16/25**

---

## Summary

| Scenario | Spacing | Overlap | Proportions | Edges | Quality | Subtotal |
|---|---|---|---|---|---|---|
| simple-3node | 4 | 5 | 4 | 5 | 4 | 22/25 |
| checkout-flow | 3 | 2 | 3 | 2 | 2 | 12/25 |
| microservices | 3 | 3 | 4 | 3 | 3 | 16/25 |
| auth-flow | 1 | 1 | 2 | 2 | 1 | 7/25 |
| data-pipeline | 3 | 3 | 4 | 3 | 3 | 16/25 |
| **TOTAL** | | | | | | **73/125** |

## Top Issues to Fix (Priority Order)

1. **auth-flow: 20px vertical gaps are catastrophically tight** — need at minimum 50px gaps when edge labels are present
2. **auth-flow: ALL edge labels overlap node borders** — every single label intrudes into a node
3. **checkout-flow: edge from ORDER CONFIRMATION to INVENTORY DB passes through SEND EMAIL node** — edge-through-node collision
4. **microservices: group containers overlap by 12px** — Backend Services and Data Layer borders intersect
5. **checkout-flow: "Checkout Pipeline" label overlaps LOGIN/REGISTER** node bottom
6. **data-pipeline: 28px gaps are too tight for labeled edges** — "raw events" label nearly touches node borders
7. **General: spacing should scale with content density** — diagrams with edge labels need larger gaps than label-free diagrams
