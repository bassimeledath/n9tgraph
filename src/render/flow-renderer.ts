// Flow diagram SVG renderer
import type { FlowLayout, PositionedNode, PositionedEdge, PositionedAnnotation } from '../layout/flow-layout.js';
import { colors, fonts, fontSizes, spacing, opacity } from './theme.js';
import { rect, cylinder, doubleBorder, actor, annotation } from './shapes.js';
import { straightEdge, biEdge, edgeLabelMultiline } from './edges.js';
import type { EdgeOpts } from './edges.js';

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fillForPattern(fill?: string): string {
  switch (fill) {
    case 'hero': return 'url(#hero)';
    case 'dotgrid': return 'url(#dotgrid)';
    case 'crosshatch': return 'url(#crosshatch)';
    default: return 'transparent';
  }
}

function renderNode(node: PositionedNode): string {
  const { x, y, w, h, label, kind, properties } = node;
  const fill = fillForPattern(properties.fill);

  if (kind === 'actor') {
    const cx = x + w / 2;
    const cy = y + 7;
    return actor({ x: cx, y: cy, label, color: colors.accent });
  }

  if (kind === 'service') {
    const svcFill = properties.fill ? fill : 'url(#hero)';
    return doubleBorder({ x, y, w, h, label, fill: svcFill });
  }

  if (kind === 'datastore') {
    return cylinder({ x, y, w, h, label, fill });
  }

  // component, external, label, default
  return rect({ x, y, w, h, label, fill });
}

/** Compute the point on the border of `node` facing toward `target` center */
function connectionPoint(
  node: PositionedNode,
  tx: number, ty: number,
): { x: number; y: number } {
  // For actors, use a simple bounding box
  if (node.kind === 'actor') {
    const cx = node.x + node.w / 2;
    const midY = node.y + (node.h - 14) / 2; // center of body (above label)
    const halfW = 14;
    const halfH = (node.h - 14) / 2;

    const dx = tx - cx;
    const dy = ty - midY;
    if (dx === 0 && dy === 0) return { x: cx, y: midY };

    if (Math.abs(dx) / halfW > Math.abs(dy) / halfH) {
      return { x: dx > 0 ? cx + halfW : cx - halfW, y: midY + dy * (halfW / Math.abs(dx)) };
    }
    return { x: cx + dx * (halfH / Math.abs(dy)), y: dy > 0 ? midY + halfH : midY - halfH };
  }

  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  const hw = node.w / 2;
  const hh = node.h / 2;

  if (Math.abs(dx) * hh > Math.abs(dy) * hw) {
    const signX = dx > 0 ? 1 : -1;
    return { x: cx + signX * hw, y: cy + dy * (hw / Math.abs(dx)) };
  }
  const signY = dy > 0 ? 1 : -1;
  return { x: cx + dx * (hh / Math.abs(dy)), y: cy + signY * hh };
}

function nodeCenter(n: PositionedNode): { x: number; y: number } {
  if (n.kind === 'actor') {
    return { x: n.x + n.w / 2, y: n.y + (n.h - 14) / 2 };
  }
  return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
}

/** Check if two edges connect the same pair of nodes (in any direction) */
function edgePairKey(e: PositionedEdge): string {
  const a = e.from < e.to ? e.from : e.to;
  const b = e.from < e.to ? e.to : e.from;
  return `${a}--${b}`;
}

function renderEdges(edges: PositionedEdge[], nodes: PositionedNode[]): string {
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const parts: string[] = [];

  // Group edges by node pair to spread connection points
  const pairEdges = new Map<string, PositionedEdge[]>();
  for (const e of edges) {
    const key = edgePairKey(e);
    if (!pairEdges.has(key)) pairEdges.set(key, []);
    pairEdges.get(key)!.push(e);
  }
  const pairIndex = new Map<string, number>();

  for (const edge of edges) {
    const visualFrom = edge.arrow === '<--' ? edge.to : edge.from;
    const visualTo = edge.arrow === '<--' ? edge.from : edge.to;

    const fromNode = nodeById.get(visualFrom);
    const toNode = nodeById.get(visualTo);
    if (!fromNode || !toNode) continue;

    const key = edgePairKey(edge);
    const siblings = pairEdges.get(key)!;
    const idx = pairIndex.get(key) || 0;
    pairIndex.set(key, idx + 1);

    // Offset connection points along the node border when multiple edges share a pair
    let fromTarget = nodeCenter(toNode);
    let toTarget = nodeCenter(fromNode);

    // Perpendicular direction (to the main axis between nodes)
    const fc = nodeCenter(fromNode);
    const tc = nodeCenter(toNode);
    const dx = tc.x - fc.x;
    const dy = tc.y - fc.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const perpX = -dy / len;
    const perpY = dx / len;

    if (siblings.length > 1) {
      // Spread connection points by offsetting the target we aim at
      const spread = 150;
      const shift = (idx - (siblings.length - 1) / 2) * spread;
      // Offset both target points perpendicular to the main axis
      fromTarget = { x: tc.x + perpX * shift, y: tc.y + perpY * shift };
      toTarget = { x: fc.x + perpX * shift, y: fc.y + perpY * shift };
    }

    const fromPt = connectionPoint(fromNode, fromTarget.x, fromTarget.y);
    const toPt = connectionPoint(toNode, toTarget.x, toTarget.y);

    // Draw the line
    const opts: EdgeOpts = {
      from: fromPt,
      to: toPt,
      dashed: edge.dashed,
      color: colors.accent,
    };

    if (edge.arrow === '<-->') {
      parts.push(biEdge(opts));
    } else {
      parts.push(straightEdge(opts));
    }

    // Draw label near source — perpendicular spread keeps opposing labels apart
    if (edge.label) {
      const t = siblings.length > 1 ? 0.30 : 0.5;
      const lx = fromPt.x + (toPt.x - fromPt.x) * t;
      const ly = fromPt.y + (toPt.y - fromPt.y) * t;
      parts.push(edgeLabelMultiline(lx, ly, escapeXml(edge.label), 18));
    }
  }

  return parts.join('\n');
}

function renderAnnotation(ann: PositionedAnnotation): string {
  return annotation(ann.x, ann.y, escapeXml(ann.text));
}

function renderTitle(title: string): string {
  return `<text x="30" y="34" font-family="${fonts.sans}" font-size="${fontSizes.title}" fill="${colors.white}" font-weight="700">${escapeXml(title)}</text>`;
}

export function renderFlow(layout: FlowLayout): string {
  const parts: string[] = [];

  if (layout.title) {
    parts.push(renderTitle(layout.title));
  }

  // Edges behind nodes
  parts.push(renderEdges(layout.edges, layout.nodes));

  // Nodes
  for (const node of layout.nodes) {
    parts.push(renderNode(node));
  }

  // Annotations
  for (const ann of layout.annotations) {
    parts.push(renderAnnotation(ann));
  }

  return parts.join('\n');
}
