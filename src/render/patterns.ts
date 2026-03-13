// SVG pattern definitions for n9tgraph fill styles
import { colors, opacity } from './theme.js';

export function dotgridPattern(id = 'dotgrid'): string {
  return `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse">
    <rect width="8" height="8" fill="${colors.bg}"/>
    <circle cx="4" cy="4" r="0.8" fill="${colors.accent}" opacity="${opacity.dotgrid}"/>
  </pattern>`;
}

export function crosshatchPattern(id = 'crosshatch'): string {
  return `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse">
    <rect width="8" height="8" fill="${colors.bg}"/>
    <path d="M0 8L8 0M-1 1L1 -1M7 9L9 7" stroke="${colors.accent}" stroke-width="0.8" opacity="${opacity.crosshatch}"/>
  </pattern>`;
}

export function heroPattern(id = 'hero'): string {
  return `<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse">
    <rect width="6" height="6" fill="${colors.heroFill}"/>
    <circle cx="3" cy="3" r="0.6" fill="${colors.heroDot}" opacity="${opacity.heroDot}"/>
  </pattern>`;
}

export function arrowMarker(id = 'arrowhead'): string {
  return `<marker id="${id}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="strokeWidth">
    <polygon points="0 0, 10 3.5, 0 7" fill="${colors.accent}"/>
  </marker>`;
}

export function arrowMarkerReverse(id = 'arrowhead-reverse'): string {
  return `<marker id="${id}" markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto" markerUnits="strokeWidth">
    <polygon points="10 0, 0 3.5, 10 7" fill="${colors.accent}"/>
  </marker>`;
}

export function allDefs(): string {
  return `<defs>
  ${dotgridPattern()}
  ${crosshatchPattern()}
  ${heroPattern()}
  ${arrowMarker()}
  ${arrowMarkerReverse()}
</defs>`;
}
