// Shape rendering primitives for n9tgraph nodes
import { colors, fonts, fontSizes, spacing, stroke, opacity } from './theme.js';

export interface ShapeOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  fill?: string;        // e.g. "url(#hero)" or a color
  borderColor?: string;
  strokeWidth?: number;
  rx?: number;
}

function labelSvg(x: number, y: number, label: string, fontSize = fontSizes.nodeLabel): string {
  return `<text x="${x}" y="${y}" font-family="${fonts.mono}" font-size="${fontSize}" fill="${colors.accent}" text-anchor="middle" dominant-baseline="central" letter-spacing="${spacing.letterSpacing}">${label.toUpperCase()}</text>`;
}

/** Standard rectangular node with rounded corners */
export function rect(opts: ShapeOpts): string {
  const { x, y, w, h, label, fill = 'transparent', borderColor = colors.nodeBorder, strokeWidth = stroke.node, rx = spacing.borderRadius } = opts;
  let svg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${borderColor}" stroke-width="${strokeWidth}"/>`;
  if (label) {
    svg += labelSvg(x + w / 2, y + h / 2, label);
  }
  return svg;
}

/** Pill-shaped node (fully rounded ends) */
export function pill(opts: ShapeOpts): string {
  return rect({ ...opts, rx: spacing.pillRadius });
}

/** Cylinder shape (database/storage) */
export function cylinder(opts: ShapeOpts): string {
  const { x, y, w, h, label, fill = 'transparent', borderColor = colors.nodeBorder, strokeWidth = stroke.node } = opts;
  const ry = 10; // ellipse vertical radius for top/bottom
  const bodyH = h - ry * 2;
  let svg = '';
  // body rectangle
  svg += `<rect x="${x}" y="${y + ry}" width="${w}" height="${bodyH}" fill="${fill}" stroke="none"/>`;
  // side lines
  svg += `<line x1="${x}" y1="${y + ry}" x2="${x}" y2="${y + ry + bodyH}" stroke="${borderColor}" stroke-width="${strokeWidth}"/>`;
  svg += `<line x1="${x + w}" y1="${y + ry}" x2="${x + w}" y2="${y + ry + bodyH}" stroke="${borderColor}" stroke-width="${strokeWidth}"/>`;
  // top ellipse (full)
  svg += `<ellipse cx="${x + w / 2}" cy="${y + ry}" rx="${w / 2}" ry="${ry}" fill="${fill}" stroke="${borderColor}" stroke-width="${strokeWidth}"/>`;
  // bottom ellipse (half, only bottom arc)
  svg += `<path d="M${x},${y + ry + bodyH} A${w / 2},${ry} 0 0,0 ${x + w},${y + ry + bodyH}" fill="${fill}" stroke="${borderColor}" stroke-width="${strokeWidth}"/>`;
  if (label) {
    svg += labelSvg(x + w / 2, y + h / 2, label);
  }
  return svg;
}

/** Double-border node — two nested rectangles with gap */
export function doubleBorder(opts: ShapeOpts): string {
  const { x, y, w, h, label, fill = 'transparent', borderColor = colors.nodeBorder, strokeWidth = stroke.nodeDouble, rx = spacing.borderRadius } = opts;
  const gap = spacing.doubleBorderGap;
  const outerStroke = strokeWidth;
  const innerStroke = Math.max(1, strokeWidth - 1);
  let svg = '';
  // outer rect
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="none" stroke="${borderColor}" stroke-width="${outerStroke}"/>`;
  // inner rect
  svg += `<rect x="${x + gap + outerStroke / 2}" y="${y + gap + outerStroke / 2}" width="${w - (gap + outerStroke / 2) * 2}" height="${h - (gap + outerStroke / 2) * 2}" rx="${Math.max(0, rx - gap)}" fill="${fill}" stroke="${borderColor}" stroke-width="${innerStroke}"/>`;
  if (label) {
    svg += labelSvg(x + w / 2, y + h / 2, label);
  }
  return svg;
}

/** Actor stick figure */
export function actor(opts: { x: number; y: number; label?: string; color?: string }): string {
  const { x, y, label, color = colors.accent } = opts;
  const sw = stroke.actor;
  // stick figure centered at (x, y) — total height ~40, head at top
  const headR = 7;
  const headCy = y;
  const neckY = y + headR;
  const shoulderY = neckY + 6;
  const armSpan = 14;
  const hipY = shoulderY + 16;
  const legSpan = 10;
  const footY = hipY + 16;

  let svg = '';
  // head
  svg += `<circle cx="${x}" cy="${headCy}" r="${headR}" fill="none" stroke="${color}" stroke-width="${sw}"/>`;
  // body
  svg += `<line x1="${x}" y1="${neckY}" x2="${x}" y2="${hipY}" stroke="${color}" stroke-width="${sw}"/>`;
  // arms
  svg += `<line x1="${x - armSpan}" y1="${shoulderY}" x2="${x + armSpan}" y2="${shoulderY}" stroke="${color}" stroke-width="${sw}"/>`;
  // left leg
  svg += `<line x1="${x}" y1="${hipY}" x2="${x - legSpan}" y2="${footY}" stroke="${color}" stroke-width="${sw}"/>`;
  // right leg
  svg += `<line x1="${x}" y1="${hipY}" x2="${x + legSpan}" y2="${footY}" stroke="${color}" stroke-width="${sw}"/>`;
  if (label) {
    svg += `<text x="${x}" y="${footY + 14}" font-family="${fonts.mono}" font-size="${fontSizes.nodeLabel}" fill="${color}" text-anchor="middle" letter-spacing="${spacing.letterSpacing}">${label.toUpperCase()}</text>`;
  }
  return svg;
}

/** Annotation text — italic, dimmed */
export function annotation(x: number, y: number, text: string): string {
  return `<text x="${x}" y="${y}" font-family="${fonts.sans}" font-size="${fontSizes.annotation}" fill="${colors.annotationColor}" opacity="${opacity.annotation}" font-style="italic">${text}</text>`;
}

/** Card with optional icon slot — dark bg, gray border, white text */
export function card(opts: { x: number; y: number; w: number; h: number; title: string; body?: string; iconSvg?: string }): string {
  const { x, y, w, h, title, body, iconSvg } = opts;
  const rx = 10;
  const pad = 14;
  let svg = '';
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${colors.cardBg}" stroke="${colors.cardBorder}" stroke-width="1"/>`;
  const textX = iconSvg ? x + pad + spacing.iconSize + 8 : x + pad;
  svg += `<text x="${textX}" y="${y + pad + 12}" font-family="${fonts.sans}" font-size="${fontSizes.cardTitle}" fill="${colors.cardText}" font-weight="600">${title}</text>`;
  if (body) {
    const lines = body.split('\n');
    lines.forEach((line, i) => {
      svg += `<text x="${textX}" y="${y + pad + 30 + i * 16}" font-family="${fonts.sans}" font-size="${fontSizes.cardBody}" fill="${colors.gray}">${line}</text>`;
    });
  }
  if (iconSvg) {
    svg += `<g transform="translate(${x + pad}, ${y + pad - 2})">${iconSvg}</g>`;
  }
  return svg;
}

/** Code block — monospace text on dark card background */
export function codeBlock(opts: { x: number; y: number; w: number; lines: string[] }): string {
  const { x, y, w, lines } = opts;
  const lineH = 18;
  const pad = 12;
  const h = lines.length * lineH + pad * 2;
  const rx = 8;
  let svg = '';
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${colors.cardBg}" stroke="${colors.cardBorder}" stroke-width="1"/>`;
  lines.forEach((line, i) => {
    svg += `<text x="${x + pad}" y="${y + pad + 12 + i * lineH}" font-family="${fonts.mono}" font-size="${fontSizes.codeBlock}" fill="${colors.accent}" opacity="0.85">${line}</text>`;
  });
  return svg;
}
