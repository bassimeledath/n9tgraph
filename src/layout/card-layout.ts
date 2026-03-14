// Card diagram layout engine — positions nodes, containers, cards, edges, hanging labels
import type { CardDiagram, CardCard, Properties } from '../parser/ast.js';
import { nodeSizeForLabel, measureLineWidth, FontFamily } from './text-measure.js';
import { fontSizes, spacing } from '../render/theme.js';

// ─── Layout output types ─────────────────────────────────

export interface PositionedCardNode {
  id: string;
  label: string;
  properties: Properties;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PositionedCard {
  id: string;
  title: string;
  body?: string;
  bodyLines: string[];
  icon?: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PositionedCardContainer {
  id: string;
  label: string;
  properties: Properties;
  x: number;
  y: number;
  w: number;
  h: number;
  cards: PositionedCard[];
  hasOverflow: boolean;
  overflowX: number;
  overflowY: number;
}

export interface PositionedEdgeIn {
  fromPt: { x: number; y: number };
  toPt: { x: number; y: number };
  label?: string;
  labelX: number;
  labelY: number;
}

export interface PositionedHanging {
  connectorFrom: { x: number; y: number };
  connectorTo: { x: number; y: number };
  label: string;
  icon?: string;
  textX: number;
  textY: number;
}

export interface PositionedCardEdge {
  fromPt: { x: number; y: number };
  toPt: { x: number; y: number };
  label?: string;
}

export interface CardLayout {
  width: number;
  height: number;
  title?: string;
  nodes: PositionedCardNode[];
  containers: PositionedCardContainer[];
  edges: PositionedCardEdge[];
  edgesIn: PositionedEdgeIn[];
  hangingLabels: PositionedHanging[];
}

// ─── Constants ───────────────────────────────────────────

const MARGIN = 60;
const CARD_WIDTH = 190;
const CARD_PAD = 14;
const CARD_GAP = 14;
const BODY_LINE_H = 16;
const CONTAINER_PAD_X = 24;
const CONTAINER_PAD_Y = 24;
const OVERFLOW_W = 50;
const EDGE_IN_LENGTH = 100;
const HANGING_CONNECTOR_LEN = 30;
const NODE_CONTAINER_GAP = 80;
const MIN_NODE_W = 120;

// ─── Helpers ────────────────────────────────────────────

function wrapText(text: string, maxWidth: number, fontSize: number, font: FontFamily): string[] {
  // Split on explicit newlines first, then wrap each segment independently
  const segments = text.split('\n');
  const lines: string[] = [];
  for (const segment of segments) {
    const words = segment.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) { lines.push(''); continue; }
    let current = '';
    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      if (measureLineWidth(test, fontSize, font) > maxWidth) {
        if (current) lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

// ─── Main entry ─────────────────────────────────────────

interface CardSizeInfo {
  card: CardCard;
  bodyLines: string[];
  w: number;
  h: number;
}

export function layoutCard(diagram: CardDiagram): CardLayout {
  // Title dimensions
  const titleLines = diagram.title ? diagram.title.split('\n') : [];
  const titleH = titleLines.length > 0 ? titleLines.length * Math.round(fontSizes.title * 1.3) + 20 : 0;

  let curY = MARGIN + titleH;

  // 1. Size nodes
  const nodeInfos = new Map<string, { w: number; h: number }>();
  for (const node of diagram.nodes) {
    const size = nodeSizeForLabel(node.label, fontSizes.nodeLabel, 'mono', 28, 18);
    nodeInfos.set(node.id, {
      w: Math.max(size.w, MIN_NODE_W),
      h: Math.max(size.h, 44),
    });
  }

  // 2. Size containers and cards
  const containerInfos = new Map<string, { w: number; h: number; cardLayouts: CardSizeInfo[] }>();
  for (const container of diagram.containers) {
    const cardLayouts: CardSizeInfo[] = container.cards.map(card => {
      const iconW = card.icon ? spacing.iconSize + 8 : 0;
      // Size card width from max(CARD_WIDTH, title width) to prevent title truncation
      const titleW = measureLineWidth(card.title, fontSizes.cardTitle, 'sans')
        + card.title.length * 0.12 * fontSizes.cardTitle; // letter-spacing
      const neededTitleW = titleW + iconW + 2 * CARD_PAD;
      const cardW = Math.max(CARD_WIDTH, Math.ceil(neededTitleW));
      const textMaxW = cardW - 2 * CARD_PAD - iconW;
      const bodyLines = card.body ? wrapText(card.body, textMaxW, fontSizes.cardBody, 'sans') : [];
      const h = CARD_PAD + 30 + bodyLines.length * BODY_LINE_H + CARD_PAD;
      return { card, bodyLines, w: cardW, h };
    });

    const maxCardH = cardLayouts.length > 0 ? Math.max(...cardLayouts.map(c => c.h)) : 80;
    const maxCardW = cardLayouts.length > 0 ? Math.max(...cardLayouts.map(c => c.w)) : CARD_WIDTH;
    const numCards = cardLayouts.length;
    const overflowW = container.hasOverflow ? OVERFLOW_W : 0;
    const contentW = numCards * maxCardW + Math.max(0, numCards - 1) * CARD_GAP + overflowW;
    const containerW = contentW + CONTAINER_PAD_X * 2;
    const containerH = maxCardH + CONTAINER_PAD_Y * 2;

    containerInfos.set(container.id, { w: containerW, h: containerH, cardLayouts });
  }

  // 3. Compute diagram width
  let maxContentW = 0;
  for (const info of nodeInfos.values()) maxContentW = Math.max(maxContentW, info.w);
  for (const info of containerInfos.values()) maxContentW = Math.max(maxContentW, info.w);

  // Edge-in extends the needed width
  for (const edgeIn of diagram.edgesIn) {
    const nodeInfo = nodeInfos.get(edgeIn.target);
    if (nodeInfo && (edgeIn.side === 'left' || edgeIn.side === 'right')) {
      const labelW = edgeIn.label ? measureLineWidth(edgeIn.label, fontSizes.edgeLabel, 'mono') + 40 : 0;
      maxContentW = Math.max(maxContentW, nodeInfo.w + EDGE_IN_LENGTH + labelW);
    }
  }

  const diagramW = maxContentW + MARGIN * 2;
  const centerX = diagramW / 2;

  // 4. Position nodes (centered horizontally, stacked vertically)
  const posNodes: PositionedCardNode[] = [];
  const elementPositions = new Map<string, { x: number; y: number; w: number; h: number }>();

  for (const node of diagram.nodes) {
    const info = nodeInfos.get(node.id)!;
    const x = centerX - info.w / 2;
    posNodes.push({ ...node, x, y: curY, w: info.w, h: info.h });
    elementPositions.set(node.id, { x, y: curY, w: info.w, h: info.h });
    curY += info.h;
  }

  // 5. Position hanging labels
  const posHanging: PositionedHanging[] = [];
  for (const hanging of diagram.hangingLabels) {
    const nodePos = elementPositions.get(hanging.target);
    if (!nodePos) continue;

    const connStartY = nodePos.y + nodePos.h;
    const connEndY = connStartY + HANGING_CONNECTOR_LEN;

    const labelW = measureLineWidth(hanging.label, fontSizes.subtitle, 'sans');
    const iconW = hanging.icon ? spacing.iconSize + 6 : 0;
    const totalW = iconW + labelW;

    posHanging.push({
      connectorFrom: { x: centerX, y: connStartY },
      connectorTo: { x: centerX, y: connEndY },
      label: hanging.label,
      icon: hanging.icon,
      textX: centerX - totalW / 2 + iconW,
      textY: connEndY + 18,
    });

    curY = connEndY + 40;
  }

  // Gap before containers
  if (posHanging.length === 0 && diagram.containers.length > 0) {
    curY += NODE_CONTAINER_GAP;
  }

  // 6. Position containers with inner cards
  const posContainers: PositionedCardContainer[] = [];
  for (const container of diagram.containers) {
    const info = containerInfos.get(container.id)!;
    const x = centerX - info.w / 2;
    const y = curY;

    // Cards positioned horizontally inside container
    const posCards: PositionedCard[] = [];
    let cardX = x + CONTAINER_PAD_X;
    const cardY = y + CONTAINER_PAD_Y;
    const maxCardH = info.cardLayouts.length > 0 ? Math.max(...info.cardLayouts.map(c => c.h)) : 80;

    for (const cl of info.cardLayouts) {
      posCards.push({
        id: cl.card.id,
        title: cl.card.title,
        body: cl.card.body,
        bodyLines: cl.bodyLines,
        icon: cl.card.icon,
        x: cardX,
        y: cardY,
        w: cl.w,
        h: maxCardH,
      });
      cardX += cl.w + CARD_GAP;
    }

    // Overflow position
    const overflowX = cardX + 10;
    const overflowY = cardY + maxCardH / 2;

    posContainers.push({
      id: container.id,
      label: container.label,
      properties: container.properties,
      x, y,
      w: info.w,
      h: info.h,
      cards: posCards,
      hasOverflow: container.hasOverflow,
      overflowX,
      overflowY,
    });

    elementPositions.set(container.id, { x, y, w: info.w, h: info.h });
    curY += info.h;
  }

  // 7. Position edges between elements
  const posEdges: PositionedCardEdge[] = [];
  for (const edge of diagram.edges) {
    const fromPos = elementPositions.get(edge.from);
    const toPos = elementPositions.get(edge.to);
    if (!fromPos || !toPos) continue;

    // Connect bottom-center of 'from' to top-center of 'to'
    const fromPt = { x: fromPos.x + fromPos.w / 2, y: fromPos.y + fromPos.h };
    const toPt = { x: toPos.x + toPos.w / 2, y: toPos.y };
    posEdges.push({ fromPt, toPt, label: edge.label });
  }

  // 8. Position edge_in arrows
  const posEdgesIn: PositionedEdgeIn[] = [];
  for (const edgeIn of diagram.edgesIn) {
    const nodePos = elementPositions.get(edgeIn.target);
    if (!nodePos) continue;

    let fromPt: { x: number; y: number };
    let toPt: { x: number; y: number };
    let labelX: number;
    let labelY: number;

    switch (edgeIn.side) {
      case 'right':
        toPt = { x: nodePos.x + nodePos.w, y: nodePos.y + nodePos.h / 2 };
        fromPt = { x: toPt.x + EDGE_IN_LENGTH, y: toPt.y };
        labelX = fromPt.x + 10;
        labelY = fromPt.y;
        break;
      case 'left':
        toPt = { x: nodePos.x, y: nodePos.y + nodePos.h / 2 };
        fromPt = { x: toPt.x - EDGE_IN_LENGTH, y: toPt.y };
        labelX = fromPt.x - 10;
        labelY = fromPt.y;
        break;
      case 'top':
        toPt = { x: nodePos.x + nodePos.w / 2, y: nodePos.y };
        fromPt = { x: toPt.x, y: toPt.y - EDGE_IN_LENGTH };
        labelX = fromPt.x;
        labelY = fromPt.y - 10;
        break;
      case 'bottom':
      default:
        toPt = { x: nodePos.x + nodePos.w / 2, y: nodePos.y + nodePos.h };
        fromPt = { x: toPt.x, y: toPt.y + EDGE_IN_LENGTH };
        labelX = fromPt.x;
        labelY = fromPt.y + 10;
        break;
    }

    posEdgesIn.push({ fromPt, toPt, label: edgeIn.label, labelX, labelY });
  }

  return {
    width: diagramW,
    height: curY + MARGIN,
    title: diagram.title,
    nodes: posNodes,
    containers: posContainers,
    edges: posEdges,
    edgesIn: posEdgesIn,
    hangingLabels: posHanging,
  };
}
