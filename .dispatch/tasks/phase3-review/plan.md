# Phase 3 Review: Simple Flow Diagrams

- [x] Read all Phase 3 source files: `src/parser/grammar.pegjs` (flow section), `src/layout/flow-layout.ts`, `src/render/flow-renderer.ts`, `src/render/svg.ts`, `examples/responses-api.n9`
- [x] Run `npx tsx src/render-examples.ts` to regenerate outputs. View `examples/output/responses-api.png`. — Done, output reviewed
- [x] Compare CAREFULLY against reference. Issues: (1) edge labels overlap between RESPONSES API↔MODEL, (2) too horizontally compressed, (3) insufficient vertical separation MODEL vs RUNTIME, (4) annotation needs adjustment, (5) canvas needs wider aspect ratio, (6) edge spread too small
- [x] Key issues identified — see item above
- [x] Fix all layout and rendering issues. Changes: LAYER_GAP 240→340, NODE_GAP 120→180, edge spread 80→150, edge labels placed at t=0.30 near source with perpendicular spread, annotation offset increased from 12→20px.
- [x] Also verify sequence diagrams still render correctly after changes. — codex-debugging.png and streaming-shell.png both look correct.
- [x] Re-render all examples and confirm improvements match the reference more closely. — All 3 examples re-rendered successfully.
- [x] Write summary to .dispatch/tasks/phase3-review/output.md
