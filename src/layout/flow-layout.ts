// Sugiyama-style layered layout for flow diagrams
import type { FlowDiagram, FlowNode, FlowEdge, FlowAnnotation, FlowDirection, Subgraph, CodeBlock, ThemeName, SpacingPreset, WrapMode, AspectHint } from '../parser/ast.js';
import { nodeSizeForLabel, measureLineWidth, wrapLabel } from './text-measure.js';
import { fontSizes } from '../render/theme.js';

// ─── Layout output types ─────────────────────────────────

export interface PositionedNode {
  id: string;
  label: string;
  kind: FlowNode['kind'];
  properties: FlowNode['properties'];
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PositionedEdge {
  from: string;
  to: string;
  arrow: FlowEdge['arrow'];
  label?: string;
  dashed: boolean;
  properties?: FlowEdge['properties'];
  fromPt: { x: number; y: number };
  toPt: { x: number; y: number };
}

export interface PositionedAnnotation {
  text: string;
  x: number;
  y: number;
  properties?: import('../parser/ast.js').Properties;
}

export interface PositionedSubgraph {
  id: string;
  label: string;
  properties: Subgraph['properties'];
  x: number;
  y: number;
  w: number;
  h: number;
  childIds: string[];
}

export interface PositionedOverflow {
  x: number;
  y: number;
}

export interface PositionedCodeBlock {
  id: string;
  label: string;
  code: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FlowLayout {
  width: number;
  height: number;
  direction: FlowDirection;
  theme?: ThemeName;
  title?: string;
  titleMaxWidth?: number;
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  annotations: PositionedAnnotation[];
  subgraphs: PositionedSubgraph[];
  overflows: PositionedOverflow[];
  codeblocks: PositionedCodeBlock[];
}

// ─── Constants ───────────────────────────────────────────

const MARGIN_X = 36;
const MARGIN_TOP = 18;
const TITLE_HEIGHT = 32;
const DEFAULT_LAYER_GAP = 24;
const DEFAULT_TB_LAYER_GAP = 38;
const DEFAULT_NODE_GAP = 20;

// Spacing presets: compact, balanced (default), spacious
function resolveSpacing(preset?: SpacingPreset): { nodeGap: number; layerGap: number; tbLayerGap: number } {
  switch (preset) {
    case 'compact':  return { nodeGap: 12, layerGap: 18, tbLayerGap: 28 };
    case 'spacious': return { nodeGap: 30, layerGap: 50, tbLayerGap: 60 };
    default:         return { nodeGap: DEFAULT_NODE_GAP, layerGap: DEFAULT_LAYER_GAP, tbLayerGap: DEFAULT_TB_LAYER_GAP };
  }
}
const ACTOR_W = 42;
const ACTOR_H = 72;
const MIN_NODE_W = 72;
const CIRCLE_R = 32;
const SUBGRAPH_PAD_X = 16;
const SUBGRAPH_PAD_TOP = 56;
const SUBGRAPH_PAD_BOTTOM = 16;
const CODEBLOCK_LINE_H = 18;
const CODEBLOCK_PAD = 12;
const MAX_NODE_LABEL_CHARS = 28;  // Wrap labels longer than this
const MAX_ASPECT_RATIO = 3.0;     // Fold chains when ratio exceeds this
const MAX_NODES_PER_COL = 6;      // Grid fan-out threshold

// ─── Main entry ──────────────────────────────────────────

export function layoutFlow(diagram: FlowDiagram): FlowLayout {
  const { nodes, edges, annotations, direction, title, subgraphs, codeblocks } = diagram;

  // Resolve spacing preset to concrete gap values
  const sp = resolveSpacing(diagram.spacing);
  const NODE_GAP = sp.nodeGap;
  const LAYER_GAP = sp.layerGap;
  const TB_LAYER_GAP = sp.tbLayerGap;

  // Flatten all nodes: top-level + subgraph children + codeblocks (as virtual nodes)
  const allNodes: FlowNode[] = [...nodes];
  const subgraphChildIds = new Set<string>();

  for (const sg of subgraphs) {
    for (const n of sg.nodes) {
      allNodes.push(n);
      subgraphChildIds.add(n.id);
    }
  }

  // Add codeblocks as virtual component nodes for layout purposes
  const codeblockIds = new Set<string>();
  for (const cb of codeblocks) {
    allNodes.push({
      id: cb.id,
      label: cb.label,
      kind: 'component',
      properties: cb.properties,
    });
    codeblockIds.add(cb.id);
  }

  // Flatten all edges: top-level + subgraph edges
  const allEdges: FlowEdge[] = [...edges];
  for (const sg of subgraphs) {
    for (const e of sg.edges) {
      allEdges.push(e);
    }
  }

  if (allNodes.length === 0) {
    return { width: 200, height: 100, direction, title, nodes: [], edges: [], annotations: [], subgraphs: [], overflows: [], codeblocks: [] };
  }

  // Build forward adjacency from --> edges
  const adj = new Map<string, Set<string>>();
  for (const n of allNodes) adj.set(n.id, new Set());

  for (const e of allEdges) {
    const src = (e.arrow === '<--' || e.arrow === '<-.-') ? e.to : e.from;
    const tgt = (e.arrow === '<--' || e.arrow === '<-.-') ? e.from : e.to;
    if (adj.has(src) && adj.has(tgt)) {
      adj.get(src)!.add(tgt);
    }
  }

  // Step 1: Cycle removal via DFS
  const backEdges = new Set<string>();
  {
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>();
    for (const n of allNodes) color.set(n.id, WHITE);

    function dfs(u: string) {
      color.set(u, GRAY);
      for (const v of adj.get(u) || []) {
        if (color.get(v) === GRAY) {
          backEdges.add(`${u}->${v}`);
        } else if (color.get(v) === WHITE) {
          dfs(v);
        }
      }
      color.set(u, BLACK);
    }
    for (const n of allNodes) {
      if (color.get(n.id) === WHITE) dfs(n.id);
    }
  }

  // Build DAG adjacency
  const dagAdj = new Map<string, string[]>();
  const dagInAdj = new Map<string, string[]>();
  for (const n of allNodes) {
    dagAdj.set(n.id, []);
    dagInAdj.set(n.id, []);
  }
  for (const e of allEdges) {
    const src = (e.arrow === '<--' || e.arrow === '<-.-') ? e.to : e.from;
    const tgt = (e.arrow === '<--' || e.arrow === '<-.-') ? e.from : e.to;
    if (!backEdges.has(`${src}->${tgt}`) && dagAdj.has(src) && dagAdj.has(tgt)) {
      dagAdj.get(src)!.push(tgt);
      dagInAdj.get(tgt)!.push(src);
    }
  }

  // Step 2: Layer assignment
  const layers = assignLayers(allNodes, dagAdj, dagInAdj, direction);

  // Step 2a: Apply same-rank directive — move grouped nodes to the same layer
  if (diagram.sameRank) {
    for (const group of diagram.sameRank) {
      // Find the max layer index among group members
      let maxLayerIdx = -1;
      for (const id of group) {
        for (let li = 0; li < layers.length; li++) {
          if (layers[li].includes(id)) {
            maxLayerIdx = Math.max(maxLayerIdx, li);
          }
        }
      }
      if (maxLayerIdx < 0) continue;
      // Move all group members to that layer
      for (const id of group) {
        for (let li = 0; li < layers.length; li++) {
          if (li !== maxLayerIdx && layers[li].includes(id)) {
            layers[li] = layers[li].filter(n => n !== id);
            if (!layers[maxLayerIdx].includes(id)) {
              layers[maxLayerIdx].push(id);
            }
          }
        }
      }
    }
    // Remove empty layers
    for (let i = layers.length - 1; i >= 0; i--) {
      if (layers[i].length === 0) layers.splice(i, 1);
    }
  }

  // Step 2b: Collapse bidirectional leaf pairs to same layer
  // When A→B and B→A both exist (separate edges, not <-->), and the later node
  // has no forward children in the DAG, move it to the earlier node's layer.
  // This enables vertical stacking of mutually-connected nodes (e.g. CODEX ↔ CODEBASE).
  {
    const edgeKeySet = new Set<string>();
    for (const e of allEdges) {
      const src = (e.arrow === '<--' || e.arrow === '<-.-') ? e.to : e.from;
      const tgt = (e.arrow === '<--' || e.arrow === '<-.-') ? e.from : e.to;
      edgeKeySet.add(`${src}->${tgt}`);
    }

    for (const e of allEdges) {
      const src = (e.arrow === '<--' || e.arrow === '<-.-') ? e.to : e.from;
      const tgt = (e.arrow === '<--' || e.arrow === '<-.-') ? e.from : e.to;
      if (!edgeKeySet.has(`${tgt}->${src}`)) continue; // not bidirectional

      // Skip collapsing if any edge in this bidirectional pair has a label —
      // labeled edges need horizontal space (in LR) to display labels clearly
      const hasLabeledEdge = allEdges.some(ed => {
        const s = (ed.arrow === '<--' || ed.arrow === '<-.-') ? ed.to : ed.from;
        const t = (ed.arrow === '<--' || ed.arrow === '<-.-') ? ed.from : ed.to;
        return ((s === src && t === tgt) || (s === tgt && t === src)) && !!ed.label;
      });
      if (hasLabeledEdge) continue;

      // Find which layers contain src and tgt
      let srcLayerIdx = -1, tgtLayerIdx = -1;
      for (let li = 0; li < layers.length; li++) {
        if (layers[li].includes(src)) srcLayerIdx = li;
        if (layers[li].includes(tgt)) tgtLayerIdx = li;
      }
      if (srcLayerIdx === tgtLayerIdx) continue; // already same layer

      const laterNode = srcLayerIdx > tgtLayerIdx ? src : tgt;
      const laterLayerIdx = Math.max(srcLayerIdx, tgtLayerIdx);
      const earlierLayerIdx = Math.min(srcLayerIdx, tgtLayerIdx);

      // Only collapse if the later node is a leaf in the DAG
      const dagChildren = dagAdj.get(laterNode) || [];
      if (dagChildren.length > 0) continue;

      // Move later node to earlier layer
      layers[laterLayerIdx] = layers[laterLayerIdx].filter(id => id !== laterNode);
      layers[earlierLayerIdx].push(laterNode);
    }

    // Remove empty layers
    for (let i = layers.length - 1; i >= 0; i--) {
      if (layers[i].length === 0) layers.splice(i, 1);
    }
  }

  // Step 3: Crossing minimization
  const ordered = minimizeCrossings(layers, dagAdj, dagInAdj);

  // Terminal-first sorting removed — node order follows declaration order + barycenter

  // Step 4: Compute node sizes
  const nodeSizes = new Map<string, { w: number; h: number }>();
  for (const n of allNodes) {
    if (n.kind === 'actor') {
      const labelW = n.label
        ? measureLineWidth(n.label.toUpperCase(), fontSizes.nodeLabel, 'mono')
          + n.label.length * 0.12 * fontSizes.nodeLabel
        : 0;
      nodeSizes.set(n.id, { w: Math.max(ACTOR_W, labelW + 8), h: ACTOR_H });
    } else if (n.kind === 'circle') {
      // Size circle to fit label text (with letter-spacing)
      const labelW = n.label ? measureLineWidth(n.label, fontSizes.nodeLabel, 'mono') + n.label.length * 0.12 * fontSizes.nodeLabel + 16 : 0;
      const r = Math.max(CIRCLE_R, labelW / 2);
      nodeSizes.set(n.id, { w: r * 2, h: r * 2 });
    } else if (codeblockIds.has(n.id)) {
      // Size codeblock based on its code content
      const cb = codeblocks.find(c => c.id === n.id)!;
      const code = cb.properties.code || '';
      const lines = code.split('\n');
      const titleW = measureLineWidth(cb.label, fontSizes.nodeLabel, 'mono') + 20;
      const codeW = Math.max(...lines.map(l => measureLineWidth(l, fontSizes.codeBlock, 'mono')));
      const w = Math.max(titleW, codeW + CODEBLOCK_PAD * 2, MIN_NODE_W);
      const h = fontSizes.nodeLabel + 12 + lines.length * CODEBLOCK_LINE_H + CODEBLOCK_PAD;
      nodeSizes.set(n.id, { w, h });
    } else {
      // Account for sublabel in height
      const sublabel = n.properties.sublabel;
      // Pills need wider padding — semicircular ends eat into text area
      const isPill = n.properties.shape === 'pill';
      const padX = isPill ? 32 : 20;
      const padY = isPill ? 6 : 10;
      // Wrap long labels into multiple lines for compact node sizing
      const wrappedLines = wrapLabel(n.label, MAX_NODE_LABEL_CHARS);
      const maxLine = wrappedLines.reduce((a, b) => a.length > b.length ? a : b, '');
      const size = nodeSizeForLabel(maxLine, fontSizes.nodeLabel, 'mono', padX, padY);
      if (wrappedLines.length > 1) {
        const lineH = fontSizes.nodeLabel * 1.4;
        size.h = Math.ceil(wrappedLines.length * lineH + padY * 2);
      }
      let h = Math.max(size.h, isPill ? 34 : 36);
      if (sublabel) {
        // Wrap sublabel too to prevent nodes from becoming excessively wide
        const sublabelWrapped = wrapLabel(sublabel, MAX_NODE_LABEL_CHARS + 6);
        const maxSubLine = sublabelWrapped.reduce((a, b) => a.length > b.length ? a : b, '');
        // Sublabel renders at y + h/2 + 12, each line at edgeLabel*1.4 = 15.4px
        // Ensure node height accommodates all sublabel lines without clipping:
        // h/2 >= 12 + sublabelLines * ceil(edgeLabel * 1.4) + 4px margin
        const sublabelLineH = Math.ceil(fontSizes.edgeLabel * 1.4);
        const sublabelExtent = 12 + sublabelWrapped.length * sublabelLineH + 4;
        // Also need space above center for main label (offset -8 when sublabel present)
        const neededH = Math.max(h + 18 * sublabelWrapped.length, sublabelExtent * 2 + 16);
        h = neededH;
        const sublabelW = measureLineWidth(maxSubLine, fontSizes.edgeLabel, 'mono') + padX * 2;
        if (sublabelW > size.w) {
          size.w = sublabelW;
        }
      }
      // Service nodes get taller to span connected neighbors
      if (n.kind === 'service') {
        // Count distinct neighbors with multi-edge pairs (2+ edges to same neighbor)
        const pairCounts = new Map<string, number>();
        for (const e of allEdges) {
          if (e.from !== n.id && e.to !== n.id) continue;
          const other = e.from === n.id ? e.to : e.from;
          pairCounts.set(other, (pairCounts.get(other) || 0) + 1);
        }
        const multiPairGroups = [...pairCounts.values()].filter(c => c >= 2).length;
        if (multiPairGroups >= 2) {
          h = Math.max(h, multiPairGroups * 40 + (multiPairGroups - 1) * 18);
        } else {
          h = Math.max(h, 65);
        }
      }
      // Boost height for non-service nodes with labeled multi-edge pairs (skip subgraph children)
      if (n.kind !== 'service' && !subgraphChildIds.has(n.id)) {
        const labeledPairCounts = new Map<string, number>();
        for (const e of allEdges) {
          if (e.from !== n.id && e.to !== n.id) continue;
          if (!e.label) continue;
          const other = e.from === n.id ? e.to : e.from;
          labeledPairCounts.set(other, (labeledPairCounts.get(other) || 0) + 1);
        }
        const multiPairGroups = [...labeledPairCounts.values()].filter(c => c >= 2).length;
        if (multiPairGroups >= 1) {
          h = Math.max(h, multiPairGroups * 65 + 8);
        }
      }
      // Apply DSL min-height / min-width overrides
      const dslMinH = parseInt(n.properties['min-height'] || '', 10);
      const dslMinW = parseInt(n.properties['min-width'] || '', 10);
      if (!isNaN(dslMinH)) h = Math.max(h, dslMinH);
      let finalW = Math.max(size.w, MIN_NODE_W);
      if (!isNaN(dslMinW)) finalW = Math.max(finalW, dslMinW);
      nodeSizes.set(n.id, { w: finalW, h });
    }
  }

  // Collect nodes with sublabels for gap computation
  const sublabelIds = new Set<string>();
  for (const n of allNodes) {
    if (n.properties.sublabel) sublabelIds.add(n.id);
  }

  // Step 5: Coordinate assignment
  const positioned = assignCoordinates(ordered, nodeSizes, direction, allEdges, title, annotations, sublabelIds, subgraphChildIds, sp, diagram.wrap || 'auto');

  // Step 5a: Apply aspect ratio hint — scale coordinates to hit target W/H ratio
  applyAspectHint(diagram.aspect, positioned);

  // Step 5b: Coordinate refinement — reduce crossings by aligning nodes with neighbors
  if (direction === 'TB') {
    refineCoordinatesTB(ordered, positioned.nodePositions, nodeSizes, allEdges);
  }
  if (direction === 'LR') {
    refineCoordinatesLR(ordered, positioned.nodePositions, nodeSizes, allEdges);
  }

  // Step 6: Compute subgraph bounding boxes
  const posSubgraphs = computeSubgraphBounds(subgraphs, positioned.nodePositions, nodeSizes);

  // Step 6a: Resolve subgraph header-to-header text collisions
  resolveSubgraphHeaderOverlaps(posSubgraphs, positioned.nodePositions, nodeSizes);

  // Step 6b: Push non-subgraph nodes away from subgraph bounding boxes
  separateNodesFromSubgraphs(allNodes, positioned.nodePositions, nodeSizes, posSubgraphs, subgraphChildIds, direction, NODE_GAP);

  // Step 7: Compute overflow positions
  const posOverflows = computeOverflowPositions(subgraphs, positioned.nodePositions, nodeSizes, direction);

  // Step 8: Position annotations
  const posAnnotations = positionAnnotations(annotations, positioned.nodePositions, nodeSizes, subgraphChildIds);

  // Step 8b: Build positioned nodes early for collision check
  const posNodesForCollision = allNodes.filter(n => !codeblockIds.has(n.id)).map(n => {
    const pos = positioned.nodePositions.get(n.id)!;
    const sz = nodeSizes.get(n.id)!;
    // Actors: extend collision height to include the label rendered below the stick figure
    const h = n.kind === 'actor' ? sz.h + 16 : sz.h;
    return { id: n.id, x: pos.x, y: pos.y, w: sz.w, h };
  });

  // Step 8c: Resolve annotation overlaps (collision avoidance)
  resolveAnnotationOverlaps(posAnnotations, posSubgraphs, posNodesForCollision);

  // Step 9: Build positioned codeblocks
  const posCodeblocks: PositionedCodeBlock[] = codeblocks.map(cb => {
    const pos = positioned.nodePositions.get(cb.id)!;
    const sz = nodeSizes.get(cb.id)!;
    return {
      id: cb.id,
      label: cb.label,
      code: cb.properties.code || '',
      x: pos.x,
      y: pos.y,
      w: sz.w,
      h: sz.h,
    };
  });

  // Build final positioned nodes (exclude codeblocks — they're rendered separately)
  const posNodes = allNodes.filter(n => !codeblockIds.has(n.id)).map(n => {
    const pos = positioned.nodePositions.get(n.id)!;
    const sz = nodeSizes.get(n.id)!;
    return { ...n, x: pos.x, y: pos.y, w: sz.w, h: sz.h };
  });

  // ─── Left-edge padding: ensure no elements get clipped at x=0 ───
  // Compute minimum x needed, accounting for actor label overhang and backward edges
  let minContentX = Infinity;
  for (const n of posNodes) {
    let nodeLeft = n.x;
    // Actor labels are centered at node center; they overhang to the left
    if (n.kind === 'actor') {
      const labelW = measureLineWidth(n.label, fontSizes.nodeLabel, 'mono') + n.label.length * 0.12 * fontSizes.nodeLabel;
      const cx = n.x + n.w / 2;
      nodeLeft = Math.min(nodeLeft, cx - labelW / 2 - 4);
    }
    minContentX = Math.min(minContentX, nodeLeft);
  }
  for (const ann of posAnnotations) {
    let annLeft = ann.x;
    // Step circle renders 28px to the left of annotation text
    if (ann.properties?.step) {
      annLeft -= 28;
    }
    minContentX = Math.min(minContentX, annLeft);
  }
  for (const sg of posSubgraphs) {
    minContentX = Math.min(minContentX, sg.x);
  }
  // Account for backward edge routing clearance (must match renderer's BASE_CLEARANCE + PER_EDGE_OFFSET)
  if (direction === 'TB') {
    let backwardEdgeCount = 0;
    let hasRightRouted = false;
    for (const e of allEdges) {
      const src = (e.arrow === '<--' || e.arrow === '<-.-') ? e.to : e.from;
      const tgt = (e.arrow === '<--' || e.arrow === '<-.-') ? e.from : e.to;
      const srcPos = positioned.nodePositions.get(src);
      const tgtPos = positioned.nodePositions.get(tgt);
      if (!srcPos || !tgtPos) continue;
      const srcSz = nodeSizes.get(src);
      const tgtSz = nodeSizes.get(tgt);
      if (!srcSz || !tgtSz) continue;
      if (tgtPos.y + tgtSz.h <= srcPos.y + 5) {
        const srcCx = srcPos.x + srcSz.w / 2;
        const tgtCx = tgtPos.x + tgtSz.w / 2;
        if (srcCx > tgtCx) {
          hasRightRouted = true;
        }
        backwardEdgeCount++;
      }
    }
    if (backwardEdgeCount > 0) {
      // Left-side clearance: 40px base + 20px per additional edge
      const leftClearance = 40 + Math.max(0, backwardEdgeCount - 1) * 20;
      minContentX = Math.min(minContentX, minContentX - leftClearance);
    }
    if (hasRightRouted) {
      // Right-side clearance for right-routed backward edges (handled in finalWidth below)
    }
  }

  const leftPad = MARGIN_X;
  if (minContentX < leftPad) {
    const shift = leftPad - minContentX;
    for (const n of posNodes) { n.x += shift; }
    for (const sg of posSubgraphs) { sg.x += shift; }
    for (const ov of posOverflows) { ov.x += shift; }
    for (const cb of posCodeblocks) { cb.x += shift; }
    for (const ann of posAnnotations) { ann.x += shift; }
  }

  // Adjust diagram bounds to include all elements
  let finalWidth = positioned.width + (minContentX < leftPad ? leftPad - minContentX : 0);

  // Ensure width covers all positioned nodes with margin (including actor label right overhang)
  for (const n of posNodes) {
    let nodeRight = n.x + n.w + MARGIN_X;
    // Actor labels are centered at node center; they overhang to the right too
    if (n.kind === 'actor') {
      const labelW = measureLineWidth(n.label, fontSizes.nodeLabel, 'mono') + n.label.length * 0.12 * fontSizes.nodeLabel;
      const cx = n.x + n.w / 2;
      nodeRight = Math.max(nodeRight, cx + labelW / 2 + 4 + MARGIN_X);
    }
    if (nodeRight > finalWidth) finalWidth = nodeRight;
  }
  for (const sg of posSubgraphs) {
    const sgRight = sg.x + sg.w + MARGIN_X;
    if (sgRight > finalWidth) finalWidth = sgRight;
  }

  // Extend bounds for edge labels (estimated midpoint positions)
  for (const e of allEdges) {
    if (!e.label) continue;
    const fromPos = positioned.nodePositions.get(e.from);
    const toPos = positioned.nodePositions.get(e.to);
    if (!fromPos || !toPos) continue;
    const fromSz = nodeSizes.get(e.from);
    const toSz = nodeSizes.get(e.to);
    if (!fromSz || !toSz) continue;
    const midX = (fromPos.x + fromSz.w / 2 + toPos.x + toSz.w / 2) / 2;
    const midY = (fromPos.y + fromSz.h / 2 + toPos.y + toSz.h / 2) / 2;
    const labelLen = Math.min(e.label.length, 30);
    const labelHalfW = (labelLen * 7.0 + 24) / 2;
    const labelRight = midX + labelHalfW + MARGIN_X;
    if (labelRight > finalWidth) finalWidth = labelRight;
  }

  // Title word-wrap: cap title width to content width, grow height for wrapped lines
  let titleMaxWidth: number | undefined;
  let wrappedTitleLineCount = 0;
  if (title) {
    // Bold text (font-weight:700) renders ~5% wider than regular measurement
    const BOLD_CORRECTION = 1.05;
    titleMaxWidth = Math.max(finalWidth - 60, 300);
    const rawLines = title.split('\n');
    let widestWrappedLine = 0;
    for (const line of rawLines) {
      const lineW = measureLineWidth(line, fontSizes.title, 'sans') * BOLD_CORRECTION;
      if (lineW <= titleMaxWidth) {
        wrappedTitleLineCount++;
        widestWrappedLine = Math.max(widestWrappedLine, lineW);
      } else {
        const words = line.split(/\s+/);
        let cur = '';
        for (const word of words) {
          const test = cur ? cur + ' ' + word : word;
          if (measureLineWidth(test, fontSizes.title, 'sans') * BOLD_CORRECTION > titleMaxWidth && cur) {
            widestWrappedLine = Math.max(widestWrappedLine, measureLineWidth(cur, fontSizes.title, 'sans') * BOLD_CORRECTION);
            wrappedTitleLineCount++;
            cur = word;
          } else {
            cur = test;
          }
        }
        if (cur) {
          widestWrappedLine = Math.max(widestWrappedLine, measureLineWidth(cur, fontSizes.title, 'sans') * BOLD_CORRECTION);
          wrappedTitleLineCount++;
        }
      }
    }
    // Ensure canvas is wide enough for the widest wrapped title line (+ margins)
    const titleNeededWidth = widestWrappedLine + 60; // 30px left margin + 30px right margin
    if (titleNeededWidth > finalWidth) {
      finalWidth = titleNeededWidth;
      // Recompute titleMaxWidth with the expanded width
      titleMaxWidth = Math.max(finalWidth - 60, 300);
    }
  }
  let finalHeight = positioned.height;
  const titleLinesCount = wrappedTitleLineCount || (title ? title.split('\n').length : 0);
  const titleAreaBottom = title ? MARGIN_TOP + TITLE_HEIGHT + Math.max(0, titleLinesCount - 1) * 21 + 10 : MARGIN_TOP;
  let minAnnY = titleAreaBottom;
  let maxAnnY = finalHeight;

  for (const ann of posAnnotations) {
    minAnnY = Math.min(minAnnY, ann.y);
    const lines = ann.text.split('\n');
    const annBottom = ann.y + lines.length * 18 + 10;
    maxAnnY = Math.max(maxAnnY, annBottom);

    // Extend width for annotations — no capping, annotations contribute their full width
    const maxLineLen = Math.max(...lines.map(l => l.length));
    const cappedLineLen = Math.min(maxLineLen, 50);
    const textExtent = cappedLineLen * 7 + 12;
    const isSingleLine = lines.length === 1;
    const annRight = ann.x + textExtent;
    if (annRight > finalWidth) {
      finalWidth = annRight;
    }
  }

  // Also ensure subgraphs and nodes don't overlap with title
  for (const sg of posSubgraphs) {
    minAnnY = Math.min(minAnnY, sg.y);
  }
  for (const n of posNodes) {
    minAnnY = Math.min(minAnnY, n.y);
  }

  if (minAnnY < titleAreaBottom) {
    const shift = titleAreaBottom - minAnnY;
    for (const n of posNodes) n.y += shift;
    for (const sg of posSubgraphs) sg.y += shift;
    for (const ov of posOverflows) ov.y += shift;
    for (const cb of posCodeblocks) cb.y += shift;
    for (const ann of posAnnotations) ann.y += shift;
    finalHeight += shift;
    maxAnnY += shift;
  }

  if (maxAnnY > finalHeight) finalHeight = maxAnnY + 20;

  // Ensure canvas encompasses all positioned elements with proper margins
  let maxContentRight = finalWidth;
  let maxContentBottom = finalHeight;
  let minContentLeft = Infinity;

  for (const n of posNodes) {
    let nodeBottom = n.y + n.h;
    let nodeRight = n.x + n.w;
    let nodeLeft = n.x;
    // Sublabels render ~12px below node center and may extend further
    if (n.properties.sublabel) {
      const sublabelLines = wrapLabel(n.properties.sublabel, 34);
      nodeBottom = Math.max(nodeBottom, n.y + n.h / 2 + 12 + sublabelLines.length * fontSizes.edgeLabel * 1.4);
      // Sublabel may also extend wider than the node
      const maxSubLine = sublabelLines.reduce((a, b) => a.length > b.length ? a : b, '');
      const sublabelW = measureLineWidth(maxSubLine, fontSizes.edgeLabel, 'mono') + maxSubLine.length * 0.12 * fontSizes.edgeLabel;
      const cx = n.x + n.w / 2;
      nodeRight = Math.max(nodeRight, cx + sublabelW / 2);
      nodeLeft = Math.min(nodeLeft, cx - sublabelW / 2);
    }
    // Actor labels are centered and may overhang
    if (n.kind === 'actor' && n.label) {
      const labelW = measureLineWidth(n.label, fontSizes.nodeLabel, 'mono') + n.label.length * 0.12 * fontSizes.nodeLabel;
      const cx = n.x + n.w / 2;
      nodeRight = Math.max(nodeRight, cx + labelW / 2 + 4);
      nodeLeft = Math.min(nodeLeft, cx - labelW / 2 - 4);
    }
    // All node labels with text-anchor="middle" may extend beyond the node boundary
    // (especially for circle/pill nodes where visual shape is smaller than bounding box)
    if (n.label && n.kind !== 'actor') {
      const wrappedLines = wrapLabel(n.label, 28);
      const maxLine = wrappedLines.reduce((a, b) => a.length > b.length ? a : b, '');
      const labelW = measureLineWidth(maxLine.toUpperCase(), fontSizes.nodeLabel, 'mono')
        + maxLine.length * 0.12 * fontSizes.nodeLabel;
      const cx = n.x + n.w / 2;
      nodeRight = Math.max(nodeRight, cx + labelW / 2 + 4);
      nodeLeft = Math.min(nodeLeft, cx - labelW / 2 - 4);
    }
    maxContentRight = Math.max(maxContentRight, nodeRight + MARGIN_X);
    maxContentBottom = Math.max(maxContentBottom, nodeBottom);
    minContentLeft = Math.min(minContentLeft, nodeLeft);
  }
  for (const sg of posSubgraphs) {
    maxContentRight = Math.max(maxContentRight, sg.x + sg.w + MARGIN_X);
    maxContentBottom = Math.max(maxContentBottom, sg.y + sg.h);
  }
  for (const cb of posCodeblocks) {
    maxContentRight = Math.max(maxContentRight, cb.x + cb.w + MARGIN_X);
    maxContentBottom = Math.max(maxContentBottom, cb.y + cb.h);
  }
  for (const ann of posAnnotations) {
    const lines = ann.text.split('\n');
    const maxLineLen = Math.max(...lines.map(l => l.length));
    const textExtent = Math.min(maxLineLen, 50) * 7 + 12;
    const stepOffset = ann.properties?.step ? 28 : 0;
    maxContentRight = Math.max(maxContentRight, ann.x + textExtent + MARGIN_X);
    maxContentBottom = Math.max(maxContentBottom, ann.y + lines.length * 18 + 10);
    minContentLeft = Math.min(minContentLeft, ann.x - stepOffset);
  }

  // Shift everything right if any content extends past the left margin
  if (minContentLeft < MARGIN_X) {
    const shift = MARGIN_X - minContentLeft;
    for (const n of posNodes) n.x += shift;
    for (const sg of posSubgraphs) sg.x += shift;
    for (const ov of posOverflows) ov.x += shift;
    for (const cb of posCodeblocks) cb.x += shift;
    for (const ann of posAnnotations) ann.x += shift;
    maxContentRight += shift;
  }

  if (maxContentRight > finalWidth) finalWidth = maxContentRight;
  // Add bottom margin
  if (maxContentBottom + MARGIN_TOP > finalHeight) {
    finalHeight = maxContentBottom + MARGIN_TOP;
  }

  // Universal safety margin for rounding and stroke widths
  finalWidth += 10;
  finalHeight += 10;

  return {
    width: finalWidth,
    height: finalHeight,
    direction,
    theme: diagram.theme,
    title,
    titleMaxWidth,
    nodes: posNodes,
    edges: allEdges.map(e => ({
      from: e.from, to: e.to, arrow: e.arrow,
      label: e.label, dashed: e.dashed || false,
      properties: e.properties,
      fromPt: { x: 0, y: 0 }, toPt: { x: 0, y: 0 },
    })),
    annotations: posAnnotations,
    subgraphs: posSubgraphs,
    overflows: posOverflows,
    codeblocks: posCodeblocks,
  };
}

// ─── Layer assignment (longest path) ─────────────────────

function assignLayers(
  nodes: FlowNode[],
  adj: Map<string, string[]>,
  inAdj: Map<string, string[]>,
  direction?: FlowDirection,
): string[][] {
  // Compute layers via longest path, ignoring a set of excluded (same-layer) edges
  function computeLayers(excludeEdges: Set<string>): Map<string, number> {
    const layerOf = new Map<string, number>();
    const visiting = new Set<string>();

    function dfs(id: string): number {
      if (layerOf.has(id)) return layerOf.get(id)!;
      if (visiting.has(id)) return 0;
      visiting.add(id);
      const parents = (inAdj.get(id) || [])
        .filter(p => !excludeEdges.has(`${p}->${id}`));
      let maxParent = -1;
      for (const p of parents) maxParent = Math.max(maxParent, dfs(p));
      layerOf.set(id, maxParent + 1);
      return maxParent + 1;
    }

    for (const n of nodes) dfs(n.id);
    return layerOf;
  }

  const sameLayerEdges = new Set<string>();

  // For TB mode, detect same-layer edges iteratively:
  // An edge A→B is same-layer if B has other parents that already place it at A's layer.
  if (direction === 'TB') {
    for (let iter = 0; iter < 10; iter++) {
      const layerOf = computeLayers(sameLayerEdges);
      let changed = false;

      for (const n of nodes) {
        const allParents = inAdj.get(n.id) || [];
        for (const p of allParents) {
          const edgeKey = `${p}->${n.id}`;
          if (sameLayerEdges.has(edgeKey)) continue;

          // Only consider if target has other non-excluded parents
          const otherParents = allParents
            .filter(pp => pp !== p && !sameLayerEdges.has(`${pp}->${n.id}`));
          if (otherParents.length === 0) continue;

          // Without this edge, would the target be at the source's layer or earlier?
          const layerWithout = Math.max(...otherParents.map(pp => layerOf.get(pp)!)) + 1;
          const pLayer = layerOf.get(p)!;

          if (layerWithout <= pLayer) {
            sameLayerEdges.add(edgeKey);
            changed = true;
          }
        }
      }

      if (!changed) break;
    }
  }

  // Final layer computation with all same-layer edges excluded
  const layerOf = computeLayers(sameLayerEdges);

  const maxLayer = Math.max(...Array.from(layerOf.values()), 0);
  const layers: string[][] = [];
  for (let i = 0; i <= maxLayer; i++) layers.push([]);
  for (const n of nodes) {
    layers[layerOf.get(n.id) ?? 0].push(n.id);
  }

  return layers.filter(l => l.length > 0);
}

// ─── Crossing minimization (barycenter) ──────────────────

function minimizeCrossings(
  layers: string[][],
  adj: Map<string, string[]>,
  inAdj: Map<string, string[]>,
): string[][] {
  const result = layers.map(l => [...l]);

  for (let sweep = 0; sweep < 4; sweep++) {
    for (let i = 1; i < result.length; i++) {
      const prevOrder = new Map(result[i - 1].map((id, idx) => [id, idx]));
      const curPos = new Map(result[i].map((id, idx) => [id, idx]));
      result[i].sort((a, b) => {
        const aP = (inAdj.get(a) || []).filter(p => prevOrder.has(p));
        const bP = (inAdj.get(b) || []).filter(p => prevOrder.has(p));
        const aBar = aP.length ? aP.reduce((s, p) => s + prevOrder.get(p)!, 0) / aP.length : curPos.get(a)!;
        const bBar = bP.length ? bP.reduce((s, p) => s + prevOrder.get(p)!, 0) / bP.length : curPos.get(b)!;
        return aBar - bBar;
      });
    }
    for (let i = result.length - 2; i >= 0; i--) {
      const nextOrder = new Map(result[i + 1].map((id, idx) => [id, idx]));
      const curPos = new Map(result[i].map((id, idx) => [id, idx]));
      result[i].sort((a, b) => {
        const aC = (adj.get(a) || []).filter(c => nextOrder.has(c));
        const bC = (adj.get(b) || []).filter(c => nextOrder.has(c));
        const aBar = aC.length ? aC.reduce((s, c) => s + nextOrder.get(c)!, 0) / aC.length : curPos.get(a)!;
        const bBar = bC.length ? bC.reduce((s, c) => s + nextOrder.get(c)!, 0) / bC.length : curPos.get(b)!;
        return aBar - bBar;
      });
    }
  }

  return result;
}

// ─── Coordinate assignment ───────────────────────────────

function computeLayerGap(layerNodes: string[], allEdges: FlowEdge[], subgraphChildIds?: Set<string>, nodeGap = DEFAULT_NODE_GAP): number {
  // Find the max labeled edge pair count for any node in this layer
  let maxPairCount = 0;
  let maxLabelLength = 0;
  for (const id of layerNodes) {
    const pairCounts = new Map<string, number>();
    for (const e of allEdges) {
      if (e.from !== id && e.to !== id) continue;
      if (!e.label) continue;
      const other = e.from === id ? e.to : e.from;
      pairCounts.set(other, (pairCounts.get(other) || 0) + 1);
      maxLabelLength = Math.max(maxLabelLength, e.label.length);
    }
    for (const count of pairCounts.values()) {
      maxPairCount = Math.max(maxPairCount, count);
    }
  }
  // Boost gap when nodes have labeled multi-edge pairs (e.g. bidirectional labeled edges)
  let gap = maxPairCount >= 2 ? nodeGap + (maxPairCount - 1) * 65 : nodeGap;
  // Long label gap extension removed — labels wrap at fixed width

  // Simplified fan-out boost: when an external node fans labeled edges to N targets
  // in this layer, ensure gap >= N * 15 to prevent label pileups
  if (layerNodes.length >= 2) {
    const layerSet = new Set(layerNodes);
    const externalTargets = new Map<string, Set<string>>();
    for (const id of layerNodes) {
      for (const e of allEdges) {
        if (e.from !== id && e.to !== id) continue;
        if (!e.label) continue;
        const other = e.from === id ? e.to : e.from;
        if (layerSet.has(other)) continue;
        if (!externalTargets.has(other)) externalTargets.set(other, new Set());
        externalTargets.get(other)!.add(id);
      }
    }
    for (const [, targets] of externalTargets) {
      if (targets.size >= 2) {
        gap = Math.max(gap, targets.size * 15);
      }
    }
  }

  return gap;
}

// ─── Aspect ratio adjustment ─────────────────────────────
// Scales both X and Y coordinates to approach the target aspect ratio.
// Portrait: target W/H ≈ 0.85, Landscape: W/H ≈ 1.6, Square: W/H ≈ 1.0
// Works for both TB and LR layouts by distributing scaling across both axes.

function applyAspectHint(
  aspect: AspectHint | undefined,
  positioned: { nodePositions: Map<string, { x: number; y: number }>; width: number; height: number },
): void {
  if (!aspect || aspect === 'auto') return;

  const { width, height } = positioned;
  if (width === 0 || height === 0) return;

  const currentRatio = width / height;
  let targetRatio: number;
  switch (aspect) {
    case 'landscape': targetRatio = 1.6; break;
    case 'square':    targetRatio = 1.0; break;
    case 'portrait':  targetRatio = 0.85; break;
    default: return;
  }

  // Only scale if the current ratio is farther from target than 10% tolerance
  if (Math.abs(currentRatio - targetRatio) < 0.1) return;

  // Distribute scaling across both axes (preserve area: scaleX * scaleY ≈ 1)
  const scaleX = Math.max(0.5, Math.min(2.0, Math.sqrt(targetRatio / currentRatio)));
  const scaleY = Math.max(0.5, Math.min(2.0, 1 / scaleX));

  let minX = Infinity, minY = Infinity;
  for (const pos of positioned.nodePositions.values()) {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
  }

  for (const pos of positioned.nodePositions.values()) {
    pos.x = minX + (pos.x - minX) * scaleX;
    pos.y = minY + (pos.y - minY) * scaleY;
  }

  positioned.width = Math.ceil(width * scaleX);
  positioned.height = Math.ceil(height * scaleY);
}

function assignCoordinates(
  layers: string[][],
  nodeSizes: Map<string, { w: number; h: number }>,
  direction: FlowDirection,
  allEdges: FlowEdge[],
  title?: string,
  annotations?: FlowAnnotation[],
  sublabelIds?: Set<string>,
  subgraphChildIds?: Set<string>,
  spacingVals: { nodeGap: number; layerGap: number; tbLayerGap: number } = { nodeGap: DEFAULT_NODE_GAP, layerGap: DEFAULT_LAYER_GAP, tbLayerGap: DEFAULT_TB_LAYER_GAP },
  wrapMode: WrapMode = 'auto',
): { nodePositions: Map<string, { x: number; y: number }>; width: number; height: number } {
  const NODE_GAP = spacingVals.nodeGap;
  const LAYER_GAP = spacingVals.layerGap;
  const TB_LAYER_GAP = spacingVals.tbLayerGap;
  const positions = new Map<string, { x: number; y: number }>();
  const titleLines = title ? title.split('\n').length : 0;
  const titleOffset = title ? TITLE_HEIGHT + Math.max(0, titleLines - 1) * 21 : 0;
  const startY = MARGIN_TOP + titleOffset;

  if (direction === 'LR') {
    const layerWidths: number[] = [];
    const layerHeights: number[] = [];
    const layerGaps: number[] = [];

    for (const layer of layers) {
      let maxW = 0, totalH = 0;
      let gap = computeLayerGap(layer, allEdges, subgraphChildIds, NODE_GAP);

      // Increase gap when nodes in this layer have annotations between them
      if (annotations && layer.length > 1) {
        for (let ni = 0; ni < layer.length - 1; ni++) {
          let neededGap = 0;
          for (const ann of annotations) {
            // Bottom annotation on current node extends into the gap
            if (ann.near === layer[ni] && (ann.side === 'bottom' || !ann.side)) {
              const lines = ann.text.split('\n');
              neededGap += 24 + lines.length * 18 + 10;
            }
            // Top annotation on next node extends into the gap from below
            if (ann.near === layer[ni + 1] && ann.side === 'top') {
              const lines = ann.text.split('\n');
              neededGap += (lines.length > 1 ? lines.length * 18 + 20 : 26);
            }
          }
          gap = Math.max(gap, neededGap);
        }
      }

      // Sublabel gap boost removed — node sizing already accounts for sublabel height

      layerGaps.push(gap);
      for (const id of layer) {
        const sz = nodeSizes.get(id)!;
        maxW = Math.max(maxW, sz.w);
        totalH += sz.h;
      }
      totalH += (layer.length - 1) * gap;
      layerWidths.push(maxW);
      layerHeights.push(totalH);
    }

    const maxCrossHeight = Math.max(...layerHeights);

    // Compute per-layer horizontal gaps to accommodate edge labels
    // Cap label width since the renderer wraps long labels
    const MAX_EDGE_LABEL_GAP = 160;
    const layerHGaps: number[] = [];
    for (let li = 0; li < layers.length; li++) {
      if (li === layers.length - 1) {
        layerHGaps.push(LAYER_GAP);
        continue;
      }
      const curSet = new Set(layers[li]);
      const nextSet = new Set(layers[li + 1]);
      let maxLabelW = 0;
      for (const e of allEdges) {
        if (!e.label) continue;
        if ((curSet.has(e.from) && nextSet.has(e.to)) ||
            (curSet.has(e.to) && nextSet.has(e.from))) {
          const labelW = Math.min(e.label.length * 6.5 + 24, MAX_EDGE_LABEL_GAP);
          maxLabelW = Math.max(maxLabelW, labelW);
        }
      }
      layerHGaps.push(maxLabelW > 0 ? Math.max(LAYER_GAP, maxLabelW) : LAYER_GAP);
    }

    // Check if this is a long single-node chain that needs serpentine folding
    const singleNodeLayers = layers.filter(l => l.length === 1).length;
    const isMostlySingleNode = singleNodeLayers > layers.length * 0.7;
    const prelimTotalW = (() => {
      let x = MARGIN_X;
      for (let li = 0; li < layers.length; li++) {
        x += layerWidths[li] + layerHGaps[li];
      }
      return x - layerHGaps[layers.length - 1] + MARGIN_X;
    })();
    const prelimTotalH = startY + maxCrossHeight + MARGIN_TOP;
    const prelimRatio = prelimTotalW / Math.max(prelimTotalH, 1);

    if (wrapMode !== 'none' && prelimRatio > MAX_ASPECT_RATIO && isMostlySingleNode && layers.length >= 4) {
      // ─── Serpentine chain folding ───────────────────────
      // Fold long chains into multiple rows for compact layout
      const targetRatio = 2.0;
      const rowCount = Math.max(2, Math.ceil(Math.sqrt(prelimRatio / targetRatio)));
      const layersPerRow = Math.ceil(layers.length / rowCount);

      // Compute max node height for row spacing
      let maxNodeH = 0;
      for (const layer of layers) {
        for (const id of layer) {
          maxNodeH = Math.max(maxNodeH, nodeSizes.get(id)!.h);
        }
      }
      const rowGap = maxNodeH + 60;

      let maxRowW = 0;
      for (let row = 0; row < rowCount; row++) {
        const startLi = row * layersPerRow;
        const endLi = Math.min(startLi + layersPerRow, layers.length);
        const isReverse = row % 2 === 1;

        // Compute row width
        let rowW = 0;
        for (let li = startLi; li < endLi; li++) {
          rowW += layerWidths[li] + (li < endLi - 1 ? layerHGaps[li] : 0);
        }
        maxRowW = Math.max(maxRowW, rowW);

        let curX = MARGIN_X;
        for (let i = 0; i < endLi - startLi; i++) {
          const li = isReverse ? (endLi - 1 - i) : (startLi + i);
          const layer = layers[li];
          const layerW = layerWidths[li];
          const gap = layerGaps[li];
          const layerH = layerHeights[li];

          let curY = startY + row * rowGap + (maxNodeH - layerH) / 2;
          for (const id of layer) {
            const sz = nodeSizes.get(id)!;
            positions.set(id, { x: curX + (layerW - sz.w) / 2, y: curY });
            curY += sz.h + gap;
          }
          curX += layerW + layerHGaps[li];
        }
      }

      const totalW = maxRowW + MARGIN_X * 2;
      const totalH = startY + rowCount * rowGap + MARGIN_TOP;
      return { nodePositions: positions, width: totalW, height: totalH };
    }

    // ─── Grid fan-out for large layers ──────────────────
    // When a layer has many nodes, split into a grid of sub-columns
    let hasGridLayer = false;
    for (let li = 0; li < layers.length; li++) {
      if (layers[li].length > MAX_NODES_PER_COL) {
        hasGridLayer = true;
        break;
      }
    }

    let curX = MARGIN_X;
    for (let li = 0; li < layers.length; li++) {
      const layer = layers[li];
      const layerW = layerWidths[li];
      const gap = layerGaps[li];

      if (hasGridLayer && layer.length > MAX_NODES_PER_COL) {
        // Grid layout: split into sub-columns
        const cols = Math.ceil(layer.length / MAX_NODES_PER_COL);
        const perCol = Math.ceil(layer.length / cols);
        const subColGap = layerW + 12;

        for (let c = 0; c < cols; c++) {
          const startIdx = c * perCol;
          const endIdx = Math.min(startIdx + perCol, layer.length);
          const subColH = (endIdx - startIdx) * (nodeSizes.get(layer[0])!.h + gap) - gap;
          let curY = startY + (maxCrossHeight - subColH) / 2;

          for (let ni = startIdx; ni < endIdx; ni++) {
            const id = layer[ni];
            const sz = nodeSizes.get(id)!;
            positions.set(id, { x: curX + c * subColGap + (layerW - sz.w) / 2, y: curY });
            curY += sz.h + gap;
          }
        }
        curX += (cols - 1) * subColGap + layerW + layerHGaps[li];
      } else {
        const layerH = layerHeights[li];
        let curY = startY + (maxCrossHeight - layerH) / 2;

        for (const id of layer) {
          const sz = nodeSizes.get(id)!;
          positions.set(id, { x: curX + (layerW - sz.w) / 2, y: curY });
          curY += sz.h + gap;
        }
        curX += layerW + layerHGaps[li];
      }
    }

    const totalW = curX - layerHGaps[layers.length - 1] + MARGIN_X;
    const totalH = startY + maxCrossHeight + MARGIN_TOP;

    // LR aspect ratio correction removed — use DSL `spacing` or `aspect` hints

    return { nodePositions: positions, width: totalW, height: totalH };

  } else {
    const layerHeights: number[] = [];
    const layerWidths: number[] = [];

    for (const layer of layers) {
      let maxH = 0, totalW = 0;
      for (const id of layer) {
        const sz = nodeSizes.get(id)!;
        maxH = Math.max(maxH, sz.h);
        totalW += sz.w;
      }
      totalW += (layer.length - 1) * NODE_GAP;
      layerHeights.push(maxH);
      layerWidths.push(totalW);
    }

    const maxCrossWidth = Math.max(...layerWidths);

    let curY = startY;
    for (let li = 0; li < layers.length; li++) {
      const layer = layers[li];
      const layerH = layerHeights[li];
      const layerW = layerWidths[li];
      let curX = MARGIN_X + (maxCrossWidth - layerW) / 2;

      for (const id of layer) {
        const sz = nodeSizes.get(id)!;
        positions.set(id, { x: curX, y: curY + (layerH - sz.h) / 2 });
        curX += sz.w + NODE_GAP;
      }
      curY += layerH + TB_LAYER_GAP;
    }

    const totalW = MARGIN_X * 2 + maxCrossWidth;
    const totalH = curY - TB_LAYER_GAP + MARGIN_TOP;

    // TB aspect ratio correction removed — use DSL `spacing` or `aspect` hints

    return { nodePositions: positions, width: totalW, height: totalH };
  }
}

// ─── Node-subgraph separation ────────────────────────────

function separateNodesFromSubgraphs(
  allNodes: FlowNode[],
  nodePositions: Map<string, { x: number; y: number }>,
  nodeSizes: Map<string, { w: number; h: number }>,
  posSubgraphs: PositionedSubgraph[],
  subgraphChildIds: Set<string>,
  direction: FlowDirection,
  nodeGap: number,
): void {
  if (posSubgraphs.length === 0) return;
  const clearance = SUBGRAPH_PAD_X + nodeGap / 2;

  for (const n of allNodes) {
    if (subgraphChildIds.has(n.id)) continue;
    const pos = nodePositions.get(n.id);
    const sz = nodeSizes.get(n.id);
    if (!pos || !sz) continue;

    for (const sg of posSubgraphs) {
      // Check overlap between node rect and subgraph rect (with clearance)
      const overlapX = pos.x + sz.w + clearance > sg.x && pos.x - clearance < sg.x + sg.w;
      const overlapY = pos.y + sz.h + clearance > sg.y && pos.y - clearance < sg.y + sg.h;
      if (!overlapX || !overlapY) continue;

      // Shift node away along the primary axis
      const nodeCX = pos.x + sz.w / 2;
      const nodeCY = pos.y + sz.h / 2;
      const sgCX = sg.x + sg.w / 2;
      const sgCY = sg.y + sg.h / 2;

      if (direction === 'TB') {
        // Shift vertically
        if (nodeCY < sgCY) {
          pos.y = sg.y - sz.h - clearance;
        } else {
          pos.y = sg.y + sg.h + clearance;
        }
      } else {
        // LR: shift horizontally
        if (nodeCX < sgCX) {
          pos.x = sg.x - sz.w - clearance;
        } else {
          pos.x = sg.x + sg.w + clearance;
        }
      }
    }
  }
}

// ─── Subgraph bounding box computation ──────────────────

function computeSubgraphBounds(
  subgraphs: Subgraph[],
  nodePositions: Map<string, { x: number; y: number }>,
  nodeSizes: Map<string, { w: number; h: number }>,
): PositionedSubgraph[] {
  return subgraphs.map(sg => {
    const childIds = sg.nodes.map(n => n.id);
    if (childIds.length === 0) {
      return { id: sg.id, label: sg.label, properties: sg.properties, x: 0, y: 0, w: 200, h: 100, childIds };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of childIds) {
      const pos = nodePositions.get(id);
      const sz = nodeSizes.get(id);
      if (!pos || !sz) continue;
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + sz.w);
      maxY = Math.max(maxY, pos.y + sz.h);
    }

    return {
      id: sg.id,
      label: sg.label,
      properties: sg.properties,
      x: minX - SUBGRAPH_PAD_X,
      y: minY - SUBGRAPH_PAD_TOP,
      w: (maxX - minX) + SUBGRAPH_PAD_X * 2,
      h: (maxY - minY) + SUBGRAPH_PAD_TOP + SUBGRAPH_PAD_BOTTOM,
      childIds,
    };
  });
}

// ─── Subgraph header overlap resolution ─────────────────

function resolveSubgraphHeaderOverlaps(
  posSubgraphs: PositionedSubgraph[],
  nodePositions: Map<string, { x: number; y: number }>,
  nodeSizes: Map<string, { w: number; h: number }>,
): void {
  const textH = fontSizes.subtitle + 10;
  const clearance = 8;

  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (let i = 0; i < posSubgraphs.length; i++) {
      const a = posSubgraphs[i];
      if (!a.label) continue;
      const aTextW = a.label.length * 7.5 + 20;
      const aHdrY = a.y + 26;

      // Header-to-header collision (existing)
      for (let j = i + 1; j < posSubgraphs.length; j++) {
        const b = posSubgraphs[j];
        if (!b.label) continue;
        const bTextW = b.label.length * 7.5 + 20;
        const bHdrY = b.y + 26;

        const aCx = a.x + a.w / 2;
        const bCx = b.x + b.w / 2;
        const xOverlap = Math.abs(aCx - bCx) < (aTextW + bTextW) / 2 + clearance;
        const yOverlap = Math.abs(aHdrY - bHdrY) < textH + 4;

        if (xOverlap && yOverlap) {
          const [, lower] = aHdrY <= bHdrY ? [a, b] : [b, a];
          const upperHdrBottom = Math.min(aHdrY, bHdrY) + textH / 2 + 4;
          const lowerHdrTop = Math.max(aHdrY, bHdrY) - textH / 2;
          const shift = upperHdrBottom - lowerHdrTop;

          if (shift > 0) {
            for (const childId of lower.childIds) {
              const pos = nodePositions.get(childId);
              if (pos) pos.y += shift;
            }
            let minY = Infinity, maxY = -Infinity;
            for (const childId of lower.childIds) {
              const pos = nodePositions.get(childId);
              const sz = nodeSizes.get(childId);
              if (!pos || !sz) continue;
              minY = Math.min(minY, pos.y);
              maxY = Math.max(maxY, pos.y + sz.h);
            }
            if (minY !== Infinity) {
              lower.y = minY - SUBGRAPH_PAD_TOP;
              lower.h = (maxY - minY) + SUBGRAPH_PAD_TOP + SUBGRAPH_PAD_BOTTOM;
            }
            changed = true;
          }
        }
      }

      // Header-to-child collision: check if this header overlaps with child
      // nodes belonging to OTHER subgraphs (cross-subgraph collision)
      const aHdrTop = aHdrY - textH / 2 - 1;
      const aHdrBottom = aHdrY + textH / 2 + 1;
      const aHdrLeft = a.x + a.w / 2 - aTextW / 2;
      const aHdrRight = a.x + a.w / 2 + aTextW / 2;

      for (let j = 0; j < posSubgraphs.length; j++) {
        if (j === i) continue;
        const other = posSubgraphs[j];
        for (const childId of other.childIds) {
          const pos = nodePositions.get(childId);
          const sz = nodeSizes.get(childId);
          if (!pos || !sz) continue;

          // Check overlap between header and child node
          const hOverlap = aHdrLeft < pos.x + sz.w + clearance && aHdrRight > pos.x - clearance;
          const vOverlap = aHdrTop < pos.y + sz.h + clearance && aHdrBottom > pos.y - clearance;
          if (hOverlap && vOverlap) {
            // Shift child node down to clear the header
            const shift = aHdrBottom + clearance - pos.y;
            if (shift > 0) {
              pos.y += shift;
              changed = true;
            }
          }
        }
        // Recompute other subgraph bounds if any children moved
        if (changed) {
          let minY = Infinity, maxY = -Infinity;
          for (const childId of other.childIds) {
            const pos = nodePositions.get(childId);
            const sz = nodeSizes.get(childId);
            if (!pos || !sz) continue;
            minY = Math.min(minY, pos.y);
            maxY = Math.max(maxY, pos.y + sz.h);
          }
          if (minY !== Infinity) {
            other.y = minY - SUBGRAPH_PAD_TOP;
            other.h = (maxY - minY) + SUBGRAPH_PAD_TOP + SUBGRAPH_PAD_BOTTOM;
          }
        }
      }
    }
    if (!changed) break;
  }
}

// ─── Overflow position computation ──────────────────────

function computeOverflowPositions(
  subgraphs: Subgraph[],
  nodePositions: Map<string, { x: number; y: number }>,
  nodeSizes: Map<string, { w: number; h: number }>,
  direction: FlowDirection,
): PositionedOverflow[] {
  const overflows: PositionedOverflow[] = [];

  for (const sg of subgraphs) {
    const order = sg.childOrder;
    for (let i = 0; i < order.length; i++) {
      if (order[i].kind !== 'overflow') continue;

      // Find previous and next nodes
      let prevId: string | undefined;
      let nextId: string | undefined;
      for (let j = i - 1; j >= 0; j--) {
        if (order[j].kind === 'node') { prevId = order[j].id; break; }
      }
      for (let j = i + 1; j < order.length; j++) {
        if (order[j].kind === 'node') { nextId = order[j].id; break; }
      }

      if (prevId && nextId) {
        const pPos = nodePositions.get(prevId)!;
        const pSz = nodeSizes.get(prevId)!;
        const nPos = nodePositions.get(nextId)!;
        const nSz = nodeSizes.get(nextId)!;

        if (direction === 'LR') {
          // Vertical stacking — overflow between nodes vertically
          const cx = (pPos.x + pSz.w / 2 + nPos.x + nSz.w / 2) / 2;
          const cy = (pPos.y + pSz.h + nPos.y) / 2;
          overflows.push({ x: cx, y: cy });
        } else {
          // Horizontal stacking
          const cx = (pPos.x + pSz.w + nPos.x) / 2;
          const cy = (pPos.y + pSz.h / 2 + nPos.y + nSz.h / 2) / 2;
          overflows.push({ x: cx, y: cy });
        }
      }
    }
  }

  return overflows;
}

// ─── Annotation collision avoidance ──────────────────────

function resolveAnnotationOverlaps(
  annotations: PositionedAnnotation[],
  subgraphs: PositionedSubgraph[],
  posNodes?: { id: string; x: number; y: number; w: number; h: number }[],
): void {
  if (annotations.length === 0) return;

  const lineH = 18;

  // Compute approximate bounding boxes for each annotation
  const boxes = annotations.map(ann => {
    const lines = ann.text.split('\n');
    const step = ann.properties?.step;
    const textOffsetX = step ? 28 : 0;

    let maxW = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === '') continue;
      const w = i === 0
        ? measureLineWidth(lines[0], fontSizes.subtitle, 'sans')
        : measureLineWidth(lines[i], fontSizes.codeBlock, 'mono');
      maxW = Math.max(maxW, w);
    }

    return {
      x: ann.x,
      y: ann.y,
      w: textOffsetX + maxW + 16,
      h: lines.length * lineH + 10,
    };
  });

  // Resolve annotation-subgraph overlaps: push above or below based on position
  for (let i = 0; i < annotations.length; i++) {
    const b = boxes[i];
    for (const sg of subgraphs) {
      const hOverlap = b.x < sg.x + sg.w && sg.x < b.x + b.w;
      const vOverlap = b.y < sg.y + sg.h && sg.y < b.y + b.h;
      if (hOverlap && vOverlap) {
        const annCenterY = b.y + b.h / 2;
        const sgCenterY = sg.y + sg.h / 2;
        if (annCenterY <= sgCenterY) {
          const newY = sg.y - b.h - 10;
          if (newY < annotations[i].y) {
            annotations[i].y = newY;
            boxes[i].y = newY;
          }
        } else {
          const newY = sg.y + sg.h + 10;
          if (newY > annotations[i].y) {
            annotations[i].y = newY;
            boxes[i].y = newY;
          }
        }
      }
    }
  }

  // Resolve annotation-node overlaps: push annotations away from overlapping nodes
  if (posNodes) {
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (let i = 0; i < annotations.length; i++) {
        const b = boxes[i];
        for (const node of posNodes) {
          const margin = 14;
          const hOverlap = b.x < node.x + node.w + margin && node.x - margin < b.x + b.w;
          const vOverlap = b.y < node.y + node.h + margin && node.y - margin < b.y + b.h;
          if (hOverlap && vOverlap) {
            const annCenterY = b.y + b.h / 2;
            const nodeCenterY = node.y + node.h / 2;
            if (annCenterY <= nodeCenterY) {
              const newY = node.y - b.h - 16;
              // Check if pushing up would still overlap another node
              let stillOverlaps = false;
              for (const other of posNodes) {
                if (other === node) continue;
                const hO = b.x < other.x + other.w + margin && other.x - margin < b.x + b.w;
                const vO = newY < other.y + other.h + margin && other.y - margin < newY + b.h;
                if (hO && vO) { stillOverlaps = true; break; }
              }
              if (stillOverlaps) {
                // Horizontal escape: move annotation to the right of the node
                annotations[i].x = node.x + node.w + 16;
                boxes[i].x = node.x + node.w + 16;
              } else {
                annotations[i].y = newY;
                boxes[i].y = newY;
              }
            } else {
              const newY = node.y + node.h + 16;
              annotations[i].y = newY;
              boxes[i].y = newY;
            }
            changed = true;
          }
        }
      }
      if (!changed) break;
    }
  }

  // Resolve annotation-annotation overlaps
  // Sort by x position (left to right) for consistent resolution
  const indices = annotations.map((_, i) => i).sort((a, b) => boxes[a].x - boxes[b].x);

  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        const ai = indices[i], bi = indices[j];
        const a = boxes[ai], b = boxes[bi];

        const hOverlap = a.x < b.x + b.w && b.x < a.x + a.w;
        const vOverlap = a.y < b.y + b.h && b.y < a.y + a.h;

        if (hOverlap && vOverlap) {
          // Try side-by-side placement first (2-column grid layout)
          const sideByX = a.x + a.w + 24;
          if (sideByX + b.w < 900) {
            annotations[bi].x = sideByX;
            boxes[bi].x = sideByX;
            annotations[bi].y = annotations[ai].y;
            boxes[bi].y = boxes[ai].y;
          } else {
            // Fall back: place below
            const newY = a.y + a.h + 16;
            annotations[bi].y = newY;
            boxes[bi].y = newY;
          }
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
}

// ─── Annotation positioning ──────────────────────────────

function positionAnnotations(
  annotations: FlowAnnotation[],
  nodePositions: Map<string, { x: number; y: number }>,
  nodeSizes: Map<string, { w: number; h: number }>,
  subgraphChildIds: Set<string>,
): PositionedAnnotation[] {
  // Compute rightmost content edge for placing right-side annotations at margin
  let maxContentRight = 0;
  for (const [id, pos] of nodePositions) {
    const sz = nodeSizes.get(id);
    if (sz) maxContentRight = Math.max(maxContentRight, pos.x + sz.w);
  }

  // Helper to check if a candidate position overlaps any node
  function checkOverlap(
    candX: number, candY: number, annW: number, annH: number,
    nearId: string, margin = 6,
  ): boolean {
    for (const [otherId, otherPos] of nodePositions) {
      if (otherId === nearId) continue;
      const otherSz = nodeSizes.get(otherId);
      if (!otherSz) continue;
      const hOverlap = candX < otherPos.x + otherSz.w + margin && otherPos.x - margin < candX + annW;
      const vOverlap = candY < otherPos.y + otherSz.h + margin && otherPos.y - margin < candY + annH;
      if (hOverlap && vOverlap) return true;
    }
    return false;
  }

  return annotations.map(a => {
    const pos = nodePositions.get(a.near);
    const sz = nodeSizes.get(a.near);
    if (!pos || !sz) return { text: a.text, x: 100, y: 100, properties: a.properties };

    const lines = a.text.split('\n');
    const isMultiline = lines.length > 1;
    const multilineHeight = isMultiline ? lines.length * 18 + 10 : 0;
    // Extra offset for nodes inside subgraphs (clear subgraph border)
    const sgExtra = subgraphChildIds.has(a.near) ? SUBGRAPH_PAD_TOP + 10 : 0;

    // Estimate annotation dimensions for overlap checking
    const maxLineW = isMultiline
      ? measureLineWidth(lines[0], fontSizes.subtitle, 'sans') + 40
      : 120;
    const annH = isMultiline ? multilineHeight : 20;

    // Candidate positions for each side
    const candidates = {
      right: { x: pos.x + sz.w + 12, y: pos.y + sz.h / 2 + 4 },
      left: (() => {
        const annTextW = measureLineWidth(lines[0], isMultiline ? fontSizes.subtitle : fontSizes.annotation, isMultiline ? 'sans' : 'mono');
        const stepOffset = a.properties?.step ? 28 : 0;
        const totalW = stepOffset + annTextW + 8;
        return { x: pos.x - totalW - 8, y: pos.y + sz.h / 2 + 4 };
      })(),
      top: {
        x: isMultiline ? pos.x : pos.x + sz.w / 2,
        y: pos.y - (isMultiline ? multilineHeight + 10 + sgExtra : 16 + sgExtra),
      },
      bottom: {
        x: isMultiline ? pos.x : pos.x + sz.w / 2,
        y: pos.y + sz.h + 24 + sgExtra,
      },
    };

    // Try the requested side first, then fallback sides, then margin
    const side = a.side || 'right';
    const fallbackOrder: Record<string, string[]> = {
      right: ['right', 'top', 'bottom', 'left'],
      left: ['left', 'top', 'bottom', 'right'],
      top: ['top', 'right', 'left', 'bottom'],
      bottom: ['bottom', 'right', 'left', 'top'],
    };

    for (const trySide of fallbackOrder[side] || [side]) {
      const cand = candidates[trySide as keyof typeof candidates];
      if (!cand) continue;
      if (!checkOverlap(cand.x, cand.y, maxLineW, annH, a.near)) {
        return { text: a.text, x: cand.x, y: cand.y, properties: a.properties };
      }
    }

    // Last resort: place at diagram right margin, near the target node's y
    return { text: a.text, x: maxContentRight + 24, y: pos.y + sz.h / 2, properties: a.properties };
  });
}

// ─── TB coordinate refinement ────────────────────────────

function refineCoordinatesTB(
  layers: string[][],
  positions: Map<string, { x: number; y: number }>,
  nodeSizes: Map<string, { w: number; h: number }>,
  allEdges: FlowEdge[],
): void {
  // Build bidirectional adjacency from ALL edges (including back edges)
  const neighbors = new Map<string, Set<string>>();
  for (const [id] of positions) neighbors.set(id, new Set());
  for (const e of allEdges) {
    if (neighbors.has(e.from) && neighbors.has(e.to)) {
      neighbors.get(e.from)!.add(e.to);
      neighbors.get(e.to)!.add(e.from);
    }
  }

  // For single-node layers, align with the barycenter of connected nodes
  // This reduces edge crossings (e.g., UTILS aligns above its children)
  for (const layer of layers) {
    if (layer.length !== 1) continue;
    const id = layer[0];
    const sz = nodeSizes.get(id)!;
    const nbrs = neighbors.get(id);
    if (!nbrs || nbrs.size === 0) continue;

    const cxValues: number[] = [];
    for (const nid of nbrs) {
      const p = positions.get(nid);
      const s = nodeSizes.get(nid);
      if (p && s) {
        cxValues.push(p.x + s.w / 2);
      }
    }
    if (cxValues.length === 0) continue;

    // Use median — robust against outliers pulling center away
    cxValues.sort((a, b) => a - b);
    const midTB = Math.floor(cxValues.length / 2);
    const medianCx = cxValues.length % 2 === 1
      ? cxValues[midTB]
      : (cxValues[midTB - 1] + cxValues[midTB]) / 2;
    const pos = positions.get(id)!;
    positions.set(id, { x: medianCx - sz.w / 2, y: pos.y });
  }
}

// ─── LR coordinate refinement ────────────────────────────

function refineCoordinatesLR(
  layers: string[][],
  positions: Map<string, { x: number; y: number }>,
  nodeSizes: Map<string, { w: number; h: number }>,
  allEdges: FlowEdge[],
): void {
  // Build bidirectional adjacency from ALL edges
  const neighbors = new Map<string, Set<string>>();
  for (const [id] of positions) neighbors.set(id, new Set());
  for (const e of allEdges) {
    if (neighbors.has(e.from) && neighbors.has(e.to)) {
      neighbors.get(e.from)!.add(e.to);
      neighbors.get(e.to)!.add(e.from);
    }
  }

  // For single-node layers in LR, align vertically (y-axis) with median of connected nodes
  // Only for nodes with 1-2 neighbors — centering is better for nodes with many connections
  for (const layer of layers) {
    if (layer.length !== 1) continue;
    const id = layer[0];
    const sz = nodeSizes.get(id)!;
    const nbrs = neighbors.get(id);
    if (!nbrs || nbrs.size === 0) continue;

    const cyValues: number[] = [];
    for (const nid of nbrs) {
      const p = positions.get(nid);
      const s = nodeSizes.get(nid);
      if (p && s) {
        cyValues.push(p.y + s.h / 2);
      }
    }
    if (cyValues.length === 0) continue;

    cyValues.sort((a, b) => a - b);
    const midLR = Math.floor(cyValues.length / 2);
    const medianCy = cyValues.length % 2 === 1
      ? cyValues[midLR]
      : (cyValues[midLR - 1] + cyValues[midLR]) / 2;
    const pos = positions.get(id)!;
    positions.set(id, { x: pos.x, y: medianCy - sz.h / 2 });
  }
}
