// Edge rendering primitives for n9tgraph
import { colors, fonts, fontSizes, stroke, opacity } from './theme.js';

export interface Point {
  x: number;
  y: number;
}

export interface EdgeOpts {
  from: Point;
  to: Point;
  label?: string;
  dashed?: boolean;
  color?: string;
  markerEnd?: string;
  markerStart?: string;
}

/** Straight arrow between two points */
export function straightEdge(opts: EdgeOpts): string {
  const {
    from, to, label, dashed = false,
    color = colors.accent,
    markerEnd = 'url(#arrowhead)',
    markerStart,
  } = opts;
  const dashAttr = dashed ? ` stroke-dasharray="${stroke.edgeDash}"` : '';
  const markerStartAttr = markerStart ? ` marker-start="${markerStart}"` : '';
  let svg = `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${color}" stroke-width="${stroke.edge}"${dashAttr}${markerStartAttr} marker-end="${markerEnd}"/>`;
  if (label) {
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    svg += edgeLabel(mx, my, label);
  }
  return svg;
}

/** Polyline / orthogonal edge with right-angle bends */
export function polylineEdge(opts: EdgeOpts & { waypoints?: Point[] }): string {
  const {
    from, to, waypoints = [], label, dashed = false,
    color = colors.accent,
    markerEnd = 'url(#arrowhead)',
    markerStart,
  } = opts;
  const points = [from, ...waypoints, to];
  const pointStr = points.map(p => `${p.x},${p.y}`).join(' ');
  const dashAttr = dashed ? ` stroke-dasharray="${stroke.edgeDash}"` : '';
  const markerStartAttr = markerStart ? ` marker-start="${markerStart}"` : '';
  let svg = `<polyline points="${pointStr}" fill="none" stroke="${color}" stroke-width="${stroke.edge}"${dashAttr}${markerStartAttr} marker-end="${markerEnd}"/>`;
  if (label) {
    // place label at midpoint of the full path
    const mid = points[Math.floor(points.length / 2)];
    svg += edgeLabel(mid.x, mid.y - 8, label);
  }
  return svg;
}

/** Bidirectional edge */
export function biEdge(opts: EdgeOpts): string {
  return straightEdge({
    ...opts,
    markerEnd: 'url(#arrowhead)',
    markerStart: 'url(#arrowhead-reverse)',
  });
}

/** Render an edge label at a given position */
export function edgeLabel(x: number, y: number, text: string): string {
  // background pill for readability
  const padX = 6;
  const padY = 3;
  const estW = text.length * 6.5 + padX * 2;
  let svg = `<rect x="${x - estW / 2}" y="${y - fontSizes.edgeLabel - padY}" width="${estW}" height="${fontSizes.edgeLabel + padY * 2 + 2}" rx="4" fill="${colors.bg}" opacity="0.9"/>`;
  svg += `<text x="${x}" y="${y}" font-family="${fonts.mono}" font-size="${fontSizes.edgeLabel}" fill="${colors.accent}" opacity="${opacity.edgeLabel}" text-anchor="middle">${text}</text>`;
  return svg;
}

/** Numbered circle marker (e.g. step indicators on edges) */
export function numberedCircle(x: number, y: number, num: number, color = colors.accent): string {
  const r = 11;
  let svg = `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="none"/>`;
  svg += `<text x="${x}" y="${y}" font-family="${fonts.mono}" font-size="11" fill="${colors.bg}" text-anchor="middle" dominant-baseline="central" font-weight="700">${num}</text>`;
  return svg;
}
