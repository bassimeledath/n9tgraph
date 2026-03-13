# Polish Pass: Fix All Visual Issues Across 11 Diagrams

Compare every diagram against its reference image and fix all discrepancies. The goal is pixel-perfect reproduction.

- [x] Run `npx tsx src/render-examples.ts` and view ALL 11 PNGs. For each, open the matching reference image and note EVERY difference.
- [x] Fix `responses-api.n9` / flow layout: Edge labels between RESPONSES API↔MODEL overlap. The "PROMPT + SHELL INSTRUCTION + STDOUT/STDERR" label and "SHELL COMMANDS" label need clear separation. In the reference, these are on separate parallel lines with clear spacing. Also the diagram needs more vertical space — MODEL should be clearly above and RUNTIME CONTAINER clearly below. — Fixed: increased multi-edge spread to 65px for labeled edges, NODE_GAP to 80.
- [x] Fix `observability-stack.n9` / flow layout: The diagram is too horizontally compressed. Labels overlap badly. Need more horizontal spacing. The subgraph "Observability stack services" should be wider. CODEX and CODEBASE nodes should have more room. The annotation labels on edges need to not overlap. — Fixed: moved "UI Journey" and "Test" annotations to side bottom.
- [x] Fix `request-lifecycle.n9` / sequence: The note items show raw markdown (`**2** Planning and setup`) — the `**` markers should be stripped or rendered as bold. The "1 Skill discovery" note is not rendering correctly. Fix the .n9 file to use proper DSL syntax instead of markdown. — Fixed: renderNotes now handles **bold** and \n multiline.
- [x] Fix `layered-architecture.n9` / flow: In the reference, the nodes are pill-shaped and arranged in clean rows within the subgraph. Current layout has edges crossing too much. The reference shows: row 1 (Providers → App Wiring + UI), row 2 (Service → Runtime → UI), row 3 (Types → Config → Repo). Each row should be at the same vertical level with horizontal edges between them. Vertical edges connect rows. — Fixed: added refineCoordinatesTB() with median-based single-node alignment, separate TB_LAYER_GAP=100.
- [x] Review all other diagrams for any remaining differences: tools-overview, session-multiplexer, skill-loading, container-egress, codex-debugging, streaming-shell, codex-knowledge — All 7 look clean, no changes needed.
- [x] Re-render all examples and do a final comparison pass — All 11 render clean.
- [x] Copy final PNGs to ~/Downloads/n9tgraph-output/ — Done.
- [x] Write summary to .dispatch/tasks/polish-all/output.md — Done.
