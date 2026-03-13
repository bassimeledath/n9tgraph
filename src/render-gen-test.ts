// Renders all .n9 files in examples/gen-test/ to SVG and PNG
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { parse } from './parser/parser.js';
import { render } from './render/svg.js';

const GEN_TEST_DIR = join(import.meta.dirname ?? '.', '..', 'examples', 'gen-test');
const OUTPUT_DIR = join(GEN_TEST_DIR, 'output');

mkdirSync(OUTPUT_DIR, { recursive: true });

const files = readdirSync(GEN_TEST_DIR).filter(f => f.endsWith('.n9'));

const results: { file: string; success: boolean; error?: string }[] = [];

for (const file of files) {
  const name = basename(file, '.n9');
  const input = readFileSync(join(GEN_TEST_DIR, file), 'utf-8');

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

    // Convert to PNG
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: 800 },
      background,
    });
    const pngData = resvg.render();
    const pngPath = join(OUTPUT_DIR, `${name}.png`);
    writeFileSync(pngPath, pngData.asPng());
    console.log(`  → ${pngPath}`);

    results.push({ file, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ Error rendering ${file}: ${msg}`);
    results.push({ file, success: false, error: msg });
  }
}

console.log(`\nDone. ${results.filter(r => r.success).length}/${results.length} succeeded.`);
