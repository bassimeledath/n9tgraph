# Implement ASCII-Guided Layout for n9tgraph

- [x] Read .swarmy/explore-opus-plan.md, then read src/layout/flow-layout.ts (FlowLayout types + spacing constants), src/render/flow-renderer.ts (renderFlow signature), src/render/svg.ts (render dispatcher), src/layout/text-measure.ts, src/mcp-server.ts, src/index.ts
- [x] Create src/layout/ascii-layout.ts: AsciiGuidedInput interface + layoutFromGrid() function — grid→pixel mapping, node sizing, PositionedNode/Edge/Subgraph/Annotation building
- [x] Update src/render/svg.ts: add renderFromGrid() that calls layoutFromGrid then renderFlow then wraps SVG
- [x] Update src/mcp-server.ts: add n9t.render-ascii tool + update n9t.grammar with augmented JSON reference
- [x] Update src/index.ts: export renderFromGrid
- [x] Run npm run build — must compile clean
- [x] Create test fixture and verify end-to-end: augmented JSON → SVG with same n9tgraph visual style — 13/13 checks pass (SVG structure, all labels, fill patterns, subgraph, title, edges)
