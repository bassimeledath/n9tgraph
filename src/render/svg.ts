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
  return svg
    .replace(/#b4f079/g, '#ffffff')
    .replace(/#7aa84f/g, '#cccccc')
    .replace(/#3d6b23/g, '#222222')
    .replace(/#5a9a35/g, '#444444');
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
