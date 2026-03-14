// Edge rendering primitives for n9tgraph
import { colors, fonts, fontSizes, stroke, opacity } from './theme.js';

export interface Point {
  x: number;
  y: number;
}

export function edgePoints(from: Point, to: Point, waypoints: Point[] = []): Point[] {
  return [from, ...waypoints, to];
}

export function pointOnPolylineAtT(
  points: Point[],
  t: number,
): { x: number; y: number; tangent: Point; normal: Point } {
  if (points.length === 0) {
    return { x: 0, y: 0, tangent: { x: 1, y: 0 }, normal: { x: 0, y: -1 } };
  }
  if (points.length === 1) {
    return { x: points[0].x, y: points[0].y, tangent: { x: 1, y: 0 }, normal: { x: 0, y: -1 } };
  }

  const clampedT = Math.max(0, Math.min(1, t));
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    lengths.push(len);
    total += len;
  }

  if (total === 0) {
    return { x: points[0].x, y: points[0].y, tangent: { x: 1, y: 0 }, normal: { x: 0, y: -1 } };
  }

  const target = total * clampedT;
  let walked = 0;
  for (let i = 0; i < lengths.length; i++) {
    const segLen = lengths[i];
    if (walked + segLen >= target || i === lengths.length - 1) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const localT = segLen === 0 ? 0 : (target - walked) / segLen;
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const unitX = segLen === 0 ? 1 : dx / segLen;
      const unitY = segLen === 0 ? 0 : dy / segLen;
      return {
        x: p0.x + dx * localT,
        y: p0.y + dy * localT,
        tangent: { x: unitX, y: unitY },
        normal: { x: -unitY, y: unitX },
      };
    }
    walked += segLen;
  }

  const last = points[points.length - 1];
  return { x: last.x, y: last.y, tangent: { x: 1, y: 0 }, normal: { x: 0, y: -1 } };
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
  const estW = text.length * 7.0 + padX * 2;
  let svg = `<rect x="${x - estW / 2}" y="${y - fontSizes.edgeLabel - padY}" width="${estW}" height="${fontSizes.edgeLabel + padY * 2 + 2}" rx="4" fill="${colors.bg}" opacity="0.9"/>`;
  svg += `<text x="${x}" y="${y}" font-family="${fonts.mono}" font-size="${fontSizes.edgeLabel}" fill="${colors.accent}" opacity="${opacity.edgeLabel}" text-anchor="middle">${text}</text>`;
  return svg;
}

/** Render a multiline edge label — wraps text at a max width */
export function edgeLabelMultiline(x: number, y: number, text: string, maxCharsPerLine = 20, color: string = colors.accent): string {
  const { bg, fg } = edgeLabelParts(x, y, text, maxCharsPerLine, color);
  return bg + fg;
}

/** Split edge label into background and foreground parts for z-order control */
export function edgeLabelParts(x: number, y: number, text: string, maxCharsPerLine = 20, color: string = colors.accent): { bg: string; fg: string } {
  // Split text into lines at word boundaries
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current && (current + ' ' + word).length > maxCharsPerLine) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current) lines.push(current);

  const lineH = fontSizes.edgeLabel + 4;
  const totalH = lines.length * lineH;
  const padX = 6;
  const padY = 3;
  const maxLineW = Math.max(...lines.map(l => l.length)) * 7.0 + padX * 2;

  // Background rect
  const bg = `<rect x="${x - maxLineW / 2}" y="${y - totalH / 2 - padY}" width="${maxLineW}" height="${totalH + padY * 2}" rx="4" fill="${colors.bg}"/>`;
  // Text lines
  let fg = '';
  const startY = y - totalH / 2 + fontSizes.edgeLabel;
  for (let i = 0; i < lines.length; i++) {
    fg += `<text x="${x}" y="${startY + i * lineH}" font-family="${fonts.mono}" font-size="${fontSizes.edgeLabel}" fill="${color}" opacity="${opacity.edgeLabel}" text-anchor="middle">${lines[i]}</text>`;
  }
  return { bg, fg };
}

/** Numbered circle marker (e.g. step indicators on edges) */
export function numberedCircle(x: number, y: number, num: number, color: string = colors.accent): string {
  const r = 11;
  let svg = `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="none"/>`;
  svg += `<text x="${x}" y="${y}" font-family="${fonts.mono}" font-size="11" fill="${colors.bg}" text-anchor="middle" dominant-baseline="central" font-weight="700">${num}</text>`;
  return svg;
}
