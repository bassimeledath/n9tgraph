// Main render dispatcher — AST → SVG string
import type { DiagramAST, SequenceDiagram, FlowDiagram, CardDiagram } from '../parser/ast.js';
import { colors, buildColors } from './theme.js';
import type { Colors } from './theme.js';
import { allDefs } from './patterns.js';
import { layoutSequence } from '../layout/sequence-layout.js';
import { renderSequence } from './sequence-renderer.js';
import type { FlowLayout } from '../layout/flow-layout.js';
import { layoutFlow } from '../layout/flow-layout.js';
import { renderFlow } from './flow-renderer.js';
import { layoutCard } from '../layout/card-layout.js';
import { renderCardDiagram } from './card-renderer.js';
import type { AsciiGuidedInput } from '../layout/ascii-layout.js';
import { layoutFromGrid } from '../layout/ascii-layout.js';

export function render(ast: DiagramAST): string {
  switch (ast.type) {
    case 'sequence':
      return renderSequenceDiagram(ast);
    case 'flow':
      return renderFlowDiagram(ast);
    case 'card':
      return renderCardDiagramSvg(ast);
    default:
      throw new Error(`Unknown diagram type: ${(ast as any).type}`);
  }
}

function renderSequenceDiagram(diagram: SequenceDiagram): string {
  const layout = layoutSequence(diagram);
  const content = renderSequence(layout);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}">
${allDefs()}
<rect width="100%" height="100%" fill="${colors.bg}"/>
<g class="diagram">
${content}
</g>
</svg>`;
}

function applyWhiteTheme(svg: string, palette: Colors): string {
  // Two-phase replacement to avoid circular color conflicts
  // Phase 1: existing colors → placeholders
  svg = svg
    .replace(new RegExp(escapeForRegex(palette.bg), 'g'), '\x00BG\x00')
    .replace(new RegExp(escapeForRegex(palette.white), 'g'), '\x00WH\x00')
    .replace(new RegExp(escapeForRegex(palette.accent), 'g'), '\x00AC\x00')
    .replace(new RegExp(escapeForRegex(palette.accentDim), 'g'), '\x00AD\x00')
    .replace(new RegExp(escapeForRegex(palette.heroFill), 'g'), '\x00HF\x00')
    .replace(new RegExp(escapeForRegex(palette.heroDot), 'g'), '\x00HD\x00')
    .replace(new RegExp(escapeForRegex(palette.cardBg), 'g'), '\x00CB\x00')
    .replace(new RegExp(escapeForRegex(palette.cardBorder), 'g'), '\x00CR\x00')
    .replace(new RegExp(escapeForRegex(palette.gray), 'g'), '\x00GR\x00')
    .replace(new RegExp(escapeForRegex(palette.dimGray), 'g'), '\x00DG\x00');
  // Phase 2: placeholders → white-theme colors
  svg = svg
    .replace(/\x00BG\x00/g, '#ffffff')       // bg → white
    .replace(/\x00WH\x00/g, '#222222')       // white text → near-black
    .replace(/\x00AC\x00/g, '#1a7a1a')       // accent → dark green (readable on white)
    .replace(/\x00AD\x00/g, '#4a8a4a')       // accentDim → medium green
    .replace(/\x00HF\x00/g, '#d4ecd4')       // heroFill → light green bg
    .replace(/\x00HD\x00/g, '#b0d8b0')       // heroDot → lighter green
    .replace(/\x00CB\x00/g, '#f5f5f5')       // cardBg → off-white
    .replace(/\x00CR\x00/g, '#dddddd')       // cardBorder → light gray
    .replace(/\x00GR\x00/g, '#666666')       // gray → darker for contrast
    .replace(/\x00DG\x00/g, '#999999');       // dimGray → medium gray
  return svg;
}

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderFlowDiagram(diagram: FlowDiagram): string {
  const layout = layoutFlow(diagram);
  const content = renderFlow(layout);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}">
${allDefs()}
<rect width="100%" height="100%" fill="${colors.bg}"/>
<g class="diagram">
${content}
</g>
</svg>`;

  if (diagram.theme === 'white') {
    svg = applyWhiteTheme(svg, colors);
  }

  return svg;
}

function renderCardDiagramSvg(diagram: CardDiagram): string {
  const layout = layoutCard(diagram);
  const content = renderCardDiagram(layout);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}">
${allDefs()}
<rect width="100%" height="100%" fill="${colors.bg}"/>
<g class="diagram">
${content}
</g>
</svg>`;
}

export function renderFromGrid(input: AsciiGuidedInput, precomputedLayout?: FlowLayout): string {
  const accentColor = (input as any).accentColor as string | undefined;
  const palette = buildColors(accentColor);

  // Temporarily swap the global colors for render
  const prev = Object.assign({}, colors);
  Object.assign(colors, palette);
  try {
    const layout = precomputedLayout ?? layoutFromGrid(input);
    const content = renderFlow(layout);

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}">
${allDefs()}
<rect width="100%" height="100%" fill="${palette.bg}"/>
<g class="diagram">
${content}
</g>
</svg>`;

    if (input.diagram.theme === 'white') {
      svg = applyWhiteTheme(svg, palette);
    }

    return svg;
  } finally {
    Object.assign(colors, prev);
  }
}
