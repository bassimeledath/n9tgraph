// ASCII-guided layout: grid-based positioning that feeds into the existing renderFlow() pipeline
import type { FlowNodeKind, FlowDirection, ThemeName, SpacingPreset, Properties, FlowEdge } from '../parser/ast.js';
import type { FlowLayout, PositionedNode, PositionedEdge, PositionedSubgraph, PositionedAnnotation } from './flow-layout.js';
import { nodeSizeForLabel, measureLineWidth, wrapLabel } from './text-measure.js';
import { fontSizes } from '../render/theme.js';

// ─── Input types ────────────────────────────────────────

export interface AsciiGuidedInput {
  diagram: {
    title?: string;
    boxes: Array<{
      id: string;
      label: string;
      body?: string[];
      kind?: FlowNodeKind;
      properties?: Properties;
    }>;
    grid: (string | null)[][];
    connectors: Array<{
      from: string;
      to: string;
      label?: string;
      arrow?: FlowEdge['arrow'];
      dashed?: boolean;
      properties?: Properties;
    }>;
    lanes?: string[];
    direction?: FlowDirection;
    theme?: ThemeName;
    spacing?: SpacingPreset;
    subgraphs?: Array<{
      id: string;
      label: string;
      childIds: string[];
      properties?: Properties;
    }>;
    annotations?: Array<{
      text: string;
      near: string;
      side?: 'top' | 'bottom' | 'left' | 'right';
      properties?: Properties;
    }>;
  };
}

// ─── Constants (mirrored from flow-layout.ts) ───────────

const MARGIN_X = 36;
const MARGIN_TOP = 18;
const TITLE_HEIGHT = 32;
const DEFAULT_LAYER_GAP = 24;
const DEFAULT_TB_LAYER_GAP = 38;
const DEFAULT_NODE_GAP = 20;
const ACTOR_W = 42;
const ACTOR_H = 72;
const MIN_NODE_W = 72;
const CIRCLE_R = 32;
const SUBGRAPH_PAD_X = 16;
const SUBGRAPH_PAD_TOP = 56;
const SUBGRAPH_PAD_BOTTOM = 16;
const MAX_NODE_LABEL_CHARS = 28;

function resolveSpacing(preset?: SpacingPreset): { nodeGap: number; layerGap: number; tbLayerGap: number } {
  switch (preset) {
    case 'compact':  return { nodeGap: 12, layerGap: 18, tbLayerGap: 28 };
    case 'spacious': return { nodeGap: 30, layerGap: 50, tbLayerGap: 60 };
    default:         return { nodeGap: DEFAULT_NODE_GAP, layerGap: DEFAULT_LAYER_GAP, tbLayerGap: DEFAULT_TB_LAYER_GAP };
  }
}

// ─── Node sizing (replicates flow-layout.ts logic) ──────

interface BoxDef {
  id: string;
  label: string;
  kind: FlowNodeKind;
  properties: Properties;
}

function computeNodeSize(box: BoxDef): { w: number; h: number } {
  if (box.kind === 'actor') {
    const labelW = box.label
      ? measureLineWidth(box.label.toUpperCase(), fontSizes.nodeLabel, 'mono')
        + box.label.length * 0.12 * fontSizes.nodeLabel
      : 0;
    let actorH = ACTOR_H;
    let actorW = Math.max(ACTOR_W, labelW + 8);
    if (box.properties.sublabel) {
      const sublabelLines = wrapLabel(box.properties.sublabel, MAX_NODE_LABEL_CHARS + 6);
      const sublabelLineH = Math.ceil(fontSizes.edgeLabel * 1.4);
      actorH = Math.max(actorH, 80 + sublabelLines.length * sublabelLineH + 4);
      const maxSubLine = sublabelLines.reduce((a, b) => a.length > b.length ? a : b, '');
      const sublabelW = measureLineWidth(maxSubLine, fontSizes.edgeLabel, 'mono') + 16;
      actorW = Math.max(actorW, sublabelW);
    }
    return { w: actorW, h: actorH };
  }

  if (box.kind === 'circle') {
    const labelW = box.label
      ? measureLineWidth(box.label, fontSizes.nodeLabel, 'mono') + box.label.length * 0.12 * fontSizes.nodeLabel + 16
      : 0;
    const r = Math.max(CIRCLE_R, labelW / 2);
    return { w: r * 2, h: r * 2 };
  }

  // Standard node sizing
  const isPill = box.properties.shape === 'pill';
  const padX = isPill ? 32 : 20;
  const padY = isPill ? 6 : 10;
  const wrappedLines = wrapLabel(box.label, MAX_NODE_LABEL_CHARS);
  const maxLine = wrappedLines.reduce((a, b) => a.length > b.length ? a : b, '');
  const size = nodeSizeForLabel(maxLine, fontSizes.nodeLabel, 'mono', padX, padY);
  if (wrappedLines.length > 1) {
    const lineH = fontSizes.nodeLabel * 1.4;
    size.h = Math.ceil(wrappedLines.length * lineH + padY * 2);
  }
  let h = Math.max(size.h, isPill ? 34 : 36);

  if (box.kind === 'datastore') {
    const CYLINDER_RIM = 10;
    h = Math.max(h, h + CYLINDER_RIM);
  }

  if (box.properties.sublabel) {
    const sublabelWrapped = wrapLabel(box.properties.sublabel, MAX_NODE_LABEL_CHARS + 6);
    const maxSubLine = sublabelWrapped.reduce((a, b) => a.length > b.length ? a : b, '');
    const labelLineH = fontSizes.nodeLabel * 1.4;
    const lastLineCenter = (wrappedLines.length - 1) * labelLineH / 2;
    const labelVisualBottom = (-8) + lastLineCenter + fontSizes.nodeLabel / 2;
    const SUBLABEL_GAP = 10;
    const sublabelLineH = Math.ceil(fontSizes.edgeLabel * 1.4);
    const sublabelStart = labelVisualBottom + SUBLABEL_GAP + ((sublabelWrapped.length - 1) * sublabelLineH / 2);
    const sublabelExtent = sublabelStart + sublabelWrapped.length * sublabelLineH;
    const neededH = Math.max(h, (sublabelExtent + 4) * 2);
    h = neededH;
    const sublabelW = measureLineWidth(maxSubLine, fontSizes.edgeLabel, 'mono') + padX * 2;
    if (sublabelW > size.w) {
      size.w = sublabelW;
    }
  }

  if (box.kind === 'service') {
    h = Math.max(h, 50);
  }

  // Apply DSL min-height / min-width overrides
  const dslMinH = parseInt(box.properties['min-height'] || '', 10);
  const dslMinW = parseInt(box.properties['min-width'] || '', 10);
  if (!isNaN(dslMinH)) h = Math.max(h, dslMinH);
  let finalW = Math.max(size.w, MIN_NODE_W);
  if (!isNaN(dslMinW)) finalW = Math.max(finalW, dslMinW);

  return { w: finalW, h };
}

// ─── Main layout function ───────────────────────────────

export function layoutFromGrid(input: AsciiGuidedInput): FlowLayout {
  const { diagram } = input;
  const direction = diagram.direction ?? 'TB';
  const isTB = direction === 'TB';

  // Step 1: Build box lookup
  const boxMap = new Map<string, BoxDef>();
  for (const b of diagram.boxes) {
    boxMap.set(b.id, {
      id: b.id,
      label: b.label,
      kind: b.kind ?? 'component',
      properties: b.properties ?? {},
    });
  }

  // Validate grid references
  const grid = diagram.grid;
  const numRows = grid.length;
  const numCols = Math.max(...grid.map(row => row.length), 1);

  // Step 2: Compute node sizes
  const nodeSizes = new Map<string, { w: number; h: number }>();
  for (const [id, box] of boxMap) {
    nodeSizes.set(id, computeNodeSize(box));
  }

  // Step 3: Find each box's grid position
  const boxGridPos = new Map<string, { row: number; col: number }>();
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cellId = grid[r][c];
      if (cellId && boxMap.has(cellId)) {
        boxGridPos.set(cellId, { row: r, col: c });
      }
    }
  }

  // Step 4: Compute column widths and row heights
  const colWidths: number[] = new Array(numCols).fill(0);
  const rowHeights: number[] = new Array(numRows).fill(0);
  for (const [id, pos] of boxGridPos) {
    const size = nodeSizes.get(id)!;
    colWidths[pos.col] = Math.max(colWidths[pos.col], size.w);
    rowHeights[pos.row] = Math.max(rowHeights[pos.row], size.h);
  }

  // Step 5: Grid→pixel coordinate mapping
  const sp = resolveSpacing(diagram.spacing);
  const gapMajor = isTB ? sp.tbLayerGap : sp.layerGap; // gap between rows (TB) or cols (LR)
  const gapMinor = sp.nodeGap;                          // gap between cols (TB) or rows (LR)

  const titleOffset = diagram.title ? TITLE_HEIGHT : 0;

  let colX: number[];
  let rowY: number[];

  if (isTB) {
    // Columns = horizontal, rows = vertical (layers)
    colX = [];
    let x = MARGIN_X;
    for (let c = 0; c < numCols; c++) {
      colX[c] = x;
      x += colWidths[c] + gapMinor;
    }
    rowY = [];
    let y = MARGIN_TOP + titleOffset;
    for (let r = 0; r < numRows; r++) {
      rowY[r] = y;
      y += rowHeights[r] + gapMajor;
    }
  } else {
    // LR: grid rows become columns (left-to-right layers), grid cols become rows (vertical positions)
    colX = [];
    let x = MARGIN_X;
    for (let r = 0; r < numRows; r++) {
      colX[r] = x;
      x += rowHeights[r] + gapMajor; // "row heights" become column widths in LR (use layer sizes)
    }
    rowY = [];
    let y = MARGIN_TOP + titleOffset;
    for (let c = 0; c < numCols; c++) {
      rowY[c] = y;
      y += colWidths[c] + gapMinor; // "col widths" become row heights in LR
    }
  }

  // Step 6: Build PositionedNode[]
  const nodes: PositionedNode[] = [];
  const nodeMap = new Map<string, PositionedNode>();

  for (const [id, box] of boxMap) {
    const pos = boxGridPos.get(id);
    if (!pos) continue; // box not placed in grid

    const size = nodeSizes.get(id)!;
    let nx: number, ny: number;

    if (isTB) {
      nx = colX[pos.col] + (colWidths[pos.col] - size.w) / 2;
      ny = rowY[pos.row] + (rowHeights[pos.row] - size.h) / 2;
    } else {
      // LR: grid row → horizontal layer, grid col → vertical position
      nx = colX[pos.row] + (rowHeights[pos.row] - size.w) / 2;
      ny = rowY[pos.col] + (colWidths[pos.col] - size.h) / 2;
    }

    const node: PositionedNode = {
      id: box.id,
      label: box.label,
      kind: box.kind,
      properties: box.properties,
      x: nx,
      y: ny,
      w: size.w,
      h: size.h,
    };
    nodes.push(node);
    nodeMap.set(id, node);
  }

  // Step 7: Build PositionedEdge[]
  const edges: PositionedEdge[] = diagram.connectors.map(conn => ({
    from: conn.from,
    to: conn.to,
    arrow: conn.arrow ?? '-->',
    label: conn.label,
    dashed: conn.dashed ?? (conn.arrow === '-.->' || conn.arrow === '<-.-'),
    properties: conn.properties,
    fromPt: { x: 0, y: 0 },
    toPt: { x: 0, y: 0 },
  }));

  // Step 8: Build PositionedSubgraph[]
  const subgraphs: PositionedSubgraph[] = [];
  for (const sg of diagram.subgraphs ?? []) {
    const childNodes = sg.childIds.map(id => nodeMap.get(id)).filter((n): n is PositionedNode => !!n);
    if (childNodes.length === 0) continue;

    const minX = Math.min(...childNodes.map(n => n.x)) - SUBGRAPH_PAD_X;
    const minY = Math.min(...childNodes.map(n => n.y)) - SUBGRAPH_PAD_TOP;
    const maxX = Math.max(...childNodes.map(n => n.x + n.w)) + SUBGRAPH_PAD_X;
    const maxY = Math.max(...childNodes.map(n => n.y + n.h)) + SUBGRAPH_PAD_BOTTOM;

    subgraphs.push({
      id: sg.id,
      label: sg.label,
      properties: sg.properties ?? {},
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
      childIds: sg.childIds,
    });
  }

  // Step 9: Build PositionedAnnotation[]
  const annotations: PositionedAnnotation[] = [];
  for (const ann of diagram.annotations ?? []) {
    const node = nodeMap.get(ann.near);
    if (!node) continue;

    const side = ann.side ?? 'right';
    const cx = node.x + node.w / 2;
    const cy = node.y + node.h / 2;

    let ax: number, ay: number;
    switch (side) {
      case 'right':  ax = node.x + node.w + 20; ay = cy; break;
      case 'left':   ax = node.x - 20; ay = cy; break;
      case 'top':    ax = cx; ay = node.y - 20; break;
      case 'bottom': ax = cx; ay = node.y + node.h + 20; break;
    }

    annotations.push({
      text: ann.text,
      x: ax,
      y: ay,
      originX: cx,
      originY: cy,
      anchorX: cx,
      anchorY: cy,
      properties: ann.properties,
    });
  }

  // Step 10: Compute canvas dimensions
  const allX = [...nodes.map(n => n.x + n.w), ...subgraphs.map(s => s.x + s.w)];
  const allY = [...nodes.map(n => n.y + n.h), ...subgraphs.map(s => s.y + s.h)];
  const width = (allX.length > 0 ? Math.max(...allX) : 200) + MARGIN_X;
  const height = (allY.length > 0 ? Math.max(...allY) : 100) + MARGIN_TOP;
  const titleMaxWidth = width - 2 * MARGIN_X;

  // Step 11: Return FlowLayout
  return {
    width,
    height,
    direction,
    theme: diagram.theme,
    title: diagram.title,
    titleMaxWidth,
    nodes,
    edges,
    annotations,
    subgraphs,
    overflows: [],
    codeblocks: [],
  };
}
