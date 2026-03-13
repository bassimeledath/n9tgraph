// Hand-authored SVG icons for n9tgraph — 24x24 viewbox, 1.5px stroke, no fill
import { colors, stroke as themeStroke } from './theme.js';

const sw = themeStroke.icon;
const sc = colors.accent;

type IconFn = (color?: string) => string;

/** Document / file icon */
export const doc: IconFn = (c = sc) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>`;

/** Person icon */
export const person: IconFn = (c = sc) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0113 0"/></svg>`;

/** Brain icon */
export const brain: IconFn = (c = sc) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 014.8 3.6A4 4 0 0120 9.5a4 4 0 01-1.5 7.8A5 5 0 0112 22a5 5 0 01-6.5-4.7A4 4 0 014 9.5a4 4 0 013.2-3.9A5 5 0 0112 2z"/><path d="M12 2v20"/><path d="M8 8h8"/><path d="M7 13h10"/></svg>`;

/** Target / crosshair icon */
export const target: IconFn = (c = sc) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`;

/** Chain broken / unlink icon */
export const chainBroken: IconFn = (c = sc) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.5.5l2-2a5 5 0 00-7-7l-1 1"/><path d="M14 11a5 5 0 00-7.5-.5l-2 2a5 5 0 007 7l1-1"/><line x1="18" y1="2" x2="22" y2="6"/><line x1="2" y1="18" x2="6" y2="22"/></svg>`;

/** Eye icon */
export const eye: IconFn = (c = sc) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

/** Gear / settings icon */
export const gear: IconFn = (c = sc) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H10a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001.08 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V10c.26.6.77 1.02 1.51 1.08H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1.08z"/></svg>`;

/** Code / brackets icon */
export const code: IconFn = (c = sc) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><line x1="14" y1="4" x2="10" y2="20"/></svg>`;

/** Database icon */
export const database: IconFn = (c = sc) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`;

/** Cloud icon */
export const cloud: IconFn = (c = sc) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg>`;

/** Lock icon */
export const lock: IconFn = (c = sc) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`;

/** Arrow loop / refresh icon */
export const arrowLoop: IconFn = (c = sc) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10"/><path d="M20.49 15a9 9 0 01-14.85 3.36L1 14"/></svg>`;

/** Registry of all icons by name */
export const iconMap: Record<string, IconFn> = {
  doc,
  person,
  brain,
  target,
  'chain-broken': chainBroken,
  eye,
  gear,
  code,
  database,
  cloud,
  lock,
  'arrow-loop': arrowLoop,
};

/** Render icon by name with optional color override */
export function renderIcon(name: string, color?: string): string {
  const fn = iconMap[name];
  if (!fn) return '';
  return fn(color);
}

/** List all available icon names */
export const iconNames = Object.keys(iconMap);
