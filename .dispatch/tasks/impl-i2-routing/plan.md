# Iteration 2: Edge-Through-Node Collision + Label Clearance

- [x] Read .swarmy/explore-i1.md for remaining issues, then read src/layout/ascii-layout.ts, src/render/flow-renderer.ts (lines 825-863 obstacle avoidance)
- [x] Fix edge-through-node: added obstacle avoidance for same-row TB edges in flow-renderer.ts (lines 745-790). The renderer's existing obstacle logic only covered non-TB edges; same-row TB edges were drawing straight lines through intervening nodes. Now uses lineSegmentIntersectsAABB + polyline routing above/below blocking nodes.
- [x] Fix label-to-node clearance: added Step 8a in ascii-layout.ts that checks subgraph label zones (sg.y+13 to sg.y+37) against non-child node borders and shifts subgraph + descendants down when clearance < 5px. Checkout-flow "Checkout Pipeline" label now has exactly 5px gap from LOGIN/REGISTER bottom (was 1px).
- [x] Run npm run build — compiles clean
- [x] Re-render all 5 benchmarks to bench/ascii-guided/output/ and save i2-{name}.png to /Users/bassime/Downloads/n9tgraph-ascii-baseline/
