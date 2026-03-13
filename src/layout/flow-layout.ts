// Sugiyama-style layered layout for flow diagrams
import type { FlowDiagram, FlowNode, FlowEdge, FlowAnnotation, FlowDirection, Subgraph, CodeBlock } from '../parser/ast.js';
import { nodeSizeForLabel, measureLineWidth } from './text-measure.js';
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
  title?: string;
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  annotations: PositionedAnnotation[];
  subgraphs: PositionedSubgraph[];
  overflows: PositionedOverflow[];
  codeblocks: PositionedCodeBlock[];
}

// ─── Constants ───────────────────────────────────────────

const MARGIN_X = 80;
const MARGIN_TOP = 30;
const TITLE_HEIGHT = 55;
const LAYER_GAP = 140;
const NODE_GAP = 40;
const ACTOR_W = 50;
const ACTOR_H = 70;
const MIN_NODE_W = 100;
const CIRCLE_R = 40;
const SUBGRAPH_PAD_X = 40;
const SUBGRAPH_PAD_TOP = 50;
const SUBGRAPH_PAD_BOTTOM = 40;
const CODEBLOCK_LINE_H = 18;
const CODEBLOCK_PAD = 12;

// ─── Main entry ──────────────────────────────────────────

export function layoutFlow(diagram: FlowDiagram): FlowLayout {
  const { nodes, edges, annotations, direction, title, subgraphs, codeblocks } = diagram;

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
    return { width: 200, height: 100, title, nodes: [], edges: [], annotations: [], subgraphs: [], overflows: [], codeblocks: [] };
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
  const layers = assignLayers(allNodes, dagAdj, dagInAdj);

  // Step 3: Crossing minimization
  const ordered = minimizeCrossings(layers, dagAdj, dagInAdj);

  // Step 4: Compute node sizes
  const nodeSizes = new Map<string, { w: number; h: number }>();
  for (const n of allNodes) {
    if (n.kind === 'actor') {
      nodeSizes.set(n.id, { w: ACTOR_W, h: ACTOR_H });
    } else if (n.kind === 'circle') {
      nodeSizes.set(n.id, { w: CIRCLE_R * 2, h: CIRCLE_R * 2 });
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
      const size = nodeSizeForLabel(n.label, fontSizes.nodeLabel, 'mono', 28, 18);
      let h = Math.max(size.h, 44);
      if (sublabel) {
        h += 20; // extra space for sublabel
      }
      // Service nodes with sublabels get taller to span connected neighbors
      if (n.kind === 'service' && sublabel) {
        h = Math.max(h, 120);
      }
      nodeSizes.set(n.id, { w: Math.max(size.w, MIN_NODE_W), h });
    }
  }

  // Step 5: Coordinate assignment
  const positioned = assignCoordinates(ordered, nodeSizes, direction, title);

  // Step 6: Compute subgraph bounding boxes
  const posSubgraphs = computeSubgraphBounds(subgraphs, positioned.nodePositions, nodeSizes);

  // Step 7: Compute overflow positions
  const posOverflows = computeOverflowPositions(subgraphs, positioned.nodePositions, nodeSizes, direction);

  // Step 8: Position annotations
  const posAnnotations = positionAnnotations(annotations, positioned.nodePositions, nodeSizes, subgraphChildIds);

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

  // Adjust diagram bounds to include multi-line annotations
  let finalWidth = positioned.width;
  let finalHeight = positioned.height;
  const titleAreaBottom = title ? MARGIN_TOP + TITLE_HEIGHT + 10 : MARGIN_TOP;
  let minAnnY = titleAreaBottom;
  let maxAnnY = finalHeight;

  for (const ann of posAnnotations) {
    minAnnY = Math.min(minAnnY, ann.y);
    const lines = ann.text.split('\n');
    const annBottom = ann.y + lines.length * 18 + 10;
    maxAnnY = Math.max(maxAnnY, annBottom);
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

  return {
    width: finalWidth,
    height: finalHeight,
    title,
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
): string[][] {
  const layerOf = new Map<string, number>();
  const visiting = new Set<string>();

  function dfs(id: string): number {
    if (layerOf.has(id)) return layerOf.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const parents = inAdj.get(id) || [];
    let maxParent = -1;
    for (const p of parents) {
      maxParent = Math.max(maxParent, dfs(p));
    }
    const layer = maxParent + 1;
    layerOf.set(id, layer);
    return layer;
  }

  for (const n of nodes) dfs(n.id);

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
      result[i].sort((a, b) => {
        const aP = (inAdj.get(a) || []).filter(p => prevOrder.has(p));
        const bP = (inAdj.get(b) || []).filter(p => prevOrder.has(p));
        const aBar = aP.length ? aP.reduce((s, p) => s + prevOrder.get(p)!, 0) / aP.length : 0;
        const bBar = bP.length ? bP.reduce((s, p) => s + prevOrder.get(p)!, 0) / bP.length : 0;
        return aBar - bBar;
      });
    }
    for (let i = result.length - 2; i >= 0; i--) {
      const nextOrder = new Map(result[i + 1].map((id, idx) => [id, idx]));
      result[i].sort((a, b) => {
        const aC = (adj.get(a) || []).filter(c => nextOrder.has(c));
        const bC = (adj.get(b) || []).filter(c => nextOrder.has(c));
        const aBar = aC.length ? aC.reduce((s, c) => s + nextOrder.get(c)!, 0) / aC.length : 0;
        const bBar = bC.length ? bC.reduce((s, c) => s + nextOrder.get(c)!, 0) / bC.length : 0;
        return aBar - bBar;
      });
    }
  }

  return result;
}

// ─── Coordinate assignment ───────────────────────────────

function assignCoordinates(
  layers: string[][],
  nodeSizes: Map<string, { w: number; h: number }>,
  direction: FlowDirection,
  title?: string,
): { nodePositions: Map<string, { x: number; y: number }>; width: number; height: number } {
  const positions = new Map<string, { x: number; y: number }>();
  const titleOffset = title ? TITLE_HEIGHT : 0;
  const startY = MARGIN_TOP + titleOffset;

  if (direction === 'LR') {
    const layerWidths: number[] = [];
    const layerHeights: number[] = [];

    for (const layer of layers) {
      let maxW = 0, totalH = 0;
      for (const id of layer) {
        const sz = nodeSizes.get(id)!;
        maxW = Math.max(maxW, sz.w);
        totalH += sz.h;
      }
      totalH += (layer.length - 1) * NODE_GAP;
      layerWidths.push(maxW);
      layerHeights.push(totalH);
    }

    const maxCrossHeight = Math.max(...layerHeights);

    let curX = MARGIN_X;
    for (let li = 0; li < layers.length; li++) {
      const layer = layers[li];
      const layerW = layerWidths[li];
      const layerH = layerHeights[li];
      let curY = startY + (maxCrossHeight - layerH) / 2;

      for (const id of layer) {
        const sz = nodeSizes.get(id)!;
        positions.set(id, { x: curX + (layerW - sz.w) / 2, y: curY });
        curY += sz.h + NODE_GAP;
      }
      curX += layerW + LAYER_GAP;
    }

    const totalW = curX - LAYER_GAP + MARGIN_X;
    const totalH = startY + maxCrossHeight + MARGIN_TOP;
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
      curY += layerH + LAYER_GAP;
    }

    const totalW = MARGIN_X * 2 + maxCrossWidth;
    const totalH = curY - LAYER_GAP + MARGIN_TOP;
    return { nodePositions: positions, width: totalW, height: totalH };
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

// ─── Annotation positioning ──────────────────────────────

function positionAnnotations(
  annotations: FlowAnnotation[],
  nodePositions: Map<string, { x: number; y: number }>,
  nodeSizes: Map<string, { w: number; h: number }>,
  subgraphChildIds: Set<string>,
): PositionedAnnotation[] {
  return annotations.map(a => {
    const pos = nodePositions.get(a.near);
    const sz = nodeSizes.get(a.near);
    if (!pos || !sz) return { text: a.text, x: 100, y: 100, properties: a.properties };

    const lines = a.text.split('\n');
    const isMultiline = lines.length > 1;
    const multilineHeight = isMultiline ? lines.length * 18 + 10 : 0;
    // Extra offset for nodes inside subgraphs (clear subgraph border)
    const sgExtra = subgraphChildIds.has(a.near) ? SUBGRAPH_PAD_TOP + 10 : 0;

    const side = a.side || 'right';
    switch (side) {
      case 'right':
        return { text: a.text, x: pos.x + sz.w + 20, y: pos.y + sz.h / 2 + 4, properties: a.properties };
      case 'left':
        return { text: a.text, x: pos.x - 20, y: pos.y + sz.h / 2 + 4, properties: a.properties };
      case 'top':
        return { text: a.text, x: isMultiline ? pos.x : pos.x + sz.w / 2, y: pos.y - (isMultiline ? multilineHeight + 10 + sgExtra : 16 + sgExtra), properties: a.properties };
      case 'bottom':
        return { text: a.text, x: isMultiline ? pos.x : pos.x + sz.w / 2, y: pos.y + sz.h + 24 + sgExtra, properties: a.properties };
    }
  });
}
