// Sugiyama-style layered layout for flow diagrams
import type { FlowDiagram, FlowNode, FlowEdge, FlowAnnotation, FlowDirection } from '../parser/ast.js';
import { nodeSizeForLabel } from './text-measure.js';
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
  fromPt: { x: number; y: number };
  toPt: { x: number; y: number };
}

export interface PositionedAnnotation {
  text: string;
  x: number;
  y: number;
}

export interface FlowLayout {
  width: number;
  height: number;
  title?: string;
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  annotations: PositionedAnnotation[];
}

// ─── Constants ───────────────────────────────────────────

const MARGIN_X = 80;
const MARGIN_TOP = 30;
const TITLE_HEIGHT = 40;
const LAYER_GAP = 340;
const NODE_GAP = 180;
const ACTOR_W = 50;
const ACTOR_H = 70;
const MIN_NODE_W = 100;

// ─── Main entry ──────────────────────────────────────────

export function layoutFlow(diagram: FlowDiagram): FlowLayout {
  const { nodes, edges, annotations, direction, title } = diagram;
  if (nodes.length === 0) {
    return { width: 200, height: 100, title, nodes: [], edges: [], annotations: [] };
  }

  // Build forward adjacency from --> edges (original direction)
  // For layering, --> means from→to. <-- means to→from visually, but
  // we keep original from/to for rendering. For layout graph we use
  // the visual flow direction.
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());

  for (const e of edges) {
    const src = e.arrow === '<--' ? e.to : e.from;
    const tgt = e.arrow === '<--' ? e.from : e.to;
    if (adj.has(src) && adj.has(tgt)) {
      adj.get(src)!.add(tgt);
    }
  }

  // Step 1: Cycle removal via DFS — identify back edges
  const backEdges = new Set<string>();
  {
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>();
    for (const n of nodes) color.set(n.id, WHITE);

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
    for (const n of nodes) {
      if (color.get(n.id) === WHITE) dfs(n.id);
    }
  }

  // Build DAG adjacency (without back edges)
  const dagAdj = new Map<string, string[]>();
  const dagInAdj = new Map<string, string[]>();
  for (const n of nodes) {
    dagAdj.set(n.id, []);
    dagInAdj.set(n.id, []);
  }
  for (const e of edges) {
    const src = e.arrow === '<--' ? e.to : e.from;
    const tgt = e.arrow === '<--' ? e.from : e.to;
    if (!backEdges.has(`${src}->${tgt}`) && dagAdj.has(src) && dagAdj.has(tgt)) {
      dagAdj.get(src)!.push(tgt);
      dagInAdj.get(tgt)!.push(src);
    }
  }

  // Step 2: Layer assignment (longest path from sources in DAG)
  const layers = assignLayers(nodes, dagAdj, dagInAdj);

  // Step 3: Crossing minimization
  const ordered = minimizeCrossings(layers, dagAdj, dagInAdj);

  // Step 4: Compute node sizes
  const nodeSizes = new Map<string, { w: number; h: number }>();
  for (const n of nodes) {
    if (n.kind === 'actor') {
      nodeSizes.set(n.id, { w: ACTOR_W, h: ACTOR_H });
    } else {
      const size = nodeSizeForLabel(n.label, fontSizes.nodeLabel, 'mono', 28, 18);
      nodeSizes.set(n.id, { w: Math.max(size.w, MIN_NODE_W), h: Math.max(size.h, 44) });
    }
  }

  // Step 5: Coordinate assignment
  const positioned = assignCoordinates(ordered, nodeSizes, direction, title);

  // Step 6: Position annotations (needs node sizes)
  const posAnnotations = positionAnnotations(annotations, positioned.nodePositions, nodeSizes);

  return {
    width: positioned.width,
    height: positioned.height,
    title,
    nodes: nodes.map(n => {
      const pos = positioned.nodePositions.get(n.id)!;
      const sz = nodeSizes.get(n.id)!;
      return { ...n, x: pos.x, y: pos.y, w: sz.w, h: sz.h };
    }),
    edges: edges.map(e => ({
      from: e.from, to: e.to, arrow: e.arrow,
      label: e.label, dashed: e.dashed || false,
      fromPt: { x: 0, y: 0 }, toPt: { x: 0, y: 0 }, // computed in renderer
    })),
    annotations: posAnnotations,
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

// ─── Annotation positioning ──────────────────────────────

function positionAnnotations(
  annotations: FlowAnnotation[],
  nodePositions: Map<string, { x: number; y: number }>,
  nodeSizes: Map<string, { w: number; h: number }>,
): PositionedAnnotation[] {
  return annotations.map(a => {
    const pos = nodePositions.get(a.near);
    const sz = nodeSizes.get(a.near);
    if (!pos || !sz) return { text: a.text, x: 100, y: 100 };

    const side = a.side || 'right';
    switch (side) {
      case 'right':
        return { text: a.text, x: pos.x + sz.w + 20, y: pos.y + sz.h / 2 + 4 };
      case 'left':
        return { text: a.text, x: pos.x - 20, y: pos.y + sz.h / 2 + 4 };
      case 'top':
        return { text: a.text, x: pos.x + sz.w / 2, y: pos.y - 16 };
      case 'bottom':
        return { text: a.text, x: pos.x + sz.w / 2, y: pos.y + sz.h + 24 };
    }
  });
}
