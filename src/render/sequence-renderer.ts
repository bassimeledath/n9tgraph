// Sequence diagram SVG renderer
import type { SequenceLayout, LayoutParticipant, LayoutMessage, LayoutFragment, LayoutNote } from '../layout/sequence-layout.js';
import { colors, fonts, fontSizes, spacing, stroke, opacity } from './theme.js';

// ─── Helpers ─────────────────────────────────────────────

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Render message label with **bold** highlight syntax */
function renderLabel(x: number, y: number, text: string, anchor: string = 'start'): string {
  // Parse **bold** segments
  const parts: { text: string; bold: boolean }[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ text: text.slice(lastIdx, match.index), bold: false });
    }
    parts.push({ text: match[1], bold: true });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    parts.push({ text: text.slice(lastIdx), bold: false });
  }

  if (parts.length === 1 && !parts[0].bold) {
    return `<text x="${x}" y="${y}" font-family="${fonts.mono}" font-size="${fontSizes.edgeLabel}" fill="${colors.accent}" text-anchor="${anchor}" letter-spacing="0.04em">${escapeXml(text)}</text>`;
  }

  let svg = `<text x="${x}" y="${y}" font-family="${fonts.mono}" font-size="${fontSizes.edgeLabel}" fill="${colors.accent}" text-anchor="${anchor}" letter-spacing="0.04em">`;
  for (const part of parts) {
    if (part.bold) {
      svg += `<tspan font-weight="700">${escapeXml(part.text)}</tspan>`;
    } else {
      svg += `<tspan>${escapeXml(part.text)}</tspan>`;
    }
  }
  svg += '</text>';
  return svg;
}

// ─── Fill pattern mapping ────────────────────────────────

function fillForPattern(pattern: string): string {
  switch (pattern) {
    case 'dotgrid': return 'url(#dotgrid)';
    case 'crosshatch': return 'url(#crosshatch)';
    case 'hero': return 'url(#hero)';
    default: return 'transparent';
  }
}

// ─── Participant headers ─────────────────────────────────

function renderParticipantBox(box: { x: number; y: number; w: number; h: number }, label: string, fill: string): string {
  const fillVal = fillForPattern(fill);
  const rx = spacing.borderRadius;
  let svg = '';
  svg += `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="${rx}" fill="${fillVal}" stroke="${colors.nodeBorder}" stroke-width="${stroke.node}"/>`;
  svg += `<text x="${box.x + box.w / 2}" y="${box.y + box.h / 2}" font-family="${fonts.mono}" font-size="${fontSizes.nodeLabel}" fill="${colors.accent}" text-anchor="middle" dominant-baseline="central" letter-spacing="${spacing.letterSpacing}">${escapeXml(label.toUpperCase())}</text>`;
  return svg;
}

function renderParticipants(participants: LayoutParticipant[]): string {
  let svg = '';
  // Top headers
  for (const p of participants) {
    svg += renderParticipantBox(p.topBox, p.label, p.fill);
  }
  // Bottom headers
  for (const p of participants) {
    svg += renderParticipantBox(p.bottomBox, p.label, p.fill);
  }
  return svg;
}

// ─── Lifelines ───────────────────────────────────────────

function renderLifelines(participants: LayoutParticipant[], lifelineTop: number, lifelineBottom: number): string {
  let svg = '';
  for (const p of participants) {
    svg += `<line x1="${p.x}" y1="${lifelineTop}" x2="${p.x}" y2="${lifelineBottom}" stroke="${colors.accent}" stroke-width="1" stroke-dasharray="4 4" opacity="0.4"/>`;
  }
  return svg;
}

// ─── Messages ────────────────────────────────────────────

function renderMessages(messages: LayoutMessage[]): string {
  let svg = '';
  for (const msg of messages) {
    if (msg.isSelf) {
      svg += renderSelfMessage(msg);
    } else {
      svg += renderArrowMessage(msg);
    }
  }
  return svg;
}

function renderArrowMessage(msg: LayoutMessage): string {
  let svg = '';
  const { fromX, toX, y, label, arrow } = msg;

  // For <-, the visual arrow goes from toX to fromX (right to left)
  const isReverse = arrow === '<-';
  const lineFromX = isReverse ? toX : fromX;
  const lineToX = isReverse ? fromX : toX;
  const goesRight = lineToX > lineFromX;
  const leftX = Math.min(lineFromX, lineToX);
  const rightX = Math.max(lineFromX, lineToX);

  // Only draw arrow if there's a label or it's not annotation-only
  const hasLabel = label && label.trim().length > 0;
  if (hasLabel) {
    const meAttr = ` marker-end="url(#arrowhead)"`;
    let msAttr = '';
    if (arrow === '<->') {
      msAttr = ` marker-start="url(#arrowhead-reverse)"`;
    }
    svg += `<line x1="${lineFromX}" y1="${y}" x2="${lineToX}" y2="${y}" stroke="${colors.accent}" stroke-width="${stroke.edge}"${msAttr}${meAttr}/>`;

    // Label above the arrow line, aligned to left side
    const labelX = leftX + 8;
    svg += renderLabel(labelX, y - 8, label, 'start');
  }

  // Annotation — positioned at the right end, below the arrow
  if (msg.annotation) {
    const annX = rightX + 10;
    svg += `<text x="${annX}" y="${hasLabel ? y + 14 : y}" font-family="${fonts.sans}" font-size="${fontSizes.annotation}" fill="${colors.annotationColor}" opacity="${opacity.annotation}">${escapeXml(msg.annotation)}</text>`;
  }

  return svg;
}

function renderSelfMessage(msg: LayoutMessage): string {
  const { fromX, y, label } = msg;
  const loopW = 40;
  const loopH = 30;
  let svg = '';

  // Self-referencing path
  svg += `<path d="M${fromX},${y} L${fromX + loopW},${y} L${fromX + loopW},${y + loopH} L${fromX},${y + loopH}" fill="none" stroke="${colors.accent}" stroke-width="${stroke.edge}" marker-end="url(#arrowhead)"/>`;

  if (label) {
    svg += renderLabel(fromX + loopW + 8, y + loopH / 2, label, 'start');
  }

  return svg;
}

// ─── Combined Fragments ──────────────────────────────────

function renderFragments(fragments: LayoutFragment[]): string {
  let svg = '';
  for (const frag of fragments) {
    svg += renderFragment(frag);
  }
  return svg;
}

function renderFragment(frag: LayoutFragment): string {
  let svg = '';
  const { x, y, w, h, kind, condition } = frag;

  // Solid border rectangle
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="none" stroke="${colors.accent}" stroke-width="1"/>`;

  // Label box in top-left corner
  const labelText = kind.toUpperCase();
  const labelW = labelText.length * 8 + 16;
  const labelH = 22;
  svg += `<rect x="${x}" y="${y}" width="${labelW}" height="${labelH}" fill="${colors.accent}" rx="2"/>`;
  svg += `<text x="${x + 8}" y="${y + labelH / 2}" font-family="${fonts.mono}" font-size="10" fill="${colors.bg}" dominant-baseline="central" font-weight="700" letter-spacing="0.08em">${escapeXml(labelText)}</text>`;

  // Condition text to the right of label
  if (condition) {
    svg += `<text x="${x + labelW + 10}" y="${y + labelH / 2}" font-family="${fonts.mono}" font-size="${fontSizes.edgeLabel}" fill="${colors.accent}" dominant-baseline="central" letter-spacing="0.08em">${escapeXml(condition)}</text>`;
  }

  return svg;
}

// ─── Notes ───────────────────────────────────────────────

function renderNotes(notes: LayoutNote[]): string {
  let svg = '';
  for (const note of notes) {
    svg += `<rect x="${note.x}" y="${note.y}" width="${note.w}" height="${note.h}" rx="4" fill="${colors.cardBg}" stroke="${colors.cardBorder}" stroke-width="1"/>`;
    svg += `<text x="${note.x + note.w / 2}" y="${note.y + note.h / 2}" font-family="${fonts.mono}" font-size="${fontSizes.edgeLabel}" fill="${colors.white}" text-anchor="middle" dominant-baseline="central">${escapeXml(note.text)}</text>`;
  }
  return svg;
}

// ─── Title ───────────────────────────────────────────────

function renderTitle(title: string): string {
  return `<text x="30" y="34" font-family="${fonts.sans}" font-size="${fontSizes.title}" fill="${colors.white}" font-weight="600">${escapeXml(title)}</text>`;
}

// ─── Main render function ────────────────────────────────

export function renderSequence(layout: SequenceLayout): string {
  let svg = '';

  // Title
  if (layout.title) {
    svg += renderTitle(layout.title);
  }

  // Lifelines (behind everything)
  svg += `<g class="lifelines">`;
  svg += renderLifelines(layout.participants, layout.lifelineTop, layout.lifelineBottom);
  svg += '</g>';

  // Combined fragments
  svg += `<g class="fragments">`;
  svg += renderFragments(layout.fragments);
  svg += '</g>';

  // Messages
  svg += `<g class="messages">`;
  svg += renderMessages(layout.messages);
  svg += '</g>';

  // Notes
  svg += `<g class="notes">`;
  svg += renderNotes(layout.notes);
  svg += '</g>';

  // Participant headers (on top of everything)
  svg += `<g class="participants">`;
  svg += renderParticipants(layout.participants);
  svg += '</g>';

  return svg;
}
