# n9tgraph Iteration Loop — Fresh Start Prompt

Copy everything below into a new Claude Code instance. Working directory: `~/Desktop/n9tgraph`

---

## Context

You are managing an **autonomous review→implement iteration loop** for **n9tgraph**, a custom diagramming DSL tool at `~/Desktop/n9tgraph` (GitHub: `bassimeledath/n9tgraph`). It parses `.n9` files and renders SVG/PNG diagrams with 3 types: flow, sequence, card. Dark-mode styling (black bg, green accent `#b4f079`, hero fill `#3d6b23`). White theme variant via `theme white`.

### The Goal

Pixel-perfect reproduction of 11 reference images. References are in `examples/reference/` (long OAI filenames). Output PNGs are in `examples/output/` (short names like `codex-debugging.png`). The mapping between them is established in `src/render-examples.ts`.

### Current State

After 6 iterations, scores are: **7 VERY CLOSE, 4 CLOSE, 0 NEEDS WORK**. The 4 CLOSE diagrams are: `container-egress`, `layered-architecture`, `observability-stack`, `request-lifecycle`. The goal is to get ALL 11 to VERY CLOSE or PERFECT MATCH.

Previous iteration reviews and implementation summaries are in `.dispatch/tasks/iter{1-6}-review/output.md` and `.dispatch/tasks/iter{1-6}-impl/output.md`. **Read the latest review output (iter6-review/output.md) before starting** — it has detailed per-diagram analysis and the full trajectory.

### Key Source Files

- `src/layout/flow-layout.ts` — Sugiyama-style layered layout engine. All flow layout constants here (MARGIN_X, LAYER_GAP, NODE_GAP, MIN_NODE_W, SUBGRAPH_PAD, etc.). Also contains `resolveAnnotationOverlaps()`.
- `src/render/flow-renderer.ts` — Flow SVG renderer. Theme-aware label formatting, edge rendering, title/font sizes.
- `src/layout/sequence-layout.ts` — Grid-based sequence layout. Constants: PARTICIPANT_GAP, MESSAGE_STEP. Note x-clamping logic.
- `src/render/sequence-renderer.ts` — Sequence SVG renderer.
- `src/render/shapes.ts` — Node shape functions (rect, pill, cylinder, etc.).
- `src/render-examples.ts` — Batch render script. Run with: `npx tsx src/render-examples.ts`
- `examples/*.n9` — The 11 diagram source files.
- `examples/reference/` — Reference PNGs to match.
- `examples/output/` — Current output PNGs.
- `examples/iterations/` — Snapshots from each iteration (v015 through v021).

### Key Constants History (flow-layout.ts)

These have been tuned across iterations — be aware of what was already tried:
- MARGIN_X: 80→60→45→35→28
- LAYER_GAP: 160→120→100→70→60→42→30→24
- NODE_GAP: 80→55→40→30→22→16→22→18
- MIN_NODE_W: 90→72→62
- PARTICIPANT_GAP: 220→180→155→125→105
- MESSAGE_STEP: 44→38→33→28→34
- SUBGRAPH_PAD_TOP: 24→36
- PNG fitTo: 1200→800
- TITLE_HEIGHT: 40→32
- fontSizes.title: 18→15

### Remaining Issues (from iter6 review)

1. **Aspect ratio** — many diagrams still landscape when references are portrait. Internal layout produces wider compositions than references.
2. **container-egress** — numbered badges are green circles vs plain text numbers in ref. Stick figure style differs. Element density too tight.
3. **layered-architecture** — arrow styles still differ (thick vs thin). Node pill shapes slightly different. Overall proportions still off.
4. **observability-stack** — "Feedback loop" region doesn't form a clear visual cycle. Annotation placement differs from hand-crafted reference.
5. **request-lifecycle** — participant arrangement (all at top) vs reference's asymmetric layout (USER top-right, MODEL/CONTAINER at edges).
6. **Missing OpenAI logo** — by design, not a priority.

---

## Your Role: DISPATCHER ONLY

You are the **dispatcher**. You NEVER do implementation work yourself. You:
1. Write plan files
2. Spawn workers via `/dispatch`
3. Read results when workers complete
4. Dispatch the next task

**CRITICAL RULES:**
- Only use the `/dispatch` skill to spawn background agents. Never manually create dispatch scaffolding.
- The reviewer and implementor MUST be separate dispatches.
- Never read/edit source code yourself — that's the worker's job.
- When a worker completes, read its output file, summarize results, then dispatch the next task.

---

## The Iteration Loop

Run this loop for N iterations (or until satisfied):

### Step 1: Dispatch Reviewer

```
/dispatch Skeptical reviewer for iteration N of n9tgraph (~/Desktop/n9tgraph).
REVIEWER only — do NOT modify code. Compare all 11 output PNGs (examples/output/)
against references (examples/reference/). Rate each: PERFECT MATCH / VERY CLOSE /
CLOSE / NEEDS WORK / FAR OFF. Note every visible difference. Previous ratings:
[INSERT PREVIOUS RATINGS]. Check improvements and regressions. Write summary table
with deltas and top 3 remaining issues to .dispatch/tasks/iterN-review/output.md.
Use opus.
```

Wait for completion. Read `.dispatch/tasks/iterN-review/output.md`. Summarize results to user.

### Step 2: Dispatch Implementor

```
/dispatch Iteration N implementor for n9tgraph (~/Desktop/n9tgraph). Read reviewer
findings at .dispatch/tasks/iterN-review/output.md. Fix the top 3 issues:
[INSERT TOP 3 FROM REVIEW]. After fixes, re-render all 11 diagrams
(npx tsx src/render-examples.ts), verify no regressions, save snapshot to
examples/iterations/vNNN/, copy PNGs to ~/Downloads/n9tgraph-iterations/iterN/.
Commit and push (not .dispatch/ files). Write summary to
.dispatch/tasks/iterN-impl/output.md. Use opus.
```

Wait for completion. Read `.dispatch/tasks/iterN-impl/output.md`. Summarize results to user.

### Step 3: Repeat

Go back to Step 1 with N+1, updating the previous ratings from the last review.

---

## Progress Saving

Each iteration's output PNGs should be saved to:
- `~/Downloads/n9tgraph-iterations/iter{N}/` — PNGs from each iteration
- `examples/iterations/v{NNN}/` — in-repo snapshots (already established pattern, next is v022)

This lets you visually compare progress across iterations in the Downloads folder.

---

## Dispatch Configuration

The dispatch config is already set up at `~/.dispatch/config.yaml`:
- Default model: **opus** (claude backend)
- Claude backend: `env -u CLAUDE_CODE_ENTRYPOINT -u CLAUDECODE claude -p --dangerously-skip-permissions`
- Also has codex backend for OpenAI models

All dispatches should use **opus** for both reviewer and implementor.

---

## Tips for Better Results

1. **Read the reference images yourself** — you can use the Read tool on PNG files. Compare output vs reference visually before dispatching to give workers better guidance.
2. **Be specific in implementor prompts** — vague instructions like "fix aspect ratio" produce incremental tweaks. Instead, tell the worker exactly what you see: "container-egress output is 800x500 landscape, reference is 600x750 portrait — the layout needs to stack vertically not horizontally."
3. **Check for regressions immediately** — if an impl worker reports "no regressions" but you're skeptical, spot-check by reading a few output PNGs before dispatching the next review.
4. **Consider .n9 file changes** — not just layout code. Sometimes the diagram source files themselves need restructuring to better match the reference layout.
5. **The hardest problems are spatial** — annotation placement, participant arrangement, and aspect ratio are layout algorithm issues. These may need new layout strategies, not just constant tuning.
6. **Start with the 4 CLOSE diagrams** — focus implementor effort on container-egress, layered-architecture, observability-stack, and request-lifecycle. The 7 VERY CLOSE ones are mostly fine.

---

## Starting the Loop

Begin by reading the latest state:
1. Read `.dispatch/tasks/iter6-review/output.md` for the most recent review
2. Read `.dispatch/tasks/iter6-impl/output.md` for the most recent implementation summary
3. Visually compare a few output PNGs vs references (Read tool on the PNG files)
4. Then dispatch `iter7-review` to establish a fresh baseline

Start with: "Continue the n9tgraph iteration loop. Read the iter6 review/impl outputs, then dispatch iter7-review using opus."
