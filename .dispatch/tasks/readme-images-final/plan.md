# README Images: 2 Dark Mode + 1 Side-by-Side Composite

- [x] Create 2 dark mode .n9 examples (TB with subgraph/hero + LR with actors/externals), render SVG + PNG
- [x] Create 1 composite: same diagram in white theme (top) + custom accent color (bottom), stitched with ImageMagick
- [x] Update README.md: Examples section with just the 2 dark PNGs (NO code blocks/DSL snippets) + Themes & Colors section with composite image
- [x] Save all to examples/output/ and /Users/bassime/Downloads/n9tgraph-readme-final/

> **Note from dispatcher:** The user does NOT want DSL source code snippets in the README. Just the PNG images — let the diagrams speak for themselves. Keep the README clean: image, maybe a one-line caption, that's it.

> **Note from dispatcher:** Do NOT include `title` in the .n9 source — the README already has section headings, so a title in the diagram itself would be redundant.

> **Note from dispatcher:** The FIRST dark mode diagram should be the architecture of n9tgraph itself — show how the tool works internally (e.g., .n9 DSL → PEG Parser → AST → Sugiyama Layout → Flow Renderer → SVG, with the MCP server and CLI as entry points). This is meta and compelling — n9tgraph diagramming its own architecture.
