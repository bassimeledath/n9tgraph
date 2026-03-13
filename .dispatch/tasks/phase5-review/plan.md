# Phase 5 Review: Card Layouts

- [x] Read all Phase 5 source: card grammar section in grammar.pegjs, card-layout.ts, card-renderer.ts, codex-knowledge.n9
- [x] Run `npx tsx src/render-examples.ts` and view `examples/output/codex-knowledge.png`
- [x] Compare against reference. Findings: (a) pill shape/dotgrid ✓, (b) edge_in direction/label ✓, (c) hanging label ✓, (d) card bg/border/icons/text ✓, (e) container border too prominent: double-rect at 0.5+0.4 = ~0.7 combined; container label not rendered, (f) overflow dots ✓, (g) proportions ✓
- [x] Fix any visual discrepancies directly in the code — separated container fill/stroke opacity (0.5 fill, 0.35 border), removed container label (not in reference)
- [x] Verify all 11 diagrams still render correctly — all rendered without errors, spot-checked codex-knowledge, responses-api, streaming-shell visually
- [x] Write summary to .dispatch/tasks/phase5-review/output.md
