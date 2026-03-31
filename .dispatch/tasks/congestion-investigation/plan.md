# Investigate All Sources of Diagram Congestion

- [x] Render README examples to PNG, visually analyze every congestion/overlap/cramping instance — rendered 10+ examples; found severe cylinder overlap in LR, cramped payment-flow hub, tight observability-stack
- [x] Investigate .n9 source density, Sugiyama layout constants, node sizing, cylinder text clipping, spacing presets — flow-layout gaps 2.5x tighter than ascii-layout; cylinder adds only 10px but consumes 20px for rims; compact preset borderline unusable
- [x] Investigate creative alternatives: global scaling, font size, minimum node dimensions, post-layout expansion — proportional base-unit spacing, edge-label distribution along paths, post-layout expansion pass all viable; simplest fix is 5 LOC constant adjustments
- [x] Write root cause analysis + simplest fix recommendation to .dispatch/tasks/congestion-investigation/output.md — 6 root causes ranked, 7 LOC fix covers 80% of congestion
