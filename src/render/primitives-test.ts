// Visual test harness — renders ALL n9tgraph primitives into a single SVG
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { colors, fonts, fontSizes } from './theme.js';
import { allDefs } from './patterns.js';
import { rect, pill, cylinder, doubleBorder, actor, annotation, card, codeBlock } from './shapes.js';
import { iconNames, renderIcon } from './icons.js';
import { straightEdge, polylineEdge, edgeLabel, numberedCircle } from './edges.js';

const W = 1200;
const H = 1500;

function sectionTitle(x: number, y: number, text: string): string {
  return `<text x="${x}" y="${y}" font-family="${fonts.sans}" font-size="${fontSizes.title}" fill="${colors.white}" font-weight="700">${text}</text>`;
}

function buildSvg(): string {
  const parts: string[] = [];

  // ── Section 1: Nodes with pattern fills ──────────────────────
  let sy = 50;
  parts.push(sectionTitle(40, sy, 'Nodes with Pattern Fills'));
  sy += 30;

  // Hero node (double-border with hero fill)
  parts.push(doubleBorder({ x: 40, y: sy, w: 180, h: 56, label: 'RESPONSES API', fill: 'url(#hero)' }));
  // Dotgrid node
  parts.push(doubleBorder({ x: 260, y: sy, w: 140, h: 56, label: 'MODELS', fill: 'url(#dotgrid)' }));
  // Crosshatch node
  parts.push(doubleBorder({ x: 440, y: sy, w: 160, h: 56, label: 'CONTAINER', fill: 'url(#crosshatch)' }));
  // Plain rect
  parts.push(rect({ x: 640, y: sy, w: 140, h: 56, label: 'SHELL' }));

  // ── Section 2: Shape variants ────────────────────────────────
  sy += 100;
  parts.push(sectionTitle(40, sy, 'Shape Variants'));
  sy += 30;

  // Standard rect
  parts.push(rect({ x: 40, y: sy, w: 140, h: 50, label: 'RECT NODE' }));
  // Pill
  parts.push(pill({ x: 220, y: sy, w: 160, h: 50, label: 'PILL NODE' }));
  // Cylinder
  parts.push(cylinder({ x: 420, y: sy, w: 130, h: 60, label: 'DATABASE' }));
  // Double border (no fill)
  parts.push(doubleBorder({ x: 590, y: sy, w: 160, h: 56, label: 'DOUBLE' }));
  // Actor
  parts.push(actor({ x: 830, y: sy + 10, label: 'USER' }));

  // ── Section 3: Edge types ────────────────────────────────────
  sy += 120;
  parts.push(sectionTitle(40, sy, 'Edge Types'));
  sy += 30;

  // Straight arrow
  parts.push(straightEdge({ from: { x: 40, y: sy + 20 }, to: { x: 200, y: sy + 20 }, label: 'straight' }));
  // Dashed arrow
  parts.push(straightEdge({ from: { x: 240, y: sy + 20 }, to: { x: 400, y: sy + 20 }, label: 'dashed', dashed: true }));
  // Polyline / orthogonal
  parts.push(polylineEdge({
    from: { x: 440, y: sy + 20 },
    to: { x: 640, y: sy + 60 },
    waypoints: [{ x: 540, y: sy + 20 }, { x: 540, y: sy + 60 }],
    label: 'orthogonal',
  }));
  // Numbered circle
  parts.push(numberedCircle(700, sy + 20, 1));
  parts.push(numberedCircle(740, sy + 20, 2));
  parts.push(numberedCircle(780, sy + 20, 3));

  // Edge with label only
  parts.push(edgeLabel(900, sy + 20, 'EDGE LABEL'));

  // ── Section 4: Icons ─────────────────────────────────────────
  sy += 110;
  parts.push(sectionTitle(40, sy, 'Icons (24x24, 1.5px stroke)'));
  sy += 30;

  const cols = 6;
  iconNames.forEach((name, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ix = 50 + col * 160;
    const iy = sy + row * 60;
    parts.push(`<g transform="translate(${ix}, ${iy})">${renderIcon(name)}</g>`);
    parts.push(`<text x="${ix + 32}" y="${iy + 16}" font-family="${fonts.mono}" font-size="${fontSizes.iconLabel}" fill="${colors.accent}" opacity="0.7">${name}</text>`);
  });

  // ── Section 5: Annotation text ───────────────────────────────
  sy += 160;
  parts.push(sectionTitle(40, sy, 'Annotations'));
  sy += 30;
  parts.push(annotation(40, sy, 'Feedback loop (until complete)'));
  parts.push(annotation(40, sy + 24, 'italic, reduced opacity, sans-serif'));

  // ── Section 6: Code block ────────────────────────────────────
  sy += 70;
  parts.push(sectionTitle(40, sy, 'Code Block'));
  sy += 20;
  parts.push(codeBlock({
    x: 40, y: sy, w: 360,
    lines: [
      'ls -l /home/oai/skills/',
      'cat /home/oai/skills/SKILL.md',
      '# monospace, green on dark card',
    ],
  }));

  // ── Section 7: Cards ─────────────────────────────────────────
  sy += 120;
  parts.push(sectionTitle(40, sy, 'Cards'));
  sy += 20;

  parts.push(card({
    x: 40, y: sy, w: 220, h: 100,
    title: 'Google doc',
    body: 'This document outlines\nour approach to feature\nprioritization.',
    iconSvg: renderIcon('doc'),
  }));
  parts.push(card({
    x: 280, y: sy, w: 220, h: 100,
    title: 'Slack message',
    body: 'We will follow guidance\non security posture.',
    iconSvg: renderIcon('person'),
  }));
  parts.push(card({
    x: 520, y: sy, w: 220, h: 100,
    title: 'Tacit knowledge',
    body: 'Ryan is responsible for\narchitectural direction.',
    iconSvg: renderIcon('brain'),
  }));

  // ── Section 8: Complete mini-diagram ─────────────────────────
  sy += 150;
  parts.push(sectionTitle(40, sy, 'Mini Diagram'));
  sy += 30;

  // Actor -> Hero node -> Dotgrid node
  parts.push(actor({ x: 80, y: sy + 10 }));
  parts.push(straightEdge({ from: { x: 100, y: sy + 30 }, to: { x: 180, y: sy + 30 }, label: 'PROMPT' }));
  parts.push(doubleBorder({ x: 190, y: sy + 5, w: 180, h: 50, label: 'RESPONSES API', fill: 'url(#hero)' }));
  parts.push(straightEdge({ from: { x: 380, y: sy + 30 }, to: { x: 460, y: sy + 30 } }));
  parts.push(doubleBorder({ x: 470, y: sy + 5, w: 140, h: 50, label: 'MODEL', fill: 'url(#dotgrid)' }));

  // Return arrow below (right-to-left; orient=auto rotates the normal arrowhead to point left)
  parts.push(straightEdge({
    from: { x: 540, y: sy + 65 },
    to: { x: 280, y: sy + 65 },
    label: 'SHELL COMMANDS',
  }));

  // Annotation
  parts.push(annotation(400, sy + 95, 'Feedback loop (until complete)'));

  // ── Compose final SVG ────────────────────────────────────────
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${colors.bg}"/>
  ${allDefs()}
  ${parts.join('\n  ')}
</svg>`;
}

// Write output
const outPath = 'examples/primitives-test.svg';
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, buildSvg(), 'utf-8');
console.log(`✓ Wrote ${outPath}`);
