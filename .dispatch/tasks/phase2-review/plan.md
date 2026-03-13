# Phase 2 Review: Sequence Diagrams

- [x] Read all Phase 2 source files: `src/parser/ast.ts`, `src/parser/grammar.pegjs`, `src/parser/parser.ts`, `src/layout/sequence-layout.ts`, `src/render/sequence-renderer.ts`, `src/render/svg.ts`
- [x] Read both example .n9 files: `examples/codex-debugging.n9`, `examples/streaming-shell.n9`
- [x] Run `npx tsx src/render-examples.ts` to regenerate outputs, then view the PNGs in `examples/output/`
- [x] Compare `examples/output/codex-debugging.png` against reference — Differences found: (1) LOOP fragment border is DASHED but should be SOLID, (2) message spacing too large (MESSAGE_STEP=60 should be ~44), (3) annotations have italic style but reference doesn't, (4) annotation-only message spacing too large, (5) ANNOTATION_OFFSET too large
- [x] Compare `examples/output/streaming-shell.png` against reference — Same issues: (1) too spread out vertically, (2) annotation-only rows too tall, (3) italic annotations should be non-italic
- [x] Check the PEG grammar for correctness: can it handle comments, multiline strings, all message types, combined fragments with conditions, participant properties? — Grammar is correct: handles comments (// and #), quoted strings, all arrow types (->, <-, <->), fragments with conditions, participant properties blocks. No multiline string support but not needed for current diagrams.
- [x] Fix all visual differences you find — Fixed: (1) Fragment border SOLID not dashed, (2) MESSAGE_STEP 60→44, (3) ANNOTATION_OFFSET 14→10, (4) annotation-only step 36→26, (5) initial gap 30→24, (6) removed italic from annotations, (7) label Y offset y-10→y-8, (8) annotation Y offset y+16→y+14. All checklist items verified: (a) labels above arrow ✓, (b) LOOP label solid box ✓, (c) thin dashed lifelines ✓, (d) BEFORE/AFTER bold ✓, (e) header padding ✓, (f) tighter spacing ✓, (g) bold white title ✓
- [x] Re-render and verify fixes match the references more closely — Both diagrams re-rendered and visually compared. Solid match to reference style.
- [x] Write summary to .dispatch/tasks/phase2-review/output.md
