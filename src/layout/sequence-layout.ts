// Grid-based layout engine for sequence diagrams
import type { SequenceDiagram, SequenceElement, Message, CombinedFragment, Note } from '../parser/ast.js';
import { nodeSizeForLabel, measureLineWidth } from './text-measure.js';
import { fontSizes, spacing } from '../render/theme.js';

// ─── Layout output types ─────────────────────────────────

export interface LayoutParticipant {
  id: string;
  label: string;
  fill: string;
  x: number;          // center x of participant column
  topY: number;       // top of top header box
  topBox: { x: number; y: number; w: number; h: number };
  bottomBox: { x: number; y: number; w: number; h: number };
}

export interface LayoutMessage {
  fromX: number;
  toX: number;
  y: number;
  label: string;
  arrow: string;
  isSelf: boolean;
  annotation?: string;
}

export interface LayoutFragment {
  kind: string;
  condition?: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutNote {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
}

export interface SequenceLayout {
  width: number;
  height: number;
  title?: string;
  participants: LayoutParticipant[];
  messages: LayoutMessage[];
  fragments: LayoutFragment[];
  notes: LayoutNote[];
  lifelineTop: number;
  lifelineBottom: number;
}

// ─── Layout constants ────────────────────────────────────

const MARGIN_X = 32;
const MARGIN_TOP = 18;
const TITLE_HEIGHT = 32;
const PARTICIPANT_GAP = 105;       // horizontal distance between participant centers
const MESSAGE_STEP = 34;           // vertical step per message
const FRAGMENT_PAD_X = 14;         // horizontal padding inside fragment
const FRAGMENT_PAD_TOP = 22;       // space above first child in fragment
const FRAGMENT_PAD_BOTTOM = 12;    // space below last child in fragment
const SELF_MESSAGE_WIDTH = 32;     // width of self-message loop
const ANNOTATION_OFFSET = 6;      // vertical offset for annotation below message
const HEADER_PAD_X = 16;
const HEADER_PAD_Y = 10;
const BOTTOM_HEADER_GAP = 18;     // gap between last element and bottom headers

// ─── Layout engine ───────────────────────────────────────

export function layoutSequence(diagram: SequenceDiagram): SequenceLayout {
  const participants = diagram.participants;
  const elements = diagram.elements;

  // Compute participant header sizes
  const headerSizes = participants.map(p => {
    const size = nodeSizeForLabel(p.label, fontSizes.nodeLabel, 'mono', HEADER_PAD_X, HEADER_PAD_Y, 0.12);
    return { w: Math.max(size.w, 80), h: Math.max(size.h, 42) };
  });

  // Participant x-positions (evenly spaced)
  const startX = MARGIN_X + Math.max(...headerSizes.map(s => s.w)) / 2;
  const participantXs = participants.map((_, i) => startX + i * PARTICIPANT_GAP);

  // Map participant IDs to x positions
  const idToX = new Map<string, number>();
  participants.forEach((p, i) => { idToX.set(p.id, participantXs[i]); });

  // Top header y
  const titleOffset = diagram.title ? TITLE_HEIGHT : 0;
  const headerY = MARGIN_TOP + titleOffset;
  const maxHeaderH = Math.max(...headerSizes.map(s => s.h));

  // Lifeline starts below headers
  const lifelineTop = headerY + maxHeaderH;

  // Layout elements top-to-bottom
  let cursorY = lifelineTop + 24; // initial gap after headers
  const layoutMessages: LayoutMessage[] = [];
  const layoutFragments: LayoutFragment[] = [];
  const layoutNotes: LayoutNote[] = [];

  function layoutElements(elems: SequenceElement[]): void {
    for (const elem of elems) {
      switch (elem.type) {
        case 'message':
          layoutMessage(elem);
          break;
        case 'fragment':
          layoutFragment(elem);
          break;
        case 'note':
          layoutNoteElem(elem);
          break;
      }
    }
  }

  function layoutMessage(msg: Message): void {
    const fromX = idToX.get(msg.from) ?? participantXs[0];
    const toX = idToX.get(msg.to) ?? participantXs[participantXs.length - 1];
    const isSelf = msg.from === msg.to;
    const hasLabel = msg.label && msg.label.trim().length > 0;

    layoutMessages.push({
      fromX,
      toX: isSelf ? fromX + SELF_MESSAGE_WIDTH : toX,
      y: cursorY,
      label: msg.label,
      arrow: msg.arrow,
      isSelf,
      annotation: msg.annotation,
    });

    if (!hasLabel && msg.annotation) {
      // Annotation-only: reduced vertical step
      cursorY += 26;
    } else {
      cursorY += MESSAGE_STEP;
      if (msg.annotation) {
        cursorY += ANNOTATION_OFFSET;
      }
    }
    if (isSelf) {
      cursorY += 20;
    }
  }

  function layoutFragment(frag: CombinedFragment): void {
    const fragStartY = cursorY - 10;
    cursorY += FRAGMENT_PAD_TOP;

    layoutElements(frag.children);

    const fragEndY = cursorY + FRAGMENT_PAD_BOTTOM;

    // Fragment spans all participant columns
    const minX = Math.min(...participantXs) - PARTICIPANT_GAP / 2 + FRAGMENT_PAD_X;
    const maxX = Math.max(...participantXs) + PARTICIPANT_GAP / 2 - FRAGMENT_PAD_X;

    layoutFragments.push({
      kind: frag.kind,
      condition: frag.condition,
      x: minX,
      y: fragStartY,
      w: maxX - minX,
      h: fragEndY - fragStartY,
    });

    cursorY = fragEndY + 10;
  }

  function layoutNoteElem(note: Note): void {
    const xs = note.over.map(id => idToX.get(id) ?? participantXs[0]);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;

    // Split on literal \n for multi-line notes, strip **bold** for measurement
    const lines = note.text.split('\\n');
    let maxLineW = 0;
    for (const line of lines) {
      const stripped = line.replace(/\*\*(.+?)\*\*/g, '$1').trim();
      maxLineW = Math.max(maxLineW, measureLineWidth(stripped, fontSizes.edgeLabel, 'mono'));
    }

    const w = maxLineW + 24;
    const lineH = 16;
    const h = lines.length > 1 ? lines.length * lineH + 20 : 32;

    // Clamp x so note doesn't extend past left canvas edge
    const rawX = centerX - w / 2;
    const x = Math.max(8, rawX);

    layoutNotes.push({
      x,
      y: cursorY - 10,
      w,
      h,
      text: note.text,
    });

    cursorY += h + 12;
  }

  layoutElements(elements);

  // Bottom headers
  const lifelineBottom = cursorY + BOTTOM_HEADER_GAP;
  const bottomHeaderY = lifelineBottom;

  // Build layout participants
  const layoutParticipants: LayoutParticipant[] = participants.map((p, i) => {
    const size = headerSizes[i];
    const cx = participantXs[i];
    return {
      id: p.id,
      label: p.label,
      fill: p.properties.fill || 'none',
      x: cx,
      topY: headerY,
      topBox: {
        x: cx - size.w / 2,
        y: headerY,
        w: size.w,
        h: size.h,
      },
      bottomBox: {
        x: cx - size.w / 2,
        y: bottomHeaderY,
        w: size.w,
        h: size.h,
      },
    };
  });

  // Compute annotation overhang
  const maxAnnotationWidth = layoutMessages.reduce((max, msg) => {
    if (!msg.annotation) return max;
    const annW = measureLineWidth(msg.annotation, 12, 'sans');
    return Math.max(max, annW);
  }, 0);

  // Total dimensions
  const rightEdge = Math.max(
    ...participantXs.map((x, i) => x + headerSizes[i].w / 2)
  );
  let totalWidth = rightEdge + Math.max(MARGIN_X, maxAnnotationWidth + 30);
  // Ensure width covers title text (bold font needs extra margin)
  if (diagram.title) {
    const titleW = measureLineWidth(diagram.title, fontSizes.title, 'sans') + 140;
    totalWidth = Math.max(totalWidth, titleW);
  }
  // Ensure width covers notes that may have been shifted right
  for (const note of layoutNotes) {
    totalWidth = Math.max(totalWidth, note.x + note.w + MARGIN_X);
  }
  const totalHeight = bottomHeaderY + maxHeaderH + MARGIN_TOP;

  return {
    width: totalWidth,
    height: totalHeight,
    title: diagram.title,
    participants: layoutParticipants,
    messages: layoutMessages,
    fragments: layoutFragments,
    notes: layoutNotes,
    lifelineTop,
    lifelineBottom,
  };
}
