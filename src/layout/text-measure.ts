// Server-side text measurement using character width lookup tables
// Uses average character widths for JetBrains Mono and Inter at various sizes
// Can be refined with opentype.js later for pixel-perfect accuracy

/** Average character width as a fraction of font size */
const CHAR_WIDTH_RATIO = {
  mono: 0.6,   // JetBrains Mono: all chars are equal width
  sans: 0.48,  // Inter: average across latin glyphs
} as const;

/** Per-character width overrides for sans-serif (relative to font size) */
const SANS_CHAR_WIDTHS: Record<string, number> = {
  'i': 0.25, 'l': 0.25, 'I': 0.28, '1': 0.42,
  'j': 0.28, 'f': 0.30, 'r': 0.32, 't': 0.32,
  ' ': 0.27, '.': 0.25, ',': 0.25, ':': 0.25, ';': 0.25,
  'm': 0.72, 'w': 0.68, 'M': 0.72, 'W': 0.72,
  'A': 0.58, 'B': 0.55, 'C': 0.56, 'D': 0.60, 'E': 0.50,
  'F': 0.48, 'G': 0.60, 'H': 0.60, 'J': 0.42, 'K': 0.56,
  'L': 0.48, 'N': 0.60, 'O': 0.62, 'P': 0.52, 'Q': 0.62,
  'R': 0.55, 'S': 0.50, 'T': 0.52, 'U': 0.58, 'V': 0.56,
  'X': 0.54, 'Y': 0.52, 'Z': 0.52,
};

export type FontFamily = 'mono' | 'sans';

export interface TextMetrics {
  width: number;
  height: number;
  lineHeight: number;
  lines: string[];
}

/** Measure width of a single line of text */
export function measureLineWidth(text: string, fontSize: number, font: FontFamily = 'mono'): number {
  if (font === 'mono') {
    return text.length * fontSize * CHAR_WIDTH_RATIO.mono;
  }
  // Sans-serif: use per-character widths where available
  let width = 0;
  for (const ch of text) {
    const cw = SANS_CHAR_WIDTHS[ch] ?? CHAR_WIDTH_RATIO.sans;
    width += fontSize * cw;
  }
  return width;
}

/** Measure text that may contain newlines */
export function measureText(
  text: string,
  fontSize: number,
  font: FontFamily = 'mono',
  lineHeightMultiplier = 1.5
): TextMetrics {
  const lines = text.split('\n');
  const lineHeight = fontSize * lineHeightMultiplier;
  const maxWidth = Math.max(...lines.map(l => measureLineWidth(l, fontSize, font)));
  return {
    width: maxWidth,
    height: lines.length * lineHeight,
    lineHeight,
    lines,
  };
}

/** Word-wrap a label into lines of at most maxChars characters.
 *  Preserves explicit newlines (\n) — each newline-separated segment
 *  is wrapped independently. */
export function wrapLabel(label: string, maxChars: number): string[] {
  // Split on explicit newlines first
  const segments = label.split('\n');
  const lines: string[] = [];
  for (const segment of segments) {
    if (segment.length <= maxChars) {
      lines.push(segment);
      continue;
    }
    const words = segment.split(/\s+/);
    let cur = '';
    for (const word of words) {
      if (cur && (cur + ' ' + word).length > maxChars) {
        lines.push(cur);
        cur = word;
      } else {
        cur = cur ? cur + ' ' + word : word;
      }
    }
    if (cur) lines.push(cur);
  }
  return lines.length > 0 ? lines : [label];
}

/** Compute required node dimensions for a label with padding */
export function nodeSizeForLabel(
  label: string,
  fontSize: number,
  font: FontFamily = 'mono',
  padX = 24,
  padY = 14,
  letterSpacingEm = 0.12
): { w: number; h: number } {
  const metrics = measureText(label, fontSize, font);
  // Account for letter-spacing: adds (letterSpacingEm * fontSize) per character
  const extraWidth = label.length * letterSpacingEm * fontSize;
  return {
    w: Math.ceil(metrics.width + extraWidth + padX * 2),
    h: Math.ceil(metrics.height + padY * 2),
  };
}
