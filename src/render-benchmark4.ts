// Renders all .n9 files in examples/benchmark4/ to SVG and PNG
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { parse } from './parser/parser.js';
import { render } from './render/svg.js';

const BENCHMARK_DIR = join(import.meta.dirname ?? '.', '..', 'examples', 'benchmark4');
const OUTPUT_DIR = join(BENCHMARK_DIR, 'output');
const DOWNLOADS_DIR = join(process.env.HOME ?? '~', 'Downloads', 'n9tgraph-iterations', 'iter4b-text-in-node');

mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(DOWNLOADS_DIR, { recursive: true });

const files = readdirSync(BENCHMARK_DIR).filter(f => f.endsWith('.n9'));

const results: { file: string; success: boolean; error?: string }[] = [];

for (const file of files) {
  const name = basename(file, '.n9');
  const input = readFileSync(join(BENCHMARK_DIR, file), 'utf-8');

  console.log(`Rendering ${file}...`);

  try {
    const ast = parse(input);
    const svg = render(ast);

    // Write SVG
    const svgPath = join(OUTPUT_DIR, `${name}.svg`);
    writeFileSync(svgPath, svg);
    console.log(`  → ${svgPath}`);

    // Detect white theme for background color
    const isWhiteTheme = /^theme\s+white/m.test(input);
    const background = isWhiteTheme ? '#ffffff' : '#000000';

    // Convert to PNG — dynamic width to keep text readable
    const viewBoxMatch = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
    const svgWidth = viewBoxMatch ? parseFloat(viewBoxMatch[1]) : 800;
    const pngWidth = Math.max(800, Math.round(svgWidth * 0.85));
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: pngWidth },
      background,
    });
    const pngData = resvg.render();
    const pngPath = join(OUTPUT_DIR, `${name}.png`);
    writeFileSync(pngPath, pngData.asPng());
    console.log(`  → ${pngPath}`);

    // Copy to ~/Downloads
    const dlPath = join(DOWNLOADS_DIR, `${name}.png`);
    copyFileSync(pngPath, dlPath);
    console.log(`  → ${dlPath}`);

    results.push({ file, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ Error rendering ${file}: ${msg}`);
    results.push({ file, success: false, error: msg });
  }
}

console.log(`\nDone. ${results.filter(r => r.success).length}/${results.length} succeeded.`);
