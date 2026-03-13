# Phase 1 Review: Findings & Fixes

## Files Reviewed
- `src/render/theme.ts` — color constants, opacity, fonts, spacing, stroke widths
- `src/render/patterns.ts` — SVG pattern defs (dotgrid, crosshatch, hero) + arrow markers
- `src/render/shapes.ts` — rect, pill, cylinder, doubleBorder, actor, annotation, card, codeBlock
- `src/render/icons.ts` — 12 hand-authored SVG icons (24x24, stroke-based)
- `src/render/edges.ts` — straightEdge, polylineEdge, biEdge, edgeLabel, numberedCircle
- `src/layout/text-measure.ts` — character-width-based text measurement for mono/sans fonts
- `src/render/primitives-test.ts` — visual test harness rendering all primitives

## Reference Images Examined (11 total)
All images in `examples/reference/` were compared against the rendered output for color accuracy, pattern appearance, shape correctness, and overall visual fidelity.

## Bugs Found & Fixed

### Bug 1: `straightEdge` and `polylineEdge` silently ignore `markerStart` (CRITICAL)
**File:** `src/render/edges.ts`
**Problem:** Both functions destructured `markerEnd` from opts but never `markerStart`. This meant `biEdge()` was completely broken — it called `straightEdge` with `markerStart: 'url(#arrowhead-reverse)'` but the parameter was silently discarded. Bidirectional arrows would render as unidirectional.
**Fix:** Added `markerStart` to destructuring and wired it into the SVG `marker-start` attribute for both `straightEdge` and `polylineEdge`.

### Bug 2: Return arrow in primitives-test uses wrong marker
**File:** `src/render/primitives-test.ts`
**Problem:** The right-to-left "SHELL COMMANDS" return arrow used `markerEnd: 'url(#arrowhead-reverse)'`. Because `orient="auto"` rotates markers to match line direction, the reverse marker (which already points left in local coords) got rotated 180° at the end of a left-going line, producing a **right-pointing** arrowhead — the exact opposite of what's intended.
**Fix:** Changed to use the default `markerEnd: 'url(#arrowhead)'` — the regular arrowhead with `orient="auto"` correctly points left at the end of a right-to-left line.

### Bug 3: Crosshatch pattern opacity too low
**File:** `src/render/theme.ts`
**Problem:** Crosshatch opacity was 0.15, making it nearly invisible in rendered output. Reference images show crosshatch as subtle but clearly discernible on container nodes.
**Fix:** Bumped `opacity.crosshatch` from 0.15 to 0.20.

## Items Verified Correct (No Changes Needed)

- **Colors:** `#b4f079` accent, `#3d6b23` hero fill, `#000000` background — all match references
- **Dotgrid pattern:** 8x8 grid, r=0.8 dots at 0.7 opacity — good visibility, matches reference
- **Hero pattern:** 6x6 grid, r=0.6 dots on #3d6b23 fill — matches the dark green + subtle dot appearance
- **Double-border:** Correct two-nested-rect approach with 4px gap, 2px outer / 1px inner stroke
- **Cylinder:** Top ellipse + body rect + bottom half-arc — proportions look correct
- **Actor/stick figure:** Circle head, body, arms, legs — matches reference style
- **Arrow markers:** Filled triangle polygons with correct refX/refY and orient=auto
- **All 12 icons:** Valid SVG paths, recognizable shapes (doc, person, brain, target, chain-broken, eye, gear, code, database, cloud, lock, arrow-loop)
- **Text measurement:** Correct mono (0.6 ratio) and per-character sans widths, handles multi-line via split('\n'), accounts for letter-spacing in nodeSizeForLabel
- **Cards:** Dark bg (#111111), gray border, white title, gray body, icon slot — matches reference "limits of agent knowledge" image
- **Code block:** Monospace green on dark card — matches reference style
- **Annotations:** Italic, reduced opacity, sans-serif — matches reference style
- **Edge labels:** Background pill for readability, correct positioning at midpoint
- **Numbered circles:** Green filled circles with bold white numbers — matches reference
