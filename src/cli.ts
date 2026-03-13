#!/usr/bin/env node
// n9tgraph CLI — parse .n9 files and render SVG/PNG diagrams

import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { parse } from './parser/parser.js';
import { render } from './render/svg.js';

const program = new Command();

program
  .name('n9tgraph')
  .description('A beautiful, opinionated diagramming DSL and renderer')
  .version('0.1.0')
  .argument('[input]', 'Input .n9 file (omit for stdin)')
  .option('-o, --output <file>', 'Output file (omit for stdout)')
  .option('-f, --format <fmt>', 'Output format: svg or png', 'svg')
  .option('-s, --scale <n>', 'PNG scale factor', '2')
  .option('-w, --watch', 'Watch input file for changes and re-render')
  .action(async (inputFile: string | undefined, opts: { output?: string; format: string; scale: string; watch?: boolean }) => {
    const format = opts.format.toLowerCase();
    if (format !== 'svg' && format !== 'png') {
      console.error(`Error: unsupported format "${opts.format}". Use svg or png.`);
      process.exit(1);
    }

    const scale = parseInt(opts.scale, 10);
    if (isNaN(scale) || scale < 1) {
      console.error(`Error: invalid scale "${opts.scale}". Must be a positive integer.`);
      process.exit(1);
    }

    function renderFile() {
      let source: string;
      if (inputFile) {
        source = readFileSync(resolve(inputFile), 'utf-8');
      } else {
        // Read from stdin
        source = readFileSync(0, 'utf-8');
      }

      const ast = parse(source);
      const svg = render(ast);

      if (format === 'png') {
        const resvg = new Resvg(svg, {
          fitTo: { mode: 'zoom', value: scale },
          background: '#000000',
        });
        const pngData = resvg.render().asPng();

        if (opts.output) {
          writeFileSync(resolve(opts.output), pngData);
          console.error(`Wrote ${resolve(opts.output)}`);
        } else {
          process.stdout.write(pngData);
        }
      } else {
        if (opts.output) {
          writeFileSync(resolve(opts.output), svg);
          console.error(`Wrote ${resolve(opts.output)}`);
        } else {
          process.stdout.write(svg);
        }
      }
    }

    renderFile();

    if (opts.watch && inputFile) {
      const chokidar = await import('chokidar');
      const watcher = chokidar.default.watch(resolve(inputFile), { persistent: true });
      console.error(`Watching ${inputFile} for changes...`);
      watcher.on('change', () => {
        console.error(`\n${inputFile} changed, re-rendering...`);
        try {
          renderFile();
        } catch (err) {
          console.error('Error:', err);
        }
      });
    }
  });

program.parse();
