// Flow diagram SVG renderer
import type { FlowLayout, PositionedNode, PositionedEdge, PositionedAnnotation, PositionedSubgraph, PositionedOverflow, PositionedCodeBlock } from '../layout/flow-layout.js';
import { colors, fonts, fontSizes, spacing, opacity, stroke } from './theme.js';
import { rect, cylinder, doubleBorder, actor, annotation } from './shapes.js';
import { straightEdge, biEdge, polylineEdge, edgeLabelMultiline, edgeLabelParts, numberedCircle } from './edges.js';
import type { EdgeOpts } from './edges.js';
import { wrapLabel, measureLineWidth } from '../layout/text-measure.js';

const MAX_NODE_LABEL_CHARS = 28;

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
  // Wrap sublabel if too long
  const MAX_SUBLABEL_CHARS = 34;
  const lines = wrapLabel(text, MAX_SUBLABEL_CHARS);
  if (lines.length === 1) {
    return `<text x="${cx}" y="${y}" font-family="${fonts.mono}" font-size="${fontSizes.edgeLabel}" fill="${colors.accent}" opacity="0.6" text-anchor="middle" dominant-baseline="central" letter-spacing="${spacing.letterSpacing}">${escapeXml(text)}</text>`;
  }
  const lineH = fontSizes.edgeLabel * 1.4;
  let svg = '';
  for (let i = 0; i < lines.length; i++) {
    svg += `<text x="${cx}" y="${y + i * lineH}" font-family="${fonts.mono}" font-size="${fontSizes.edgeLabel}" fill="${colors.accent}" opacity="0.6" text-anchor="middle" dominant-baseline="central" letter-spacing="${spacing.letterSpacing}">${escapeXml(lines[i])}</text>`;
  }
  return svg;
}

/** Render a (possibly multi-line wrapped) label inside a node */
function renderWrappedLabel(cx: number, cy: number, label: string, formatLabel: (l: string) => string, offsetY: number): string {
  const lines = wrapLabel(label, MAX_NODE_LABEL_CHARS);
  if (lines.length === 1) {
    return `<text x="${cx}" y="${cy + offsetY}" font-family="${fonts.mono}" font-size="${fontSizes.nodeLabel}" fill="${colors.accent}" text-anchor="middle" dominant-baseline="central" letter-spacing="${spacing.letterSpacing}">${escapeXml(formatLabel(label))}</text>`;
  }
  const lineH = fontSizes.nodeLabel * 1.4;
  const totalH = lines.length * lineH;
  const startY = cy + offsetY - totalH / 2 + lineH / 2;
  let svg = '';
  for (let i = 0; i < lines.length; i++) {
    svg += `<text x="${cx}" y="${startY + i * lineH}" font-family="${fonts.mono}" font-size="${fontSizes.nodeLabel}" fill="${colors.accent}" text-anchor="middle" dominant-baseline="central" letter-spacing="${spacing.letterSpacing}">${escapeXml(formatLabel(lines[i]))}</text>`;
  }
  return svg;
}

/** Compute text background rect for wrapped labels */
function wrappedLabelBg(cx: number, cy: number, label: string, formatLabel: (l: string) => string, offsetY: number): string {
  const lines = wrapLabel(label, MAX_NODE_LABEL_CHARS);
  const formatted = lines.map(l => formatLabel(l));
  const maxLen = Math.max(...formatted.map(l => l.length));
  const textW = maxLen * 8 + 16;
  const lineH = fontSizes.nodeLabel * 1.4;
  const textH = lines.length * lineH + 4;
  return `<rect x="${cx - textW / 2}" y="${cy + offsetY - textH / 2}" width="${textW}" height="${textH}" fill="${colors.bg}" rx="2"/>`;
}

/** Compute background rect SVG for sublabel text, handling multi-line wrapping */
function sublabelBgRect(cx: number, y: number, text: string): string {
  const MAX_SUBLABEL_CHARS = 34;
  const lines = wrapLabel(text, MAX_SUBLABEL_CHARS);
  const maxLineLen = Math.max(...lines.map(l => l.length));
  const textW = maxLineLen * 8 + 16;
  const lineH = fontSizes.edgeLabel * 1.4;
  const textH = lines.length * lineH + 6;
  const centerY = y + (lines.length - 1) * lineH / 2;
  return `<rect x="${cx - textW / 2}" y="${centerY - textH / 2}" width="${textW}" height="${textH}" fill="${colors.bg}" rx="2"/>`;
}

function renderNode(node: PositionedNode, theme?: string): string {
  const { x, y, w, h, label, kind, properties } = node;
  const rawFill = fillForPattern(properties.fill);
  // Make nodes opaque so subgraph patterns don't bleed through
  const fill = rawFill === 'transparent' ? colors.bg : rawFill;
  const hasSublabel = !!properties.sublabel;
  const labelOffsetY = hasSublabel ? -8 : 0;
  const formatLabel = (l: string) => theme === 'white' ? l : l.toUpperCase();

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
      svg += `<text x="${cx}" y="${cy}" font-family="${fonts.mono}" font-size="${fontSizes.nodeLabel}" fill="${colors.accent}" text-anchor="middle" dominant-baseline="central" letter-spacing="${spacing.letterSpacing}">${escapeXml(formatLabel(label))}</text>`;
    }
    return svg;
  }

  // Double border: explicit property or service kind
  const useDoubleBorder = kind === 'service' || properties.border === 'double';

  if (useDoubleBorder) {
    const dbFill = kind === 'service' && !properties.fill ? 'url(#hero)' : fill;
    let svg = doubleBorder({ x, y, w, h, label: undefined, fill: dbFill });
    const dbHasPattern = dbFill.startsWith('url(');
    if (label) {
      if (dbHasPattern) {
        svg += wrappedLabelBg(x + w / 2, y + h / 2, label, formatLabel, labelOffsetY);
      }
      svg += renderWrappedLabel(x + w / 2, y + h / 2, label, formatLabel, labelOffsetY);
    }
    if (properties.sublabel) {
      if (dbHasPattern) {
        svg += sublabelBgRect(x + w / 2, y + h / 2 + 12, properties.sublabel);
      }
      svg += renderSublabel(x + w / 2, y + h / 2 + 12, properties.sublabel);
    }
    return svg;
  }

  if (kind === 'datastore') {
    let svg = cylinder({ x, y, w, h, label: undefined, fill });
    const dsHasPattern = rawFill.startsWith('url(');
    if (label) {
      if (dsHasPattern) {
        svg += wrappedLabelBg(x + w / 2, y + h / 2, label, formatLabel, labelOffsetY);
      }
      svg += renderWrappedLabel(x + w / 2, y + h / 2, label, formatLabel, labelOffsetY);
    }
    if (properties.sublabel) {
      if (dsHasPattern) {
        svg += sublabelBgRect(x + w / 2, y + h / 2 + 12, properties.sublabel);
      }
      svg += renderSublabel(x + w / 2, y + h / 2 + 12, properties.sublabel);
    }
    return svg;
  }

  // component, external, label, default — standard rect (or pill if shape: pill)
  // Pill = rectangle with rx = height/2 (fully semicircular ends), NOT an ellipse
  const rx = properties.shape === 'pill' ? h / 2 : undefined;
  let svg = rect({ x, y, w, h, label: undefined, fill, ...(rx !== undefined ? { rx } : {}) });
  const hasPatternFill = rawFill.startsWith('url(');
  if (label) {
    if (hasPatternFill) {
      svg += wrappedLabelBg(x + w / 2, y + h / 2, label, formatLabel, labelOffsetY);
    }
    svg += renderWrappedLabel(x + w / 2, y + h / 2, label, formatLabel, labelOffsetY);
  }
  if (properties.sublabel) {
    if (hasPatternFill) {
      svg += sublabelBgRect(x + w / 2, y + h / 2 + 12, properties.sublabel);
    }
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

/** Compute label half-width and half-height for collision checking */
function labelDims(text: string, maxChars: number): { halfW: number; halfH: number } {
  const words = text.split(/\s+/);
  const wrapLines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > maxChars) { wrapLines.push(cur); cur = w; }
    else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) wrapLines.push(cur);
  const maxLineLen = Math.max(...wrapLines.map(l => l.length));
  return {
    halfW: (maxLineLen * 7.0 + 12) / 2,
    halfH: (wrapLines.length * 16 + 6) / 2,
  };
}

/** Check if a line segment from p1 to p2 intersects an axis-aligned bounding box */
function lineSegmentIntersectsAABB(
  p1: { x: number; y: number }, p2: { x: number; y: number },
  box: { x: number; y: number; w: number; h: number },
  clearance: number,
): boolean {
  const minX = box.x - clearance;
  const maxX = box.x + box.w + clearance;
  const minY = box.y - clearance;
  const maxY = box.y + box.h + clearance;

  if (p1.x < minX && p2.x < minX) return false;
  if (p1.x > maxX && p2.x > maxX) return false;
  if (p1.y < minY && p2.y < minY) return false;
  if (p1.y > maxY && p2.y > maxY) return false;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  let tMin = 0, tMax = 1;

  if (dx !== 0) {
    let t1 = (minX - p1.x) / dx;
    let t2 = (maxX - p1.x) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  } else {
    if (p1.x < minX || p1.x > maxX) return false;
  }

  if (dy !== 0) {
    let t1 = (minY - p1.y) / dy;
    let t2 = (maxY - p1.y) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  } else {
    if (p1.y < minY || p1.y > maxY) return false;
  }

  return true;
}

/** Check if two edges connect the same pair of nodes */
function edgePairKey(e: PositionedEdge): string {
  const a = e.from < e.to ? e.from : e.to;
  const b = e.from < e.to ? e.to : e.from;
  return `${a}--${b}`;
}

/** Compute bounding box of a subgraph header label (mirrors renderSubgraphLabel positioning) */
function subgraphHeaderBBox(sg: PositionedSubgraph, allSubgraphs: PositionedSubgraph[]): { x: number; y: number; w: number; h: number } | null {
  if (!sg.label) return null;
  const textW = sg.label.length * 7.5 + 20;
  const textH = fontSizes.subtitle + 10;
  let useLeftAlign = false;
  const myCenterX = sg.x + sg.w / 2;
  for (const other of allSubgraphs) {
    if (other === sg || !other.label) continue;
    if (Math.abs(other.y - sg.y) < 50) {
      const otherCenterX = other.x + other.w / 2;
      const otherTextW = other.label.length * 7.5 + 20;
      if (Math.abs(myCenterX - otherCenterX) < (textW + otherTextW) / 2 + 8) {
        useLeftAlign = true;
        break;
      }
    }
  }
  if (useLeftAlign) {
    return { x: sg.x + 8, y: sg.y + 26 - textH / 2 - 1, w: textW, h: textH };
  }
  return { x: sg.x + sg.w / 2 - textW / 2, y: sg.y + 26 - textH / 2 - 1, w: textW, h: textH };
}

/** Compute bounding box of an annotation */
function annotationBBox(ann: PositionedAnnotation): { x: number; y: number; w: number; h: number } {
  const lines = ann.text.split('\n');
  const maxLineLen = Math.max(...lines.map(l => l.length));
  const cappedLen = Math.min(maxLineLen, 50);
  const lineH = 18;
  let startX = ann.x;
  if (ann.properties?.step) startX -= 6;
  if (lines.length === 1 && !ann.properties?.step) {
    const w = cappedLen * 7;
    const h = fontSizes.annotation + 4;
    return { x: ann.x, y: ann.y - h / 2, w, h };
  }
  const w = cappedLen * 7 + (ann.properties?.step ? 28 : 0);
  const h = lines.length * lineH;
  return { x: startX, y: ann.y, w, h };
}

/** Nudge an annotation to avoid overlapping with occupied text rects */
function nudgeAnnotation(ann: PositionedAnnotation, obstacles: { x: number; y: number; w: number; h: number }[]): void {
  const bbox = annotationBBox(ann);
  const clearance = 8;
  for (const obs of obstacles) {
    if (bbox.x < obs.x + obs.w + clearance && bbox.x + bbox.w > obs.x - clearance &&
        bbox.y < obs.y + obs.h + clearance && bbox.y + bbox.h > obs.y - clearance) {
      const obsCenterY = obs.y + obs.h / 2;
      const annCenterY = bbox.y + bbox.h / 2;
      let shift: number;
      if (annCenterY <= obsCenterY) {
        shift = (obs.y - clearance) - (bbox.y + bbox.h);
      } else {
        shift = (obs.y + obs.h + clearance) - bbox.y;
      }
      ann.y += shift;
      bbox.y += shift;
    }
  }
}

function renderEdges(edges: PositionedEdge[], nodes: PositionedNode[], codeblocks: PositionedCodeBlock[], direction?: string, subgraphs?: PositionedSubgraph[], occupiedRects?: { x: number; y: number; w: number; h: number }[]): { lines: string; labelBgs: string; labels: string; labelBoxes: { x: number; y: number; w: number; h: number }[] } {
  const nodeById = new Map<string, PositionedNode | PositionedCodeBlock>();
  for (const n of nodes) nodeById.set(n.id, n);
  for (const cb of codeblocks) nodeById.set(cb.id, cb);
  const parts: string[] = [];
  const labelBgParts: string[] = [];
  const labelParts: string[] = [];
  // Collect label positions for collision resolution
  // targetId tracks which node the edge points to, for convergence fan-out
  const pendingLabels: { x: number; y: number; text: string; maxChars: number; halfW: number; halfH: number; targetId?: string }[] = [];

  // Group edges by node pair
  const pairEdges = new Map<string, PositionedEdge[]>();
  for (const e of edges) {
    const key = edgePairKey(e);
    if (!pairEdges.has(key)) pairEdges.set(key, []);
    pairEdges.get(key)!.push(e);
  }
  const pairIndex = new Map<string, number>();

  // Lazy-initialized backward edge index for TB mode offset stacking
  let backwardEdgeIndex: Map<string, number> | undefined;

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
        const EDGE_CLEARANCE = 12;
        if (Math.abs(fc.x - tc.x) < 80) {
          // Check for intermediate nodes blocking the straight path
          let blocked = false;
          for (const [, node] of nodeById) {
            if (node === fromNode || node === toNode) continue;
            if (node.x < Math.max(fc.x, tc.x) + EDGE_CLEARANCE &&
                node.x + node.w > Math.min(fc.x, tc.x) - EDGE_CLEARANCE &&
                node.y < toPt.y && node.y + node.h > fromPt.y) {
              blocked = true;
              break;
            }
          }
          if (!blocked) {
            // Use direct straight arrow for close-enough horizontal alignment
            parts.push(straightEdge({ from: fromPt, to: toPt, dashed: edge.dashed, color: colors.accent }));
          } else {
            // Route around blocking node with a polyline
            let midY = (fromPt.y + toPt.y) / 2;
            for (const [, node] of nodeById) {
              if (node === fromNode || node === toNode) continue;
              if (node.x + node.w + EDGE_CLEARANCE < Math.min(fc.x, tc.x)) continue;
              if (node.x - EDGE_CLEARANCE > Math.max(fc.x, tc.x)) continue;
              if (midY >= node.y - EDGE_CLEARANCE && midY <= node.y + node.h + EDGE_CLEARANCE) {
                const aboveMid = node.y - EDGE_CLEARANCE;
                const belowMid = node.y + node.h + EDGE_CLEARANCE;
                midY = Math.abs(midY - aboveMid) < Math.abs(midY - belowMid) ? aboveMid : belowMid;
              }
            }
            parts.push(polylineEdge({
              from: fromPt, to: toPt,
              waypoints: [{ x: fc.x, y: midY }, { x: tc.x, y: midY }],
              dashed: edge.dashed, color: colors.accent,
            }));
          }
        } else {
          let midY = (fromPt.y + toPt.y) / 2;
          // Avoid subgraph label areas — compute zone from font metrics
          if (subgraphs) {
            const labelZoneH = fontSizes.subtitle + 24; // label height + padding
            for (const sg of subgraphs) {
              if (midY >= sg.y - 2 && midY <= sg.y + labelZoneH) {
                midY = sg.y + labelZoneH + 4;
              }
            }
          }
          // Clear intermediate nodes from polyline horizontal segment
          const segMinX = Math.min(fc.x, tc.x);
          const segMaxX = Math.max(fc.x, tc.x);
          for (const [, node] of nodeById) {
            if (node === fromNode || node === toNode) continue;
            if (node.x + node.w + EDGE_CLEARANCE < segMinX) continue;
            if (node.x - EDGE_CLEARANCE > segMaxX) continue;
            if (midY >= node.y - EDGE_CLEARANCE && midY <= node.y + node.h + EDGE_CLEARANCE) {
              const aboveMid = node.y - EDGE_CLEARANCE;
              const belowMid = node.y + node.h + EDGE_CLEARANCE;
              midY = Math.abs(midY - aboveMid) < Math.abs(midY - belowMid) ? aboveMid : belowMid;
            }
          }
          parts.push(polylineEdge({
            from: fromPt, to: toPt,
            waypoints: [{ x: fc.x, y: midY }, { x: tc.x, y: midY }],
            dashed: edge.dashed, color: colors.accent,
          }));
        }
        if (edge.label) {
          const lx = (fc.x + tc.x) / 2;
          let ly = (fromPt.y + toPt.y) / 2;
          // Avoid subgraph label areas for edge labels — compute zone from font metrics
          if (subgraphs) {
            const labelZoneH = fontSizes.subtitle + 24;
            for (const sg of subgraphs) {
              if (ly >= sg.y - 2 && ly <= sg.y + labelZoneH) {
                ly = sg.y + labelZoneH + 4;
              }
            }
          }
          { const eLabel = escapeXml(edge.label); const dims = labelDims(eLabel, 30); pendingLabels.push({ x: lx, y: ly, text: eLabel, maxChars: 30, halfW: dims.halfW, halfH: dims.halfH, targetId: visualTo }); }
        }
      } else if (isBackward) {
        // Route along left (or right) side of diagram, entering target from below
        const minNodeX = Math.min(...nodes.map(n => n.x), ...codeblocks.map(c => c.x));
        const maxNodeX = Math.max(...nodes.map(n => n.x + n.w), ...codeblocks.map(c => c.x + c.w));
        const minSgX = subgraphs && subgraphs.length > 0
          ? Math.min(...subgraphs.map(sg => sg.x))
          : minNodeX;
        const maxSgX = subgraphs && subgraphs.length > 0
          ? Math.max(...subgraphs.map(sg => sg.x + sg.w))
          : maxNodeX;

        // Count backward edges for offset stacking
        if (!backwardEdgeIndex) {
          backwardEdgeIndex = new Map();
          let idx = 0;
          for (const e2 of edges) {
            const vFrom = (e2.arrow === '<--' || e2.arrow === '<-.-') ? e2.to : e2.from;
            const vTo = (e2.arrow === '<--' || e2.arrow === '<-.-') ? e2.from : e2.to;
            const fn = nodeById.get(vFrom);
            const tn = nodeById.get(vTo);
            if (!fn || !tn) continue;
            if (tn.y + tn.h <= fn.y + 5) {
              backwardEdgeIndex.set(`${vFrom}->${vTo}`, idx++);
            }
          }
        }

        const edgeIdx = backwardEdgeIndex.get(`${visualFrom}->${visualTo}`) || 0;
        const BASE_CLEARANCE = 40;
        const PER_EDGE_OFFSET = 20;

        // Route right-side when source is to the right of target
        const routeRight = fc.x > tc.x;
        let routeX: number;
        if (routeRight) {
          routeX = Math.max(maxNodeX, maxSgX) + BASE_CLEARANCE + edgeIdx * PER_EDGE_OFFSET;
          fromPt = { x: fromNode.x + fromNode.w, y: fc.y };
        } else {
          routeX = Math.min(minNodeX, minSgX) - BASE_CLEARANCE - edgeIdx * PER_EDGE_OFFSET;
          fromPt = { x: fromNode.x, y: fc.y };
        }
        toPt = { x: tc.x, y: toNode.y + toNode.h };
        const belowTarget = toNode.y + toNode.h + 15;
        parts.push(polylineEdge({
          from: fromPt, to: toPt,
          waypoints: [{ x: routeX, y: fc.y }, { x: routeX, y: belowTarget }, { x: tc.x, y: belowTarget }],
          dashed: edge.dashed, color: colors.accent,
        }));
        if (edge.label) {
          { const eLabel = escapeXml(edge.label); const dims = labelDims(eLabel, 30); pendingLabels.push({ x: routeX, y: (fc.y + belowTarget) / 2, text: eLabel, maxChars: 30, halfW: dims.halfW, halfH: dims.halfH, targetId: visualTo }); }
        }
      } else {
        // Same row: standard routing
        fromPt = connectionPoint(fromNode, tc.x, tc.y);
        toPt = connectionPoint(toNode, fc.x, fc.y);
        const opts = { from: fromPt, to: toPt, dashed: edge.dashed, color: colors.accent };
        parts.push(edge.arrow === '<-->' ? biEdge(opts) : straightEdge(opts));
        if (edge.label) {
          { const eLabel = escapeXml(edge.label); const dims = labelDims(eLabel, 30); pendingLabels.push({ x: (fromPt.x + toPt.x) / 2, y: (fromPt.y + toPt.y) / 2, text: eLabel, maxChars: 30, halfW: dims.halfW, halfH: dims.halfH, targetId: visualTo }); }
        }
      }

      const step = edge.properties?.step;
      if (step) {
        const stepNum = parseInt(step, 10);
        if (!isNaN(stepNum)) {
          const st = 0.3;
          parts.push(numberedCircle(fromPt.x + (toPt.x - fromPt.x) * st, fromPt.y + (toPt.y - fromPt.y) * st, stepNum));
        }
      }
      continue;
    }

    if (siblings.length > 1) {
      // Multi-edge pair: create truly horizontal (or vertical) parallel edges
      // Use wider spread when edges have labels to prevent label overlap
      const hasLabels = siblings.some(s => s.label && s.label.length > 0);
      const spread = hasLabels ? 65 : 28;
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

    // Check for obstacle nodes blocking straight non-TB edges
    let obstacleRouted = false;
    if (siblings.length === 1) {
      const EDGE_CLEARANCE = 12;
      let blockingNode: (PositionedNode | PositionedCodeBlock) | undefined;
      for (const [, node] of nodeById) {
        if (node === fromNode || node === toNode) continue;
        if (lineSegmentIntersectsAABB(fromPt, toPt, node, EDGE_CLEARANCE)) {
          blockingNode = node as PositionedNode | PositionedCodeBlock;
          break;
        }
      }
      if (blockingNode) {
        const nc = nodeCenter(blockingNode as any);
        const isHorizontal = Math.abs(toPt.x - fromPt.x) > Math.abs(toPt.y - fromPt.y);
        if (isHorizontal) {
          const midY = fromPt.y < nc.y
            ? blockingNode.y - EDGE_CLEARANCE
            : blockingNode.y + blockingNode.h + EDGE_CLEARANCE;
          parts.push(polylineEdge({
            from: fromPt, to: toPt,
            waypoints: [{ x: fromPt.x, y: midY }, { x: toPt.x, y: midY }],
            dashed: edge.dashed, color: colors.accent,
            ...(edge.arrow === '<-->' ? { markerStart: 'url(#arrowhead-reverse)' } : {}),
          }));
        } else {
          const midX = fromPt.x < nc.x
            ? blockingNode.x - EDGE_CLEARANCE
            : blockingNode.x + blockingNode.w + EDGE_CLEARANCE;
          parts.push(polylineEdge({
            from: fromPt, to: toPt,
            waypoints: [{ x: midX, y: fromPt.y }, { x: midX, y: toPt.y }],
            dashed: edge.dashed, color: colors.accent,
            ...(edge.arrow === '<-->' ? { markerStart: 'url(#arrowhead-reverse)' } : {}),
          }));
        }
        obstacleRouted = true;
      }
    }

    if (!obstacleRouted) {
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
    }

    // Edge label with collision avoidance
    if (edge.label) {
      // Stagger label position along edge for multi-edge siblings
      const t = siblings.length > 1
        ? 0.3 + (idx / Math.max(1, siblings.length - 1)) * 0.4
        : 0.5;
      let lx = fromPt.x + (toPt.x - fromPt.x) * t;
      let ly = fromPt.y + (toPt.y - fromPt.y) * t;

      // Fixed wrap width for edge labels (adaptive wrapping removed)
      const maxChars = 30;

      // Estimate label dimensions for collision check
      const eLabel = escapeXml(edge.label);
      const words = eLabel.split(/\s+/);
      const wrapLines: string[] = [];
      let cur = '';
      for (const w of words) {
        if (cur && (cur + ' ' + w).length > maxChars) { wrapLines.push(cur); cur = w; }
        else cur = cur ? cur + ' ' + w : w;
      }
      if (cur) wrapLines.push(cur);
      const maxLineLen = Math.max(...wrapLines.map(l => l.length));
      const labelHalfW = (maxLineLen * 7.0 + 12) / 2;
      const labelHalfH = (wrapLines.length * 16 + 6) / 2;
      // Fixed clearance for edge labels (sublabel-specific logic removed)
      const clearance = 8;

      // Clamp label horizontally to stay clear of edge endpoints
      const leftX = Math.min(fromPt.x, toPt.x);
      const rightX = Math.max(fromPt.x, toPt.x);
      const minLx = leftX + labelHalfW + clearance;
      const maxLx = rightX - labelHalfW - clearance;
      if (minLx <= maxLx) {
        lx = Math.max(minLx, Math.min(maxLx, lx));
      }

      pendingLabels.push({ x: lx, y: ly, text: eLabel, maxChars, halfW: labelHalfW, halfH: labelHalfH, targetId: visualTo });
    }

    // Numbered step circle on edge
    const step = edge.properties?.step;
    if (step) {
      const stepNum = parseInt(step, 10);
      if (!isNaN(stepNum)) {
        const st = 0.3;
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

  // Convergence/fan-out: when multiple labeled edges share the same target
  // or source node, pre-stagger their labels to prevent pile-up
  {
    const isVerticalLayout = direction === 'TB' || direction === 'BT';
    const fanSpacing = 30; // px between staggered labels

    // Group by target node (convergence)
    const byTarget = new Map<string, number[]>();
    for (let i = 0; i < pendingLabels.length; i++) {
      const tid = pendingLabels[i].targetId;
      if (!tid) continue;
      if (!byTarget.has(tid)) byTarget.set(tid, []);
      byTarget.get(tid)!.push(i);
    }
    const alreadyStaggered = new Set<number>();
    for (const [tid, indices] of byTarget) {
      if (indices.length < 2) continue;
      const targetNode = nodeById.get(tid);
      if (!targetNode) continue;
      const totalSpan = (indices.length - 1) * fanSpacing;
      for (let k = 0; k < indices.length; k++) {
        const offset = -totalSpan / 2 + k * fanSpacing;
        if (isVerticalLayout) {
          pendingLabels[indices[k]].x += offset;
        } else {
          pendingLabels[indices[k]].y += offset;
        }
        alreadyStaggered.add(indices[k]);
      }
    }

    // Group by source node (fan-out) — only stagger labels not already handled
    const bySource = new Map<string, number[]>();
    for (const e of edges) {
      const visualFrom = (e.arrow === '<--' || e.arrow === '<-.-') ? e.to : e.from;
      if (!e.label) continue;
      // Find the pending label index for this edge's label
      // Match by targetId since we stored the visual target
      const visualTo = (e.arrow === '<--' || e.arrow === '<-.-') ? e.from : e.to;
      for (let i = 0; i < pendingLabels.length; i++) {
        if (alreadyStaggered.has(i)) continue;
        if (pendingLabels[i].targetId === visualTo && pendingLabels[i].text === escapeXml(e.label)) {
          if (!bySource.has(visualFrom)) bySource.set(visualFrom, []);
          const arr = bySource.get(visualFrom)!;
          if (!arr.includes(i)) arr.push(i);
          break;
        }
      }
    }
    for (const [, indices] of bySource) {
      if (indices.length < 2) continue;
      const totalSpan = (indices.length - 1) * fanSpacing;
      for (let k = 0; k < indices.length; k++) {
        const offset = -totalSpan / 2 + k * fanSpacing;
        if (isVerticalLayout) {
          pendingLabels[indices[k]].x += offset;
        } else {
          pendingLabels[indices[k]].y += offset;
        }
      }
    }
  }

  // Node-overlap resolution for all pending labels
  const labelClearance = 8;
  for (const label of pendingLabels) {
    for (const [, node] of nodeById) {
      const hOverlap = label.x - label.halfW < node.x + node.w + labelClearance && label.x + label.halfW > node.x - labelClearance;
      const vOverlap = label.y - label.halfH < node.y + node.h + labelClearance && label.y + label.halfH > node.y - labelClearance;
      if (hOverlap && vOverlap) {
        const nc = nodeCenter(node);
        if (label.y <= nc.y) {
          label.y = node.y - label.halfH - labelClearance;
        } else {
          label.y = node.y + node.h + label.halfH + labelClearance;
        }
      }
    }
  }

  // Push edge labels away from occupied rects (subgraph headers, annotations)
  if (occupiedRects) {
    for (const label of pendingLabels) {
      for (const occ of occupiedRects) {
        const hOverlap = label.x - label.halfW < occ.x + occ.w + labelClearance && label.x + label.halfW > occ.x - labelClearance;
        const vOverlap = label.y - label.halfH < occ.y + occ.h + labelClearance && label.y + label.halfH > occ.y - labelClearance;
        if (hOverlap && vOverlap) {
          const occCenterY = occ.y + occ.h / 2;
          if (label.y <= occCenterY) {
            label.y = occ.y - label.halfH - labelClearance;
          } else {
            label.y = occ.y + occ.h + label.halfH + labelClearance;
          }
        }
      }
    }
  }

  // Resolve label-label collisions (multi-pass for dense convergence zones)
  for (let pass = 0; pass < 7; pass++) {
    let changed = false;
    for (let i = 0; i < pendingLabels.length; i++) {
      for (let j = i + 1; j < pendingLabels.length; j++) {
        const a = pendingLabels[i], b = pendingLabels[j];
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        if (dx < a.halfW + b.halfW && dy < a.halfH + b.halfH) {
          const overlapX = (a.halfW + b.halfW) - dx;
          const overlapY = (a.halfH + b.halfH) - dy;
          // Resolve along the axis with smaller overlap (less disruptive)
          if (overlapY <= overlapX) {
            const shift = overlapY / 2 + 4;
            if (a.y <= b.y) { a.y -= shift; b.y += shift; }
            else { a.y += shift; b.y -= shift; }
          } else {
            const shift = overlapX / 2 + 4;
            if (a.x <= b.x) { a.x -= shift; b.x += shift; }
            else { a.x += shift; b.x -= shift; }
          }
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  // Generate SVG for collision-resolved labels
  for (const label of pendingLabels) {
    const p = edgeLabelParts(label.x, label.y, label.text, label.maxChars);
    labelBgParts.push(p.bg);
    labelParts.push(p.fg);
  }

  // Compute label bounding boxes for cross-element collision detection
  const labelBoxes = pendingLabels.map(l => ({
    x: l.x - l.halfW,
    y: l.y - l.halfH,
    w: l.halfW * 2,
    h: l.halfH * 2,
  }));

  return { lines: parts.join('\n'), labelBgs: labelBgParts.join('\n'), labels: labelParts.join('\n'), labelBoxes };
}

function renderSubgraphBg(sg: PositionedSubgraph): string {
  const { x, y, w, h, properties } = sg;
  const fill = fillForPattern(properties.fill);
  const rx = spacing.borderRadius;
  let svg = '';

  // Background with pattern fill and border at reduced opacity
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${colors.accent}" stroke-width="1" opacity="0.35"/>`;
  // Solid border on top for clarity
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="none" stroke="${colors.accent}" stroke-width="1" opacity="0.5"/>`;

  return svg;
}

function renderSubgraphLabel(sg: PositionedSubgraph, allSubgraphs?: PositionedSubgraph[]): string {
  const { x, y, w, label } = sg;
  if (!label) return '';

  let svg = '';
  const textW = label.length * 7.5 + 20;
  const textH = fontSizes.subtitle + 10;

  // Check if centering would overlap with another subgraph label
  let useLeftAlign = false;
  if (allSubgraphs) {
    const myCenterX = x + w / 2;
    for (const other of allSubgraphs) {
      if (other === sg || !other.label) continue;
      // Check if other subgraph label area overlaps at the same y
      if (Math.abs(other.y - y) < 50) {
        const otherCenterX = other.x + other.w / 2;
        const otherTextW = other.label.length * 7.5 + 20;
        if (Math.abs(myCenterX - otherCenterX) < (textW + otherTextW) / 2 + 8) {
          useLeftAlign = true;
          break;
        }
      }
    }
  }

  if (useLeftAlign) {
    // Left-align to avoid collision with neighboring subgraph labels
    svg += `<rect x="${x + 8}" y="${y + 26 - textH / 2 - 1}" width="${textW}" height="${textH}" fill="${colors.bg}" rx="3"/>`;
    svg += `<text x="${x + 18}" y="${y + 26}" font-family="${fonts.sans}" font-size="${fontSizes.subtitle}" fill="${colors.white}" opacity="0.9" text-anchor="start">${escapeXml(label)}</text>`;
  } else {
    // Default: centered
    svg += `<rect x="${x + w / 2 - textW / 2}" y="${y + 26 - textH / 2 - 1}" width="${textW}" height="${textH}" fill="${colors.bg}" rx="3"/>`;
    svg += `<text x="${x + w / 2}" y="${y + 26}" font-family="${fonts.sans}" font-size="${fontSizes.subtitle}" fill="${colors.white}" opacity="0.9" text-anchor="middle">${escapeXml(label)}</text>`;
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

function renderTitle(title: string, maxWidth?: number): string {
  // Bold text (font-weight:700) renders ~5% wider than regular measurement
  const BOLD_CORRECTION = 1.05;
  const rawLines = title.split('\n');
  const lines: string[] = [];
  for (const line of rawLines) {
    if (!maxWidth || measureLineWidth(line, fontSizes.title, 'sans') * BOLD_CORRECTION <= maxWidth) {
      lines.push(line);
    } else {
      const words = line.split(/\s+/);
      let cur = '';
      for (const word of words) {
        const test = cur ? cur + ' ' + word : word;
        if (measureLineWidth(test, fontSizes.title, 'sans') * BOLD_CORRECTION > maxWidth && cur) {
          lines.push(cur);
          cur = word;
        } else {
          cur = test;
        }
      }
      if (cur) lines.push(cur);
    }
  }

  if (lines.length === 1) {
    return `<text x="30" y="34" font-family="${fonts.sans}" font-size="${fontSizes.title}" fill="${colors.white}" font-weight="700">${escapeXml(lines[0])}</text>`;
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
    parts.push(renderTitle(layout.title, layout.titleMaxWidth));
  }

  // Subgraph backgrounds (behind everything)
  for (const sg of layout.subgraphs) {
    parts.push(renderSubgraphBg(sg));
  }

  // Pre-compute text element bounding boxes for cross-element collision detection
  const sgHeaderBoxes: { x: number; y: number; w: number; h: number }[] = [];
  for (const sg of layout.subgraphs) {
    const bbox = subgraphHeaderBBox(sg, layout.subgraphs);
    if (bbox) sgHeaderBoxes.push(bbox);
  }
  const annBoxes: { x: number; y: number; w: number; h: number }[] = [];
  for (const ann of layout.annotations) {
    annBoxes.push(annotationBBox(ann));
  }
  const occupiedRects = [...sgHeaderBoxes, ...annBoxes];

  // Edge lines and label backgrounds behind nodes, label text on top
  const edgeResult = renderEdges(layout.edges, layout.nodes, layout.codeblocks, layout.direction, layout.subgraphs, occupiedRects);
  parts.push(edgeResult.lines);
  parts.push(edgeResult.labelBgs);

  // Subgraph labels (on top of edges, with background halos)
  for (const sg of layout.subgraphs) {
    parts.push(renderSubgraphLabel(sg, layout.subgraphs));
  }

  // Nodes
  for (const node of layout.nodes) {
    parts.push(renderNode(node, layout.theme));
  }

  // Edge label text on top of nodes so they're never clipped
  parts.push(edgeResult.labels);

  // Code blocks
  for (const cb of layout.codeblocks) {
    parts.push(renderCodeBlock(cb));
  }

  // Overflows
  for (const ov of layout.overflows) {
    parts.push(renderOverflow(ov));
  }

  // Nudge annotations away from edge labels and subgraph headers
  const textObstacles = [...sgHeaderBoxes, ...edgeResult.labelBoxes];
  for (const ann of layout.annotations) {
    nudgeAnnotation(ann, textObstacles);
  }

  // Annotations
  for (const ann of layout.annotations) {
    parts.push(renderAnnotation(ann));
  }

  return parts.join('\n');
}
