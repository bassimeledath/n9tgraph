# Light Mode Renders + Custom Accent Color Investigation

## 1. Light Mode Renders

All 5 `bench/ascii-guided/*.json` diagrams rendered with `"theme":"white"` to SVG + PNG.

**Output location:** `/Users/bassime/Downloads/n9tgraph-light-mode/`

| Diagram | SVG | PNG |
|---|---|---|
| simple-3node | simple-3node.svg | simple-3node.png |
| auth-flow | auth-flow.svg | auth-flow.png |
| checkout-flow | checkout-flow.svg | checkout-flow.png |
| data-pipeline | data-pipeline.svg | data-pipeline.png |
| microservices | microservices.svg | microservices.png |

Render script: `src/render-light-mode.ts` (temporary, can be deleted).

The white theme works via `applyWhiteTheme()` in `src/render/svg.ts` — a post-render regex replacement of all 10 hardcoded hex colors to their light-mode equivalents.

---

## 2. Accent Color Audit

### 2.1 The Accent Color Family

The primary accent `#b4f079` (lime green) appears in `theme.ts` and propagates to 6 named color constants that form a family:

| Constant | Hex | Role | Derived from accent? |
|---|---|---|---|
| `accent` | `#b4f079` | Primary accent — borders, labels, arrows | **Root** |
| `accentDim` | `#7aa84f` | Secondary emphasis — dimmer accent | Darkened variant |
| `nodeBorder` | `#b4f079` | Node stroke (same as accent) | Alias |
| `annotationColor` | `#b4f079` | Annotation text (same as accent) | Alias |
| `subgraphBadgeFill` | `#b4f079` | Badge pill fill (same as accent) | Alias |
| `heroFill` | `#3d6b23` | Service node pattern background | Dark saturated variant |
| `heroDot` | `#5a9a35` | Service node pattern dot | Mid-saturated variant |
| `edgeDim` | `#7aa84f` | Edge dim color (same as accentDim) | Alias of accentDim |

**Non-accent neutrals** (bg, white, gray, dimGray, cardBg, cardBorder, cardText, subgraphLabelBg/Text, subgraphBadgeText, edgeMuted) are theme-structural and don't need to change with accent color.

### 2.2 Files That Reference Accent Colors

Every file that imports `colors` from `theme.ts` and uses accent-family values:

| File | Accent-family references | What they color |
|---|---|---|
| **theme.ts** | 6 constants defined | Source of truth |
| **patterns.ts** | `colors.accent` (3x), `colors.heroFill`, `colors.heroDot` | Dotgrid dots, crosshatch lines, hero pattern fill/dot, arrow markers (2x) |
| **flow-renderer.ts** | `colors.accent` (~15x), `colors.accentDim` (3x), `colors.nodeBorder` (1x), `colors.dimGray` (1x as emphasis) | Node borders, text labels, sublabels, subgraph borders, overflow dots, code blocks, annotations, badge fills |
| **edges.ts** | `colors.accent` (5x default params + inline) | Edge label text, edge label backgrounds, numbered circles |
| **shapes.ts** | `colors.nodeBorder` (3x default), `colors.accent` (2x inline), `colors.annotationColor` (1x), `colors.cardBg/Border` | Node shapes (rect, cylinder, doubleBorder), actor, annotation text, card backgrounds |
| **sequence-renderer.ts** | `colors.accent` (10x+), `colors.nodeBorder` (1x), `colors.annotationColor` (1x) | Sequence participant boxes, lifelines, arrows, loop borders, fragment labels/badges |
| **card-renderer.ts** | `colors.accent` (3x), `colors.cardBg/Border` | Card edge connections, subgraph borders |
| **icons.ts** | `colors.accent` (1x, aliased as `sc`) | Icon stroke color |
| **svg.ts** | `colors.bg` (1x), `applyWhiteTheme()` regex replaces all 10 hex values | SVG wrapper backgrounds, white theme post-processing |

### 2.3 The `applyWhiteTheme()` Post-Processing Approach

Currently in `svg.ts:41-68`, the white theme works by doing regex find-replace on the **final SVG string**, swapping all 10 dark-mode hex colors to light-mode equivalents. This is the only theming mechanism — there's no runtime color resolution, no CSS variables, no theme context object passed through the render pipeline.

**Implication:** Any custom accent color approach must either:
- (A) Modify the `colors` object before render (mutate-and-restore or clone), or
- (B) Extend the post-render regex replacement to also swap accent colors, or
- (C) Refactor to pass a resolved color palette through the render pipeline

---

## 3. Implementation Plan: Custom Accent Color

### Recommended Approach: (A) Pre-render palette override

Create a `resolveColors(accentOverride?: string)` function that:
1. Takes user-supplied accent hex (e.g. `#3b82f6` for blue)
2. Derives the full accent family algorithmically:
   - `accent` = user color
   - `accentDim` = desaturated/darkened by ~30%
   - `nodeBorder` = same as accent
   - `annotationColor` = same as accent
   - `subgraphBadgeFill` = same as accent
   - `heroFill` = darkened ~60%, increased saturation
   - `heroDot` = darkened ~40%
   - `edgeDim` = same as accentDim
3. Temporarily replaces the `colors` export values during render
4. Restores originals after render (or use a clone pattern)

### Changes Required

| File | Change | LOC estimate |
|---|---|---|
| `theme.ts` | Make `colors` a mutable `let` or export a `buildColors(accent?: string)` function; add HSL derivation logic | ~35 |
| `svg.ts` | Accept optional `accentColor` in `render()` and `renderFromGrid()`, call `buildColors()` before render | ~10 |
| `svg.ts` `applyWhiteTheme()` | Update to use dynamic accent hex instead of hardcoded `#b4f079` etc. | ~15 |
| `parser/ast.ts` | Add `accentColor?: string` to `FlowDiagram` type | ~2 |
| `layout/ascii-layout.ts` | Pass through `accentColor` from input | ~2 |
| `cli.ts` | Add `--accent <hex>` CLI flag | ~5 |
| `mcp-server.ts` | Accept `accentColor` in JSON input | ~3 |
| **Total** | | **~72 LOC** |

### Why Not (B) or (C)?

- **(B) Extending regex replacement:** Fragile — works for known hex values but breaks if accent appears in unexpected contexts (e.g. user content that coincidentally matches). Also doubles the maintenance burden of the replacement table.
- **(C) Full pipeline refactor:** Correct long-term but high LOC (~200+). Every `colors.accent` reference across 8 files would need to accept a runtime palette parameter. Overkill for a single accent color override.

### Key Risk

The `colors` object is imported as `{ colors }` in 8 files. If we make it mutable and swap values before render, this works in single-threaded Node but would break under concurrent renders. Mitigation: use a `buildColors()` factory that returns a fresh object, and thread it through as a parameter to `allDefs()` and the top-level render functions. This pushes toward approach (C) but only for the 3-4 entry-point functions, not every leaf renderer.

### Simplest MVP (lowest risk, ~40 LOC)

1. Add `buildColors(accent?: string): typeof colors` to `theme.ts`
2. In `renderFromGrid()` and `renderFlowDiagram()`, call `buildColors()` and temporarily assign to `colors` before render, restore after
3. Update `applyWhiteTheme()` to derive its replacement table from the active accent
4. Accept `accentColor` in the JSON input schema

This keeps all existing `colors.xyz` references working unchanged.

---

## 4. Summary

- **Light mode rendering works today** via the `"theme":"white"` flag + `applyWhiteTheme()` post-processing
- **Custom accent color is a ~72 LOC change** (MVP ~40 LOC) centered on `theme.ts` + `svg.ts`
- The main engineering challenge is deriving a visually coherent accent family from a single user-supplied hex color (HSL manipulation)
- No layout/spacing code needs to change — accent is purely a render concern
- All 5 white-theme renders are saved to `/Users/bassime/Downloads/n9tgraph-light-mode/`
