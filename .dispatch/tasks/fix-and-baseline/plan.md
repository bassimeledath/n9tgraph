# Fix Review Issues + Create Baseline Benchmarks

- [x] Read .dispatch/tasks/review-codex/output.md and src/layout/ascii-layout.ts, src/mcp-server.ts, src/render/svg.ts
- [x] Fix LR grid→pixel axis inversion: compute layer widths from max node width per row, lane heights from max node height per column in LR mode
- [x] Fix subgraph negative bounds: after computing all bounds, shift everything if any coords are negative, recompute canvas
- [x] Fix double layout in MCP: restructure so layoutFromGrid is called only once
- [x] Run npm run build — must compile clean
- [x] Create 5 augmented JSON fixtures in bench/ascii-guided/ (checkout-flow, microservices, auth-flow, data-pipeline, simple-3node)
- [x] Render all 5 to SVG+PNG, save to bench/ascii-guided/output/ and /Users/bassime/Downloads/n9tgraph-ascii-baseline/
