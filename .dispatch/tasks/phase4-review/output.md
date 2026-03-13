# Phase 4 Review: Summary

## Files Modified

### Source Code
- **src/parser/grammar.pegjs** — Added `\n` escape sequences to QuotedString (DQChar/SQChar rules); added optional PropertiesBlock to FlowAnnotationStmt
- **src/parser/ast.ts** — Added `properties?: Properties` to FlowAnnotation interface
- **src/layout/flow-layout.ts** — Reduced spacing constants (NODE_GAP 180→40, LAYER_GAP 340→140, TITLE_HEIGHT 40→55); increased min height for service nodes with sublabels (120px); added subgraph-aware annotation positioning; added diagram bounds adjustment for multi-line annotations; updated codeblock line splitting for new escape semantics
- **src/render/flow-renderer.ts** — Rewrote multi-edge pair routing (overlap-based horizontal parallel edges instead of perpendicular offset); removed forced toUpperCase() from sublabels; added multi-line annotation rendering with step number circles; increased edge label maxCharsPerLine (18→30); updated codeblock line splitting

### Example Files
- **examples/container-egress.n9** — Added 3 annotation text blocks with step descriptions matching reference

## Key Fixes

### Session Multiplexer (CRITICAL)
- **Before**: Edges crossed diagonally between RESPONSES API and session nodes, labels overlapped
- **After**: Edges route as horizontal parallel pairs; each forward/return pair is clearly separated
- **How**: Replaced per-edge perpendicular calculation with overlap-based routing that finds the vertical overlap between connected nodes and routes edges horizontally through it. Service nodes with sublabels are now taller (120px min) to provide more vertical overlap range.

### Tools Overview
- **Before**: Diagram was extremely spread out (1200px+ wide), edges fanned wildly from MODEL
- **After**: Compact layout matching reference proportions; subgraph encloses tools properly; code blocks align with connected tool nodes
- **How**: Reduced NODE_GAP (180→40) and LAYER_GAP (340→140)

### Container Egress (CRITICAL)
- **Before**: Missing the large annotation text blocks with step descriptions entirely
- **After**: Three numbered annotation blocks render with step circle, white title, and monospace code lines
- **How**: Extended grammar to support `\n` escapes in quoted strings and properties on annotations; added multi-line annotation renderer; added subgraph-aware positioning to prevent annotation/subgraph overlap

### Skill Loading
- **Before**: Sublabel "SYSTEM PROMPT: NAME, DESCRIPTION, PATH" was forced uppercase and overflowed
- **After**: Sublabel renders in original case "System prompt: name, description, path"
- **How**: Removed `.toUpperCase()` from renderSublabel

## Remaining Minor Issues
- Session multiplexer title text extends far right (long title) — inherent to compact layout
- Edge labels in responses-api flow diagram are crowded due to multiple multi-edge pairs
- Skill loading edge labels slightly overlap with sublabel text at node border
