# Polish Pass 2: Edge Routing and Label Placement

Focus on the remaining visual issues that need iteration.

- [x] Look at `examples/output/responses-api.png` vs reference. Fixed: Made service nodes taller (h≥120), increased multi-edge spread from 65→80, increased LAYER_GAP from 140→160. Labels now clearly separated between the two edges.
- [x] Look at `examples/output/layered-architecture.png` vs reference. Fixed: Added orthogonal (Z-shaped) edge routing for TB mode — forward edges exit bottom/enter top with horizontal midpoint segments, back-edges route along the left side of the diagram. No more diagonal crossings.
- [x] Look at `examples/output/observability-stack.png` vs reference. Fixed: Pill shapes already rendering correctly (rx=999). Increased LAYER_GAP gives more horizontal room near CODEX for edge labels.
- [x] Re-render and verify improvements — all 11 diagrams render successfully, no regressions
- [x] Copy final PNGs to ~/Downloads/n9tgraph-output/
- [x] Write summary to .dispatch/tasks/polish-2/output.md
