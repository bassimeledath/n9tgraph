// Renders all .n9 files in examples/ to SVG and PNG
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { parse } from './parser/parser.js';
import { render } from './render/svg.js';

const EXAMPLES_DIR = join(import.meta.dirname ?? '.', '..', 'examples');
const OUTPUT_DIR = join(EXAMPLES_DIR, 'output');

mkdirSync(OUTPUT_DIR, { recursive: true });

const files = readdirSync(EXAMPLES_DIR).filter(f => f.endsWith('.n9'));

for (const file of files) {
  const name = basename(file, '.n9');
  const input = readFileSync(join(EXAMPLES_DIR, file), 'utf-8');

  console.log(`Rendering ${file}...`);

  try {
    const ast = parse(input);
    const svg = render(ast);

    // Write SVG
    const svgPath = join(OUTPUT_DIR, `${name}.svg`);
    writeFileSync(svgPath, svg);
    console.log(`  → ${svgPath}`);

    // Convert to PNG — dynamic width to keep text readable
    const viewBoxMatch = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
    const svgWidth = viewBoxMatch ? parseFloat(viewBoxMatch[1]) : 800;
    const isWhiteTheme = /^theme\s+white/m.test(input);
    const background = isWhiteTheme ? '#ffffff' : '#000000';
    const pngWidth = Math.max(800, Math.round(svgWidth * 0.85));
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: pngWidth },
      background,
    });
    const pngData = resvg.render();
    const pngPath = join(OUTPUT_DIR, `${name}.png`);
    writeFileSync(pngPath, pngData.asPng());
    console.log(`  → ${pngPath}`);
  } catch (err) {
    console.error(`  ✗ Error rendering ${file}:`, err);
  }
}

console.log('Done.');
