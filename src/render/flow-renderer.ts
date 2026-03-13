// Flow diagram SVG renderer
import type { FlowLayout, PositionedNode, PositionedEdge, PositionedAnnotation, PositionedSubgraph, PositionedOverflow, PositionedCodeBlock } from '../layout/flow-layout.js';
import { colors, fonts, fontSizes, spacing, opacity, stroke } from './theme.js';
import { rect, cylinder, doubleBorder, actor, annotation } from './shapes.js';
import { straightEdge, biEdge, polylineEdge, edgeLabelMultiline, numberedCircle } from './edges.js';
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

function renderSublabel(cx: number, y: number, text: string): string {
  return `<text x="${cx}" y="${y}" font-family="${fonts.mono}" font-size="${fontSizes.edgeLabel}" fill="${colors.accent}" opacity="0.6" text-anchor="middle" dominant-baseline="central" letter-spacing="${spacing.letterSpacing}">${escapeXml(text)}</text>`;
}

function renderNode(node: PositionedNode): string {
  const { x, y, w, h, label, kind, properties } = node;
  const fill = fillForPattern(properties.fill);
  const hasSublabel = !!properties.sublabel;
  const labelOffsetY = hasSublabel ? -8 : 0;

  if (kind === 'actor') {
    const cx = x + w / 2;
    const cy = y + 7;
    return actor({ x: cx, y: cy, label, color: colors.accent });
  }

  if (kind === 'circle') {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.min(w, h) / 2;
    let svg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${colors.nodeBorder}" stroke-width="${stroke.node}"/>`;
    if (label) {
      svg += `<text x="${cx}" y="${cy}" font-family="${fonts.mono}" font-size="${fontSizes.nodeLabel}" fill="${colors.accent}" text-anchor="middle" dominant-baseline="central" letter-spacing="${spacing.letterSpacing}">${escapeXml(label).toUpperCase()}</text>`;
    }
    return svg;
  }

  // Double border: explicit property or service kind
  const useDoubleBorder = kind === 'service' || properties.border === 'double';

  if (useDoubleBorder) {
    const dbFill = kind === 'service' && !properties.fill ? 'url(#hero)' : fill;
    let svg = doubleBorder({ x, y, w, h, label: undefined, fill: dbFill });
    // Render label manually to support sublabel offset
    if (label) {
      svg += `<text x="${x + w / 2}" y="${y + h / 2 + labelOffsetY}" font-family="${fonts.mono}" font-size="${fontSizes.nodeLabel}" fill="${colors.accent}" text-anchor="middle" dominant-baseline="central" letter-spacing="${spacing.letterSpacing}">${escapeXml(label).toUpperCase()}</text>`;
    }
    if (properties.sublabel) {
      svg += renderSublabel(x + w / 2, y + h / 2 + 12, properties.sublabel);
    }
    return svg;
  }

  if (kind === 'datastore') {
    return cylinder({ x, y, w, h, label, fill });
  }

  // component, external, label, default — standard rect (or pill if shape: pill)
  const rx = properties.shape === 'pill' ? spacing.pillRadius : undefined;
  let svg = rect({ x, y, w, h, label: undefined, fill, ...(rx !== undefined ? { rx } : {}) });
  if (label) {
    svg += `<text x="${x + w / 2}" y="${y + h / 2 + labelOffsetY}" font-family="${fonts.mono}" font-size="${fontSizes.nodeLabel}" fill="${colors.accent}" text-anchor="middle" dominant-baseline="central" letter-spacing="${spacing.letterSpacing}">${escapeXml(label).toUpperCase()}</text>`;
  }
  if (properties.sublabel) {
    svg += renderSublabel(x + w / 2, y + h / 2 + 12, properties.sublabel);
  }
  return svg;
}

/** Compute the point on the border of `node` facing toward `target` center */
function connectionPoint(
  node: PositionedNode | PositionedCodeBlock,
  tx: number, ty: number,
): { x: number; y: number } {
  // For actors, use a simple bounding box
  if ('kind' in node && node.kind === 'actor') {
    const cx = node.x + node.w / 2;
    const midY = node.y + (node.h - 14) / 2;
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

  // Circle nodes
  if ('kind' in node && node.kind === 'circle') {
    const cx = node.x + node.w / 2;
    const cy = node.y + node.h / 2;
    const r = Math.min(node.w, node.h) / 2;
    const dx = tx - cx;
    const dy = ty - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: cx + (dx / dist) * r, y: cy + (dy / dist) * r };
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

function nodeCenter(n: { x: number; y: number; w: number; h: number; kind?: string }): { x: number; y: number } {
  if ('kind' in n && n.kind === 'actor') {
    return { x: n.x + n.w / 2, y: n.y + (n.h - 14) / 2 };
  }
  return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
}

/** Check if two edges connect the same pair of nodes */
function edgePairKey(e: PositionedEdge): string {
  const a = e.from < e.to ? e.from : e.to;
  const b = e.from < e.to ? e.to : e.from;
  return `${a}--${b}`;
}

function renderEdges(edges: PositionedEdge[], nodes: PositionedNode[], codeblocks: PositionedCodeBlock[], direction?: string): string {
  const nodeById = new Map<string, PositionedNode | PositionedCodeBlock>();
  for (const n of nodes) nodeById.set(n.id, n);
  for (const cb of codeblocks) nodeById.set(cb.id, cb);
  const parts: string[] = [];

  // Group edges by node pair
  const pairEdges = new Map<string, PositionedEdge[]>();
  for (const e of edges) {
    const key = edgePairKey(e);
    if (!pairEdges.has(key)) pairEdges.set(key, []);
    pairEdges.get(key)!.push(e);
  }
  const pairIndex = new Map<string, number>();

  for (const edge of edges) {
    const visualFrom = (edge.arrow === '<--' || edge.arrow === '<-.-') ? edge.to : edge.from;
    const visualTo = (edge.arrow === '<--' || edge.arrow === '<-.-') ? edge.from : edge.to;

    const fromNode = nodeById.get(visualFrom);
    const toNode = nodeById.get(visualTo);
    if (!fromNode || !toNode) continue;

    const key = edgePairKey(edge);
    const siblings = pairEdges.get(key)!;
    const idx = pairIndex.get(key) || 0;
    pairIndex.set(key, idx + 1);

    let fromPt: { x: number; y: number };
    let toPt: { x: number; y: number };

    // TB mode: orthogonal routing for single edges
    if (direction === 'TB' && siblings.length === 1) {
      const fc = nodeCenter(fromNode);
      const tc = nodeCenter(toNode);
      const isForward = fromNode.y + fromNode.h <= toNode.y + 5;
      const isBackward = toNode.y + toNode.h <= fromNode.y + 5;

      if (isForward) {
        // Forward edge: exit bottom center, enter top center
        fromPt = { x: fc.x, y: fromNode.y + fromNode.h };
        toPt = { x: tc.x, y: toNode.y };
        if (Math.abs(fc.x - tc.x) < 10) {
          parts.push(straightEdge({ from: fromPt, to: toPt, dashed: edge.dashed, color: colors.accent }));
        } else {
          const midY = (fromPt.y + toPt.y) / 2;
          parts.push(polylineEdge({
            from: fromPt, to: toPt,
            waypoints: [{ x: fc.x, y: midY }, { x: tc.x, y: midY }],
            dashed: edge.dashed, color: colors.accent,
          }));
        }
        if (edge.label) {
          const lx = (fc.x + tc.x) / 2;
          const ly = (fromPt.y + toPt.y) / 2;
          parts.push(edgeLabelMultiline(lx, ly, escapeXml(edge.label), 30));
        }
      } else if (isBackward) {
        // Route along left side of diagram
        const minX = Math.min(...nodes.map(n => n.x), ...codeblocks.map(c => c.x));
        const leftX = minX - 30;
        fromPt = { x: fromNode.x, y: fc.y };
        toPt = { x: toNode.x, y: tc.y };
        parts.push(polylineEdge({
          from: fromPt, to: toPt,
          waypoints: [{ x: leftX, y: fc.y }, { x: leftX, y: tc.y }],
          dashed: edge.dashed, color: colors.accent,
        }));
        if (edge.label) {
          parts.push(edgeLabelMultiline(leftX, (fc.y + tc.y) / 2, escapeXml(edge.label), 30));
        }
      } else {
        // Same row: standard routing
        fromPt = connectionPoint(fromNode, tc.x, tc.y);
        toPt = connectionPoint(toNode, fc.x, fc.y);
        const opts = { from: fromPt, to: toPt, dashed: edge.dashed, color: colors.accent };
        parts.push(edge.arrow === '<-->' ? biEdge(opts) : straightEdge(opts));
        if (edge.label) {
          parts.push(edgeLabelMultiline((fromPt.x + toPt.x) / 2, (fromPt.y + toPt.y) / 2, escapeXml(edge.label), 30));
        }
      }

      const step = edge.properties?.step;
      if (step) {
        const stepNum = parseInt(step, 10);
        if (!isNaN(stepNum)) {
          parts.push(numberedCircle((fromPt.x + toPt.x) / 2, (fromPt.y + toPt.y) / 2, stepNum));
        }
      }
      continue;
    }

    if (siblings.length > 1) {
      // Multi-edge pair: create truly horizontal (or vertical) parallel edges
      // Use wider spread when edges have labels to prevent label overlap
      const hasLabels = siblings.some(s => s.label && s.label.length > 0);
      const spread = hasLabels ? 80 : 35;
      const shift = (idx - (siblings.length - 1) / 2) * spread;
      const fc = nodeCenter(fromNode);
      const tc = nodeCenter(toNode);
      const isHorizontal = Math.abs(tc.x - fc.x) > Math.abs(tc.y - fc.y);

      const clampY = (y: number, n: { y: number; h: number }) =>
        Math.max(n.y + 4, Math.min(n.y + n.h - 4, y));
      const clampX = (x: number, n: { x: number; w: number }) =>
        Math.max(n.x + 4, Math.min(n.x + n.w - 4, x));

      if (isHorizontal) {
        // Find vertical overlap between nodes for optimal routing
        const overlapTop = Math.max(fromNode.y, toNode.y);
        const overlapBot = Math.min(fromNode.y + fromNode.h, toNode.y + toNode.h);
        const baseY = overlapTop < overlapBot
          ? (overlapTop + overlapBot) / 2  // Use overlap center
          : (fc.y + tc.y) / 2;            // Fallback to midpoint
        const edgeY = baseY + shift;

        if (fc.x < tc.x) {
          fromPt = { x: fromNode.x + fromNode.w, y: clampY(edgeY, fromNode) };
          toPt = { x: toNode.x, y: clampY(edgeY, toNode) };
        } else {
          fromPt = { x: fromNode.x, y: clampY(edgeY, fromNode) };
          toPt = { x: toNode.x + toNode.w, y: clampY(edgeY, toNode) };
        }
      } else {
        const overlapLeft = Math.max(fromNode.x, toNode.x);
        const overlapRight = Math.min(fromNode.x + fromNode.w, toNode.x + toNode.w);
        const baseX = overlapLeft < overlapRight
          ? (overlapLeft + overlapRight) / 2
          : (fc.x + tc.x) / 2;
        const edgeX = baseX + shift;

        if (fc.y < tc.y) {
          fromPt = { x: clampX(edgeX, fromNode), y: fromNode.y + fromNode.h };
          toPt = { x: clampX(edgeX, toNode), y: toNode.y };
        } else {
          fromPt = { x: clampX(edgeX, fromNode), y: fromNode.y };
          toPt = { x: clampX(edgeX, toNode), y: toNode.y + toNode.h };
        }
      }
    } else {
      fromPt = connectionPoint(fromNode, nodeCenter(toNode).x, nodeCenter(toNode).y);
      toPt = connectionPoint(toNode, nodeCenter(fromNode).x, nodeCenter(fromNode).y);
    }

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

    // Edge label
    if (edge.label) {
      const t = 0.5;
      const lx = fromPt.x + (toPt.x - fromPt.x) * t;
      const ly = fromPt.y + (toPt.y - fromPt.y) * t;
      parts.push(edgeLabelMultiline(lx, ly, escapeXml(edge.label), 30));
    }

    // Numbered step circle on edge
    const step = edge.properties?.step;
    if (step) {
      const stepNum = parseInt(step, 10);
      if (!isNaN(stepNum)) {
        const st = 0.5;
        const sx = fromPt.x + (toPt.x - fromPt.x) * st;
        const sy = fromPt.y + (toPt.y - fromPt.y) * st;
        // Offset the circle slightly perpendicular to the edge
        const edgeDx = toPt.x - fromPt.x;
        const edgeDy = toPt.y - fromPt.y;
        const edgeLen = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy) || 1;
        // Place circle at midpoint, shifted above edge if label present
        const offset = edge.label ? -20 : 0;
        const nx = -edgeDy / edgeLen;
        const ny = edgeDx / edgeLen;
        parts.push(numberedCircle(sx + nx * offset, sy + ny * offset, stepNum));
      }
    }
  }

  return parts.join('\n');
}

function renderSubgraph(sg: PositionedSubgraph): string {
  const { x, y, w, h, label, properties } = sg;
  const fill = fillForPattern(properties.fill);
  const rx = spacing.borderRadius;
  let svg = '';

  // Background with pattern fill and green border at reduced opacity
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${colors.accent}" stroke-width="${stroke.node}" opacity="0.5"/>`;
  // Solid border on top for clarity
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="none" stroke="${colors.accent}" stroke-width="${stroke.node}" opacity="0.4"/>`;

  // Title — mixed case, top-left inside
  if (label) {
    svg += `<text x="${x + 18}" y="${y + 26}" font-family="${fonts.sans}" font-size="${fontSizes.subtitle}" fill="${colors.white}" opacity="0.9">${escapeXml(label)}</text>`;
  }

  return svg;
}

function renderOverflow(ov: PositionedOverflow): string {
  const { x, y } = ov;
  const r = 3;
  const gap = 12;
  let svg = '';
  svg += `<circle cx="${x - gap}" cy="${y}" r="${r}" fill="${colors.accent}"/>`;
  svg += `<circle cx="${x}" cy="${y}" r="${r}" fill="${colors.accent}"/>`;
  svg += `<circle cx="${x + gap}" cy="${y}" r="${r}" fill="${colors.accent}"/>`;
  return svg;
}

function renderCodeBlock(cb: PositionedCodeBlock): string {
  const { x, y, label, code } = cb;
  const lines = code.split('\n');
  let svg = '';

  // Title in bold uppercase green
  svg += `<text x="${x}" y="${y + fontSizes.nodeLabel}" font-family="${fonts.mono}" font-size="${fontSizes.nodeLabel}" fill="${colors.accent}" font-weight="700" letter-spacing="${spacing.letterSpacing}">${escapeXml(label).toUpperCase()}</text>`;

  // Code lines below title
  const codeStartY = y + fontSizes.nodeLabel + 16;
  const lineH = 18;
  for (let i = 0; i < lines.length; i++) {
    svg += `<text x="${x + 4}" y="${codeStartY + i * lineH}" font-family="${fonts.mono}" font-size="${fontSizes.codeBlock}" fill="${colors.accent}" opacity="0.7">${escapeXml(lines[i])}</text>`;
  }

  return svg;
}

function renderAnnotation(ann: PositionedAnnotation): string {
  const lines = ann.text.split('\n');
  if (lines.length === 1 && !ann.properties?.step) {
    return annotation(ann.x, ann.y, escapeXml(ann.text));
  }

  let svg = '';
  const lineH = 18;
  let startX = ann.x;
  const startY = ann.y;

  // Step number circle
  const step = ann.properties?.step;
  if (step) {
    const stepNum = parseInt(step, 10);
    if (!isNaN(stepNum)) {
      svg += numberedCircle(startX + 6, startY + 6, stepNum);
      startX += 28;
    }
  }

  // First line: title in white bold
  svg += `<text x="${startX}" y="${startY + 14}" font-family="${fonts.sans}" font-size="${fontSizes.subtitle}" fill="${colors.white}" font-weight="700">${escapeXml(lines[0])}</text>`;

  // Remaining lines: monospace code
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '') continue;
    svg += `<text x="${startX}" y="${startY + 14 + i * lineH}" font-family="${fonts.mono}" font-size="${fontSizes.codeBlock}" fill="${colors.accent}" opacity="0.7">${escapeXml(lines[i])}</text>`;
  }

  return svg;
}

function renderTitle(title: string): string {
  const lines = title.split('\n');
  if (lines.length === 1) {
    return `<text x="30" y="34" font-family="${fonts.sans}" font-size="${fontSizes.title}" fill="${colors.white}" font-weight="700">${escapeXml(title)}</text>`;
  }
  let svg = '';
  const lineH = fontSizes.title + 6;
  for (let i = 0; i < lines.length; i++) {
    svg += `<text x="30" y="${34 + i * lineH}" font-family="${fonts.sans}" font-size="${fontSizes.title}" fill="${colors.white}" font-weight="700">${escapeXml(lines[i])}</text>`;
  }
  return svg;
}

export function renderFlow(layout: FlowLayout): string {
  const parts: string[] = [];

  if (layout.title) {
    parts.push(renderTitle(layout.title));
  }

  // Subgraph backgrounds (behind everything)
  for (const sg of layout.subgraphs) {
    parts.push(renderSubgraph(sg));
  }

  // Edges behind nodes
  parts.push(renderEdges(layout.edges, layout.nodes, layout.codeblocks, layout.direction));

  // Nodes
  for (const node of layout.nodes) {
    parts.push(renderNode(node));
  }

  // Code blocks
  for (const cb of layout.codeblocks) {
    parts.push(renderCodeBlock(cb));
  }

  // Overflows
  for (const ov of layout.overflows) {
    parts.push(renderOverflow(ov));
  }

  // Annotations
  for (const ann of layout.annotations) {
    parts.push(renderAnnotation(ann));
  }

  return parts.join('\n');
}
