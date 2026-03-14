// n9tgraph theme constants — opinionated dark-mode visual style

export const colors = {
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
} as const;

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
  iconLabel: 10,
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
