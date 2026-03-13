// Main render dispatcher — AST → SVG string
import type { DiagramAST, SequenceDiagram, FlowDiagram } from '../parser/ast.js';
import { colors } from './theme.js';
import { allDefs } from './patterns.js';
import { layoutSequence } from '../layout/sequence-layout.js';
import { renderSequence } from './sequence-renderer.js';
import { layoutFlow } from '../layout/flow-layout.js';
import { renderFlow } from './flow-renderer.js';

export function render(ast: DiagramAST): string {
  switch (ast.type) {
    case 'sequence':
      return renderSequenceDiagram(ast);
    case 'flow':
      return renderFlowDiagram(ast);
    case 'card':
      throw new Error('Card diagrams not yet implemented');
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

function renderFlowDiagram(diagram: FlowDiagram): string {
  const layout = layoutFlow(diagram);
  const content = renderFlow(layout);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}">
${allDefs()}
<rect width="100%" height="100%" fill="${colors.bg}"/>
<g class="diagram">
${content}
</g>
</svg>`;
}
