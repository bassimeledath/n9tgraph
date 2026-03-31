import { renderFromGrid } from '../src/render/svg.js';
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'fs';
import type { AsciiGuidedInput } from '../src/layout/ascii-layout.js';

function renderToFile(input: AsciiGuidedInput, outPath: string) {
  const svg = renderFromGrid(input);
  const svgWidth = Number(svg.match(/width="(\d+)"/)?.[1] || 800);
  const isWhite = input.diagram.theme === 'white';
  const scale = 2;
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: Math.max(800, Math.round(svgWidth * 0.75)) * scale },
    background: isWhite ? '#ffffff' : '#000000',
  });
  writeFileSync(outPath, resvg.render().asPng());
  console.log(`Wrote ${outPath}`);
}

const baseDiagram = {
  direction: 'LR' as const,
  boxes: [
    { id: 'client', label: 'Client', kind: 'actor' as const },
    { id: 'gw', label: 'API Gateway', kind: 'service' as const, properties: { fill: 'hero' as const } },
    { id: 'auth', label: 'Auth Service', kind: 'component' as const, properties: { fill: 'dotgrid' as const } },
    { id: 'db', label: 'Users DB', kind: 'datastore' as const },
  ],
  grid: [['client'], ['gw'], ['auth'], ['db']] as (string | null)[][],
  connectors: [
    { from: 'client', to: 'gw', label: 'request' },
    { from: 'gw', to: 'auth', label: 'validate' },
    { from: 'auth', to: 'db', label: 'lookup' },
  ],
};

// White theme version
renderToFile(
  { diagram: { ...baseDiagram, theme: 'white' } },
  'examples/output/simple-api-white.png',
);

// Custom accent color version (dark theme)
renderToFile(
  { accentColor: '#38bdf8', diagram: { ...baseDiagram } },
  'examples/output/simple-api-accent.png',
);
