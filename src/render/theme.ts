// n9tgraph theme constants — opinionated dark-mode visual style

// ─── HSL helpers for accent derivation ──────────────────

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else              { r = c; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export type Colors = typeof defaultColors;

const defaultColors = {
  bg: '#000000',
  accent: '#b4f079',
  accentDim: '#7aa84f',
  heroFill: '#3d6b23',
  heroDot: '#5a9a35',
  nodeBorder: '#b4f079',
  nodeFill: 'transparent',
  cardBg: '#111111',
  cardBorder: '#333333',
  cardText: '#ffffff',
  white: '#ffffff',
  gray: '#888888',
  dimGray: '#555555',
  annotationColor: '#b4f079',
  edgeDim: '#7aa84f',
  edgeMuted: '#555555',
  subgraphLabelBg: '#000000',
  subgraphLabelText: '#ffffff',
  subgraphBadgeFill: '#b4f079',
  subgraphBadgeText: '#000000',
};

/** Build a color palette, optionally overriding the accent color. */
export function buildColors(accent?: string): Colors {
  if (!accent) return defaultColors;
  const [h, s, l] = hexToHsl(accent);
  return {
    ...defaultColors,
    accent,
    accentDim: hslToHex(h, s * 0.7, l * 0.65),
    heroFill: hslToHex(h, Math.min(s * 1.2, 1), l * 0.4),
    heroDot: hslToHex(h, Math.min(s * 1.1, 1), l * 0.55),
    nodeBorder: accent,
    annotationColor: accent,
    subgraphBadgeFill: accent,
    edgeDim: hslToHex(h, s * 0.7, l * 0.65),
  };
}

export let colors: Colors = defaultColors;

export const opacity = {
  crosshatch: 0.20,
  annotation: 0.6,
  dotgrid: 0.7,
  heroDot: 0.5,
  edgeLabel: 0.85,
} as const;

export const fonts = {
  mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', monospace",
  sans: "'Inter', 'Helvetica Neue', Arial, sans-serif",
} as const;

export const fontSizes = {
  nodeLabel: 13,
  edgeLabel: 12,
  annotation: 12,
  cardTitle: 13,
  cardBody: 11,
  codeBlock: 11,
  title: 15,
  subtitle: 14,
  iconLabel: 11,
} as const;

export const spacing = {
  nodePadX: 24,
  nodePadY: 14,
  doubleBorderGap: 4,
  doubleBorderOuter: 2,
  doubleBorderInner: 1,
  iconSize: 24,
  letterSpacing: '0.12em',
  lineHeight: 1.5,
  arrowSize: 8,
  borderRadius: 12,
  pillRadius: 999,
} as const;

export const stroke = {
  node: 1.5,
  nodeDouble: 2,
  nodeDoubleInner: 1,
  edge: 1.5,
  edgeDash: '6 4',
  icon: 1.5,
  actor: 1.5,
} as const;
