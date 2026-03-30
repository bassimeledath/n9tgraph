# Iteration 1: Fix Spacing and Breathing Room

- [x] Read .swarmy/explore-i0.md and src/layout/ascii-layout.ts — understand current gap constants and spacing logic
- [x] Fix 1: Increase base TB vertical gap to at least 50px between grid rows — DEFAULT_TB_LAYER_GAP 38→50
- [x] Fix 2: Add label-aware gap expansion — scan connectors, if any between adjacent rows have labels add +30px to that gap
- [x] Fix 3: Increase horizontal nodeGap to at least 50px between same-row nodes — DEFAULT_NODE_GAP 20→50
- [x] Fix 4: Increase subgraph padding — PAD_X 16→28, PAD_TOP 56→64, PAD_BOTTOM 16→28
- [x] Fix 5: Add margin between adjacent subgroups — 30px enforcement via post-processing step
- [x] Run npm run build — must compile clean
- [x] Re-render all 5 benchmarks to bench/ascii-guided/output/ and save i1-{name}.png to /Users/bassime/Downloads/n9tgraph-ascii-baseline/
