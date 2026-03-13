# Phase 5 Review: Card Layouts — Summary

## Reference comparison

Compared `examples/output/codex-knowledge.png` against `examples/reference/OAI_Harness_engineering_The_limits_of_agent_knowledge_desktop-dark.png`.

### What matched the reference

- **Pill node**: Shape (rx=999), dotgrid fill, green border, uppercase monospace text with letter-spacing — all correct
- **Edge-in arrow**: Direction correct (from right, arrowhead pointing left into pill), label "Encode into codebase as markdown" wrapped and positioned right of arrow origin
- **Hanging label**: Chain-broken icon + "Unseen knowledge to Codex" text below pill, connected by subtle line at 0.5 opacity
- **Cards**: Dark bg (#111), gray border (#333), white titles (600 weight), white body text at 0.7 opacity, white icons (doc, person, brain) — all correct
- **Overflow dots**: Three white dots at 0.5 opacity after last card
- **Vertical edge**: Arrow from pill bottom to container top with arrowhead marker
- **Title**: Two-line white bold sans-serif title at top-left
- **Overall proportions**: Element sizes and spacing reasonable

### Issues found and fixed

1. **Container border too prominent** (card-renderer.ts:91-94)
   - **Before**: Two overlapping `<rect>` elements both with `stroke="${colors.accent}"` — first at `opacity="0.5"`, second at `opacity="0.4"`. Combined stroke opacity ~0.7, much bolder than reference.
   - **After**: Separated fill and stroke into distinct rects — fill-only at `opacity="0.5"`, stroke-only at `opacity="0.35"`. Border now matches the subtle green line in the reference.

### Files changed

- `src/render/card-renderer.ts` — container rendering (lines 91-94)

### Verification

All 11 example diagrams re-rendered without errors after the fix:
codex-debugging, codex-knowledge, container-egress, layered-architecture, observability-stack, request-lifecycle, responses-api, session-multiplexer, skill-loading, streaming-shell, tools-overview.
