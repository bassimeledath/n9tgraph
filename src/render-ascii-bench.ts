// Renders all JSON fixtures in bench/ascii-guided/ to SVG and PNG
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { renderFromGrid } from './render/svg.js';
import type { AsciiGuidedInput } from './layout/ascii-layout.js';

const BENCH_DIR = join(import.meta.dirname ?? '.', '..', 'bench', 'ascii-guided');
const OUTPUT_DIR = join(BENCH_DIR, 'output');
const DOWNLOADS_DIR = '/Users/bassime/Downloads/n9tgraph-ascii-baseline';

mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(DOWNLOADS_DIR, { recursive: true });

const files = readdirSync(BENCH_DIR).filter(f => f.endsWith('.json'));

for (const file of files) {
  const name = basename(file, '.json');
  const raw = readFileSync(join(BENCH_DIR, file), 'utf-8');
  const input: AsciiGuidedInput = JSON.parse(raw);

  console.log(`Rendering ${file}...`);

  const svg = renderFromGrid(input);

  // Write SVG
  const svgPath = join(OUTPUT_DIR, `${name}.svg`);
  writeFileSync(svgPath, svg);
  console.log(`  → ${svgPath}`);

  // Convert to PNG
  const isWhiteTheme = input.diagram.theme === 'white';
  const background = isWhiteTheme ? '#ffffff' : '#000000';
  const viewBoxMatch = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  const svgWidth = viewBoxMatch ? parseFloat(viewBoxMatch[1]) : 800;
  const pngWidth = Math.max(800, Math.round(svgWidth * 0.75)) * 2;
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: pngWidth },
    background,
  });
  const pngData = resvg.render();
  const pngPath = join(OUTPUT_DIR, `${name}.png`);
  writeFileSync(pngPath, pngData.asPng());
  console.log(`  → ${pngPath}`);

  // Copy PNG to Downloads
  const dlPath = join(DOWNLOADS_DIR, `${name}.png`);
  copyFileSync(pngPath, dlPath);
  console.log(`  → ${dlPath}`);
}

console.log(`\nDone: ${files.length} fixtures rendered.`);
