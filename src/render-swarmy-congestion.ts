// Renders hub-congestion-prone examples to PNG for swarmy evaluation
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { parse } from './parser/parser.js';
import { render } from './render/svg.js';

const OUTPUT_DIR = process.argv[2] || join(process.env.HOME ?? '~', 'Downloads', 'n9tgraph-swarmy-congestion', 'baseline');
mkdirSync(OUTPUT_DIR, { recursive: true });

const EXAMPLES = [
  'examples/payment-flow.n9',
  'examples/observability-stack.n9',
  'examples/event-driven-system.n9',
  'examples/benchmark3/hub-spoke-api-gateway.n9',
  'examples/gen-test/wide-fanout.n9',
  'examples/gen-test/bidirectional-dense.n9',
  'examples/gen-test/dense-graph.n9',
];

const ROOT = join(import.meta.dirname ?? '.', '..');

for (const rel of EXAMPLES) {
  const file = join(ROOT, rel);
  const name = basename(rel, '.n9');
  const input = readFileSync(file, 'utf-8');
  console.log(`Rendering ${name}...`);
  try {
    const ast = parse(input);
    const svg = render(ast);
    const isWhiteTheme = /^theme\s+white/m.test(input);
    const background = isWhiteTheme ? '#ffffff' : '#000000';
    const viewBoxMatch = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
    const svgWidth = viewBoxMatch ? parseFloat(viewBoxMatch[1]) : 800;
    const pngWidth = Math.max(800, Math.round(svgWidth * 0.75));
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: pngWidth }, background });
    const pngData = resvg.render();
    const pngPath = join(OUTPUT_DIR, `${name}.png`);
    writeFileSync(pngPath, pngData.asPng());
    console.log(`  → ${pngPath}`);
  } catch (err) {
    console.error(`  ✗ ${name}: ${err instanceof Error ? err.message : err}`);
  }
}
console.log('Done.');
