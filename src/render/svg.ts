// Main render dispatcher — AST → SVG string
import type { DiagramAST, SequenceDiagram, FlowDiagram, CardDiagram } from '../parser/ast.js';
import { colors } from './theme.js';
import { allDefs } from './patterns.js';
import { layoutSequence } from '../layout/sequence-layout.js';
import { renderSequence } from './sequence-renderer.js';
import { layoutFlow } from '../layout/flow-layout.js';
import { renderFlow } from './flow-renderer.js';
import { layoutCard } from '../layout/card-layout.js';
import { renderCardDiagram } from './card-renderer.js';

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

function applyWhiteTheme(svg: string): string {
  // Two-phase replacement to avoid circular color conflicts
  // Phase 1: existing colors → placeholders
  svg = svg
    .replace(/#000000/g, '\x00BG\x00')
    .replace(/#ffffff/g, '\x00WH\x00')
    .replace(/#b4f079/g, '\x00AC\x00')
    .replace(/#7aa84f/g, '\x00AD\x00')
    .replace(/#3d6b23/g, '\x00HF\x00')
    .replace(/#5a9a35/g, '\x00HD\x00')
    .replace(/#111111/g, '\x00CB\x00')
    .replace(/#333333/g, '\x00CR\x00')
    .replace(/#888888/g, '\x00GR\x00')
    .replace(/#555555/g, '\x00DG\x00');
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
    svg = applyWhiteTheme(svg);
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
