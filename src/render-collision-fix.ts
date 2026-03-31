// Render specific examples to verify collision fix
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { parse } from './parser/parser.js';
import { render } from './render/svg.js';

const OUTPUT_DIR = '/Users/bassime/Downloads/n9tgraph-collision-fix';
mkdirSync(OUTPUT_DIR, { recursive: true });

const EXAMPLES = [
  'examples/observability-stack.n9',
  'examples/payment-flow.n9',
  'examples/event-driven-system.n9',
  'examples/gallery/04-service-mesh.n9',
  'examples/gallery/16-event-sourcing.n9',
  'examples/gallery/20-saas-platform.n9',
];

for (const file of EXAMPLES) {
  const name = basename(file, '.n9');
  const input = readFileSync(join(import.meta.dirname ?? '.', '..', file), 'utf-8');

  console.log(`Rendering ${file}...`);

  try {
    const ast = parse(input);
    const svg = render(ast);

    writeFileSync(join(OUTPUT_DIR, `${name}.svg`), svg);

    const viewBoxMatch = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
    const svgWidth = viewBoxMatch ? parseFloat(viewBoxMatch[1]) : 800;
    const isWhiteTheme = /^theme\s+white/m.test(input);
    const background = isWhiteTheme ? '#ffffff' : '#000000';
    const pngWidth = Math.max(800, Math.round(svgWidth * 0.85));
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width' as const, value: pngWidth },
      background,
    });
    const pngData = resvg.render();
    writeFileSync(join(OUTPUT_DIR, `${name}.png`), pngData.asPng());
    console.log(`  ✓ ${name}.svg + .png`);
  } catch (err) {
    console.error(`  ✗ Error rendering ${file}:`, err);
  }
}

console.log(`\nDone. Output: ${OUTPUT_DIR}`);
