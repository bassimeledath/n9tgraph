# Phase 2 Review: Sequence Diagrams — Summary

## Files Reviewed
- `src/parser/ast.ts` — AST types for sequence diagrams (Participant, Message, CombinedFragment, Note)
- `src/parser/grammar.pegjs` — PEG grammar handling: type/title lines, participants with properties, messages with arrows (->, <-, <->), annotations (| suffix), combined fragments (loop/alt/opt/par with conditions), notes, comments (// and #)
- `src/parser/parser.ts` — Peggy-based parser wrapper with grammar file resolution
- `src/layout/sequence-layout.ts` — Grid-based layout engine computing positions for participants, messages, fragments, notes
- `src/render/sequence-renderer.ts` — SVG renderer for all sequence diagram elements
- `src/render/svg.ts` — Main render dispatcher wrapping SVG with defs and background
- `examples/codex-debugging.n9` — 3-participant diagram with LOOP fragment
- `examples/streaming-shell.n9` — 2-participant diagram with annotations and bold labels

## Grammar Assessment
The PEG grammar is correct and handles all required constructs:
- Comments (`//` and `#` prefixed)
- Quoted strings (single and double quotes)
- All arrow types: `->`, `<-`, `<->`
- Combined fragments with conditions (`loop UNTIL CLEAN ... end`)
- Participant properties blocks (`{ fill: dotgrid }`)
- Annotation suffixes (`| annotation text`)
- No multiline string support, but not needed for current diagram types

## Visual Differences Found and Fixed

### 1. Combined Fragment Border Style
- **Before**: Dashed border (`stroke-dasharray="6 4"`)
- **After**: Solid border (no dash array)
- **File**: `src/render/sequence-renderer.ts` line 171
- **Reference**: LOOP fragment in codex-debugging reference clearly shows solid thin border

### 2. Message Vertical Spacing Too Large
- **Before**: `MESSAGE_STEP = 60`
- **After**: `MESSAGE_STEP = 44`
- **File**: `src/layout/sequence-layout.ts` line 63
- **Reference**: Messages in both references are much more tightly spaced

### 3. Annotation Offset Too Large
- **Before**: `ANNOTATION_OFFSET = 14`
- **After**: `ANNOTATION_OFFSET = 10`
- **File**: `src/layout/sequence-layout.ts` line 68

### 4. Annotation-Only Message Spacing Too Large
- **Before**: `cursorY += 36` for annotation-only messages
- **After**: `cursorY += 26`
- **File**: `src/layout/sequence-layout.ts` line 141

### 5. Initial Gap After Headers Too Large
- **Before**: `cursorY = lifelineTop + 30`
- **After**: `cursorY = lifelineTop + 24`
- **File**: `src/layout/sequence-layout.ts` line 102

### 6. Annotations Had Italic Style (Reference Doesn't)
- **Before**: `font-style="italic"` on annotation text
- **After**: Removed italic styling
- **File**: `src/render/sequence-renderer.ts` line 134

### 7. Label Y-Offset Slightly Too Far From Arrow
- **Before**: `y - 10` (label positioned 10px above arrow)
- **After**: `y - 8` (closer to arrow, matching reference)
- **File**: `src/render/sequence-renderer.ts` line 128

### 8. Annotation Y-Offset Tightened
- **Before**: `y + 16` for annotation below labeled message
- **After**: `y + 14`
- **File**: `src/render/sequence-renderer.ts` line 134

## Verification Checklist
- [x] Message labels positioned ABOVE arrow line
- [x] LOOP label is a small solid-background green box with black text
- [x] Lifelines are thin dashed lines (stroke-dasharray="4 4", opacity=0.4)
- [x] **BEFORE** and **AFTER** text rendered with font-weight="700" via tspan
- [x] Participant headers have proper padding (24px horizontal, 14px vertical)
- [x] Message spacing matches reference proportions
- [x] Title is bold white text in top-left corner (font-weight="600", fill="#ffffff")
- [x] Fragment border is solid (not dashed)
- [x] Annotations are non-italic, positioned to the right below arrow endpoint

## Remaining Minor Differences (acceptable)
- Reference images are rendered at a smaller canvas width, causing text wrapping in titles and participant headers. Our output is wider but uses the same proportional style.
- Font rendering differences between resvg and the reference renderer may cause subtle weight/spacing differences.
