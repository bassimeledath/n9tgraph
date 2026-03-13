// Card diagram SVG renderer
import type {
  CardLayout,
  PositionedCardNode,
  PositionedCard,
  PositionedCardContainer,
  PositionedEdgeIn,
  PositionedHanging,
  PositionedCardEdge,
} from '../layout/card-layout.js';
import { colors, fonts, fontSizes, spacing, stroke } from './theme.js';
import { pill, rect } from './shapes.js';
import { straightEdge } from './edges.js';
import { renderIcon } from './icons.js';

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

// ─── Title ─────────────────────────────────────────────────

function renderTitle(title: string): string {
  const lines = title.split('\n');
  const lineH = Math.round(fontSizes.title * 1.3);
  let svg = '';
  for (let i = 0; i < lines.length; i++) {
    svg += `<text x="30" y="${34 + i * lineH}" font-family="${fonts.sans}" font-size="${fontSizes.title}" fill="${colors.white}" font-weight="700">${escapeXml(lines[i])}</text>`;
  }
  return svg;
}

// ─── Nodes ─────────────────────────────────────────────────

function renderNode(node: PositionedCardNode): string {
  const { x, y, w, h, label, properties } = node;
  const shape = properties.shape || 'rect';
  const fill = fillForPattern(properties.fill);

  if (shape === 'pill') {
    return pill({ x, y, w, h, label, fill });
  }
  return rect({ x, y, w, h, label, fill });
}

// ─── Cards ─────────────────────────────────────────────────

function renderSingleCard(card: PositionedCard): string {
  const { x, y, w, h, title, bodyLines, icon } = card;
  const rx = 10;
  const pad = 14;
  let svg = '';

  // Background
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${colors.cardBg}" stroke="${colors.cardBorder}" stroke-width="1"/>`;

  // Icon (white, not green)
  const iconSvg = icon ? renderIcon(icon, colors.white) : '';
  if (iconSvg) {
    svg += `<g transform="translate(${x + pad}, ${y + pad - 2})">${iconSvg}</g>`;
  }

  // Title — bold white
  const textX = icon ? x + pad + spacing.iconSize + 8 : x + pad;
  svg += `<text x="${textX}" y="${y + pad + 12}" font-family="${fonts.sans}" font-size="${fontSizes.cardTitle}" fill="${colors.cardText}" font-weight="600">${escapeXml(title)}</text>`;

  // Body lines — white at 70% opacity
  for (let i = 0; i < bodyLines.length; i++) {
    svg += `<text x="${textX}" y="${y + pad + 30 + i * 16}" font-family="${fonts.sans}" font-size="${fontSizes.cardBody}" fill="${colors.cardText}" opacity="0.7">${escapeXml(bodyLines[i])}</text>`;
  }

  return svg;
}

// ─── Containers ────────────────────────────────────────────

function renderContainer(container: PositionedCardContainer): string {
  const { x, y, w, h, properties, cards, hasOverflow, overflowX, overflowY } = container;
  const fill = fillForPattern(properties.fill);
  const rx = spacing.borderRadius;
  let svg = '';

  // Background pattern fill (separate from border for correct opacity)
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="none" opacity="0.5"/>`;
  // Border at reduced opacity
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="none" stroke="${colors.accent}" stroke-width="${stroke.node}" opacity="0.35"/>`;

  // Cards
  for (const card of cards) {
    svg += renderSingleCard(card);
  }

  // Overflow dots (three dots in white/gray)
  if (hasOverflow) {
    const r = 3;
    const gap = 8;
    svg += `<circle cx="${overflowX - gap}" cy="${overflowY}" r="${r}" fill="${colors.white}" opacity="0.5"/>`;
    svg += `<circle cx="${overflowX}" cy="${overflowY}" r="${r}" fill="${colors.white}" opacity="0.5"/>`;
    svg += `<circle cx="${overflowX + gap}" cy="${overflowY}" r="${r}" fill="${colors.white}" opacity="0.5"/>`;
  }

  return svg;
}

// ─── Edges ─────────────────────────────────────────────────

function renderEdge(edge: PositionedCardEdge): string {
  return straightEdge({
    from: edge.fromPt,
    to: edge.toPt,
    color: colors.accent,
  });
}

// ─── Edge-In ───────────────────────────────────────────────

function renderEdgeIn(edgeIn: PositionedEdgeIn): string {
  let svg = '';

  // Arrow from outside → target
  svg += straightEdge({
    from: edgeIn.fromPt,
    to: edgeIn.toPt,
    color: colors.accent,
  });

  // Label near the origin point
  if (edgeIn.label) {
    const maxChars = 22;
    const words = edgeIn.label.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      if (current && (current + ' ' + word).length > maxChars) {
        lines.push(current);
        current = word;
      } else {
        current = current ? current + ' ' + word : word;
      }
    }
    if (current) lines.push(current);

    const lineH = fontSizes.edgeLabel + 4;
    const startY = edgeIn.labelY - (lines.length - 1) * lineH / 2;

    for (let i = 0; i < lines.length; i++) {
      svg += `<text x="${edgeIn.labelX}" y="${startY + i * lineH}" font-family="${fonts.sans}" font-size="${fontSizes.edgeLabel}" fill="${colors.white}" opacity="0.8" text-anchor="start">${escapeXml(lines[i])}</text>`;
    }
  }

  return svg;
}

// ─── Hanging Labels ────────────────────────────────────────

function renderHanging(hanging: PositionedHanging): string {
  let svg = '';

  // Connector line
  svg += `<line x1="${hanging.connectorFrom.x}" y1="${hanging.connectorFrom.y}" x2="${hanging.connectorTo.x}" y2="${hanging.connectorTo.y}" stroke="${colors.accent}" stroke-width="${stroke.edge}" opacity="0.5"/>`;

  // Icon (white)
  if (hanging.icon) {
    const iconSvg = renderIcon(hanging.icon, colors.white);
    if (iconSvg) {
      svg += `<g transform="translate(${hanging.textX - spacing.iconSize - 6}, ${hanging.textY - 14})">${iconSvg}</g>`;
    }
  }

  // Label text
  svg += `<text x="${hanging.textX}" y="${hanging.textY}" font-family="${fonts.sans}" font-size="${fontSizes.subtitle}" fill="${colors.white}" opacity="0.85">${escapeXml(hanging.label)}</text>`;

  return svg;
}

// ─── Main render ───────────────────────────────────────────

export function renderCardDiagram(layout: CardLayout): string {
  const parts: string[] = [];

  // Title
  if (layout.title) {
    parts.push(renderTitle(layout.title));
  }

  // Edges (behind everything)
  for (const edge of layout.edges) {
    parts.push(renderEdge(edge));
  }

  // Edge-in arrows
  for (const edgeIn of layout.edgesIn) {
    parts.push(renderEdgeIn(edgeIn));
  }

  // Containers (behind nodes, with cards inside)
  for (const container of layout.containers) {
    parts.push(renderContainer(container));
  }

  // Nodes (on top of edges/containers)
  for (const node of layout.nodes) {
    parts.push(renderNode(node));
  }

  // Hanging labels
  for (const hanging of layout.hangingLabels) {
    parts.push(renderHanging(hanging));
  }

  return parts.join('\n');
}
