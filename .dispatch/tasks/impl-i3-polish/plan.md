# Iteration 3 (Final): Polish Remaining Minor Issues

- [x] Read .swarmy/explore-i2.md, src/layout/ascii-layout.ts, src/render/flow-renderer.ts
- [x] Fix checkout-flow polyline routing offset: obstacle-avoidance detour should clear edge labels, not just node bounding boxes
- [x] Fix auth-flow layout asymmetry: center diagram or balance column widths to reduce wasted right-side space — added horizontal centering step in Step 11
- [x] Fix microservices API GATEWAY gap: ensure ≥30px between non-child node bottom and subgraph top — added Step 8a2
- [x] Fix checkout-flow label clearance: increase minimum from 5px to 10px — LABEL_CLEARANCE = 10
- [x] Run npm run build — must compile clean
- [x] Re-render all 5 benchmarks to bench/ascii-guided/output/ and save i3-{name}.png to /Users/bassime/Downloads/n9tgraph-ascii-baseline/
