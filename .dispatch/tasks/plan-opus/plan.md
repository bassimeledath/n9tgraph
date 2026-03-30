# Opus: ASCII-Guided Refactor Architecture Plan

- [x] Read n9tgraph source: grammar.pegjs, ast.ts, flow-layout.ts, flow-renderer.ts, shapes.ts, theme.ts, patterns.ts, mcp-server.ts
- [x] Read perfect-ascii: /Users/bassime/Desktop/fullstack/perfect-ascii/bin/ascii-render and SKILL.md
- [x] Design architecture: ASCII+metadata input → ASCII parser → position extraction → existing SVG renderer — Chose JSON-first approach (grid topology from JSON, not ASCII parsing) for reliability and metadata preservation
- [x] Identify risks: features hard to derive from ASCII (subgraphs, annotations, codeblocks) — 7 risks documented with mitigations; subgraphs via explicit childIds, annotations via near+side, codeblocks deferred to Phase 2
- [x] Write detailed plan to .swarmy/explore-opus-plan.md — Full architecture doc written with augmented JSON format, ascii-layout.ts algorithm, MCP integration, file change summary, and 3-phase rollout plan
