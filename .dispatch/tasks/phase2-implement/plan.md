# Phase 2: Implement Sequence Diagrams

- [x] Create `src/parser/ast.ts` — define TypeScript types for the full AST. This must cover all three diagram types (sequence, flow, card) even though we're only implementing sequence now. Types needed: DiagramAST, SequenceDiagram, FlowDiagram, CardDiagram, Participant, Message, CombinedFragment, Note, Node, Edge, Subgraph, Card, Container, etc. Make it comprehensive.
- [x] Create `src/parser/grammar.pegjs` — write a PEG grammar (using peggy) for the `type sequence` subset of the DSL.
- [x] Create `src/parser/parser.ts` — wrapper that uses peggy to compile the grammar and parse input strings into AST.
- [x] Create `src/layout/sequence-layout.ts` — grid-based layout engine for sequence diagrams.
- [x] Create `src/render/sequence-renderer.ts` — renders positioned sequence diagram to SVG.
- [x] Create `src/render/svg.ts` — the main render dispatcher.
- [x] Write example file `examples/codex-debugging.n9` that matches the "Codex drives the app with Chrome DevTools" reference image.
- [x] Write example file `examples/streaming-shell.n9` that matches the "Streaming shell command execution output" reference image.
- [x] Create `src/render-examples.ts` — a script that reads .n9 files from examples/, parses and renders each to SVG and PNG.
- [x] Verify both sequence diagrams render correctly. Compared against reference images, adjusted annotation spacing and arrow directions. Both outputs closely match references.
