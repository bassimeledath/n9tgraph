#!/usr/bin/env node
// n9tgraph MCP server — exposes render, validate, and grammar tools
// via the Model Context Protocol over stdio transport

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Resvg } from "@resvg/resvg-js";
import { parse } from "./parser/parser.js";
import { render } from "./render/svg.js";
import type { DiagramAST, FlowDiagram, SequenceDiagram, CardDiagram } from "./parser/ast.js";
import { layoutFlow } from "./layout/flow-layout.js";
import type { FlowLayout } from "./layout/flow-layout.js";
import { wrapLabel, measureLineWidth } from "./layout/text-measure.js";
import { fontSizes } from "./render/theme.js";

// ─── Helpers ────────────────────────────────────────────

function parseSvgViewBox(svg: string): { width: number; height: number } {
  const match = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  if (match) {
    return { width: parseFloat(match[1]), height: parseFloat(match[2]) };
  }
  // Fallback: try width/height attributes
  const wm = svg.match(/width="(\d+(?:\.\d+)?)"/);
  const hm = svg.match(/height="(\d+(?:\.\d+)?)"/);
  return {
    width: wm ? parseFloat(wm[1]) : 0,
    height: hm ? parseFloat(hm[1]) : 0,
  };
}

function countNodes(ast: DiagramAST): number {
  switch (ast.type) {
    case 'flow': {
      const sgNodes = ast.subgraphs.reduce((sum, sg) => sum + sg.nodes.length, 0);
      return ast.nodes.length + sgNodes;
    }
    case 'sequence':
      return ast.participants.length;
    case 'card':
      return ast.nodes.length + ast.containers.length;
  }
}

function countEdges(ast: DiagramAST): number {
  switch (ast.type) {
    case 'flow': {
      const sgEdges = ast.subgraphs.reduce((sum, sg) => sum + sg.edges.length, 0);
      return ast.edges.length + sgEdges;
    }
    case 'sequence':
      return countSequenceMessages(ast.elements);
    case 'card':
      return ast.edges.length + ast.edgesIn.length;
  }
}

function countSequenceMessages(elements: SequenceDiagram['elements']): number {
  let count = 0;
  for (const el of elements) {
    if (el.type === 'message') count++;
    else if (el.type === 'fragment') count += countSequenceMessages(el.children);
  }
  return count;
}

function countSubgraphs(ast: DiagramAST): number {
  if (ast.type === 'flow') return ast.subgraphs.length;
  if (ast.type === 'card') return ast.containers.length;
  return 0;
}

// ─── Layout Analysis / Warnings ─────────────────────────

function analyzeLayout(ast: DiagramAST, svg: string): string[] {
  const warnings: string[] = [];
  const { width, height } = parseSvgViewBox(svg);

  if (width > 0 && height > 0) {
    const ratio = width / height;
    if (ratio > 2.5) {
      warnings.push(
        `Aspect ratio ${ratio.toFixed(1)}:1 — very wide. Consider 'aspect portrait', 'spacing compact', or splitting into subgraphs.`
      );
    } else if (ratio < 0.4) {
      warnings.push(
        `Aspect ratio ${ratio.toFixed(1)}:1 — very tall. Consider 'aspect landscape' or 'spacing compact'.`
      );
    }
  }

  const nodeCount = countNodes(ast);
  if (nodeCount > 15) {
    warnings.push(
      `${nodeCount} nodes in diagram — consider splitting into subgraphs for clarity.`
    );
  }

  // Check for long labels
  if (ast.type === 'flow') {
    for (const n of ast.nodes) {
      if (n.label.length > 30) {
        const wrappedLines = Math.ceil(n.label.length / 28);
        warnings.push(
          `Label '${n.label.slice(0, 25)}...' is ${n.label.length} chars — may wrap to ${wrappedLines} lines.`
        );
      }
    }
    for (const sg of ast.subgraphs) {
      for (const n of sg.nodes) {
        if (n.label.length > 30) {
          const wrappedLines = Math.ceil(n.label.length / 28);
          warnings.push(
            `Label '${n.label.slice(0, 25)}...' is ${n.label.length} chars — may wrap to ${wrappedLines} lines.`
          );
        }
      }
    }

    // Check for long edge labels
    for (const e of ast.edges) {
      if (e.label && e.label.length > 30) {
        warnings.push(
          `Edge label '${e.label.slice(0, 25)}...' is ${e.label.length} chars — will wrap to multiple lines.`
        );
      }
    }

    // Compute layout once for all analysis passes
    const layout = layoutFlow(ast);

    // Topology anomaly detection: warn when visual direction contradicts declared edge direction
    for (const e of ast.edges) {
      const isReverse = e.arrow === '<--' || e.arrow === '<-.-';
      const isBidi = e.arrow === '<-->';
      if (isBidi) continue;

      const srcId = isReverse ? e.to : e.from;
      const tgtId = isReverse ? e.from : e.to;
      const srcNode = layout.nodes.find(n => n.id === srcId);
      const tgtNode = layout.nodes.find(n => n.id === tgtId);
      if (!srcNode || !tgtNode) continue;

      if (ast.direction === 'TB' || !ast.direction) {
        if (srcNode.y > tgtNode.y + tgtNode.h) {
          warnings.push(
            `Edge ${srcId} -> ${tgtId} flows upward in a TB diagram — visual direction contradicts edge declaration. ` +
            `Consider reversing the arrow direction or using '<--'.`
          );
        }
      } else if (ast.direction === 'LR') {
        if (srcNode.x > tgtNode.x + tgtNode.w) {
          warnings.push(
            `Edge ${srcId} -> ${tgtId} flows rightward-to-leftward in an LR diagram — visual direction contradicts edge declaration. ` +
            `Consider reversing the arrow direction or using '<--'.`
          );
        }
      }
    }

    // Whitespace waste detection
    {
      let nodeArea = 0;
      for (const n of layout.nodes) nodeArea += n.w * n.h;
      const canvasArea = layout.width * layout.height;
      if (canvasArea > 0) {
        const efficiency = nodeArea / canvasArea;
        if (efficiency < 0.12) {
          warnings.push(
            `Node area is only ${Math.round(efficiency * 100)}% of canvas — diagram has excessive whitespace. ` +
            `Consider 'spacing compact' or reducing node count.`
          );
        }
      }

      // Flag individual oversized nodes (node area >> text content area)
      for (const n of layout.nodes) {
        const wrappedLines = wrapLabel(n.label, 28);
        const maxLine = wrappedLines.reduce((a, b) => a.length > b.length ? a : b, '');
        const labelW = measureLineWidth(maxLine.toUpperCase(), fontSizes.nodeLabel, 'mono')
          + maxLine.length * 0.12 * fontSizes.nodeLabel + 16;
        let labelH = wrappedLines.length * (fontSizes.nodeLabel * 1.4) + 8;
        if (n.properties.sublabel) {
          const subLines = wrapLabel(n.properties.sublabel, 34);
          labelH += subLines.length * Math.ceil(fontSizes.edgeLabel * 1.4) + 12;
        }
        const contentArea = labelW * labelH;
        const nArea = n.w * n.h;
        if (nArea > contentArea * 4 && nArea > 8000) {
          warnings.push(
            `Node '${n.label}' appears oversized (${Math.round(n.w)}x${Math.round(n.h)}) relative to its text content.`
          );
        }
      }
    }

    // Post-layout overlap detection
    const overlapWarnings = detectOverlaps(ast, layout);
    warnings.push(...overlapWarnings);
  }

  if (ast.type === 'sequence') {
    for (const p of ast.participants) {
      if (p.label.length > 25) {
        warnings.push(
          `Participant '${p.label.slice(0, 20)}...' is ${p.label.length} chars — may be truncated.`
        );
      }
    }
  }

  // DSL hints based on diagram type
  if (ast.type === 'flow') {
    if (!ast.spacing) {
      warnings.push(
        `Tip: Use 'spacing compact|balanced|spacious' to control node/layer gaps.`
      );
    }
    if (!ast.aspect && width > 0 && height > 0) {
      const ratio = width / height;
      if (ratio > 1.8 || ratio < 0.5) {
        warnings.push(
          `Tip: Use 'aspect portrait|landscape|square' to control diagram proportions.`
        );
      }
    }
  }

  return warnings;
}

// ─── Post-Render Overlap Detection ─────────────────────

interface BBox {
  x: number; y: number; w: number; h: number;
  kind: 'nodeLabel' | 'sublabel' | 'edgeLabel' | 'annotation' | 'subgraphHeader' | 'actorLabel' | 'nodeBody';
  label: string;
  ownerId?: string;
}

function detectOverlaps(ast: FlowDiagram, layout: FlowLayout): string[] {
  const overlaps: string[] = [];
  const boxes: BBox[] = [];

  // 1. Node body bounding boxes
  for (const n of layout.nodes) {
    boxes.push({
      x: n.x, y: n.y, w: n.w, h: n.h,
      kind: 'nodeBody',
      label: n.label,
      ownerId: n.id,
    });
  }

  // 2. Node label bounding boxes
  for (const n of layout.nodes) {
    if (n.kind === 'actor') {
      const labelW = measureLineWidth(n.label.toUpperCase(), fontSizes.nodeLabel, 'mono')
        + n.label.length * 0.12 * fontSizes.nodeLabel;
      const cx = n.x + n.w / 2;
      boxes.push({
        x: cx - labelW / 2 - 4,
        y: n.y + n.h - fontSizes.nodeLabel - 6,
        w: labelW + 8,
        h: fontSizes.nodeLabel + 10,
        kind: 'actorLabel',
        label: n.label,
        ownerId: n.id,
      });
    } else {
      const wrappedLines = wrapLabel(n.label, 28);
      const maxLine = wrappedLines.reduce((a, b) => a.length > b.length ? a : b, '');
      const labelW = measureLineWidth(maxLine.toUpperCase(), fontSizes.nodeLabel, 'mono')
        + maxLine.length * 0.12 * fontSizes.nodeLabel;
      const lineH = fontSizes.nodeLabel * 1.4;
      const labelH = wrappedLines.length * lineH;
      const cx = n.x + n.w / 2;
      const cy = n.y + n.h / 2 + (n.properties.sublabel ? -8 : 0);
      boxes.push({
        x: cx - labelW / 2, y: cy - labelH / 2,
        w: labelW, h: labelH,
        kind: 'nodeLabel',
        label: n.label,
        ownerId: n.id,
      });
    }

    // Sublabel bounding boxes
    if (n.properties.sublabel) {
      const sublabelLines = wrapLabel(n.properties.sublabel, 34);
      const maxSubLine = sublabelLines.reduce((a, b) => a.length > b.length ? a : b, '');
      const sublabelW = measureLineWidth(maxSubLine, fontSizes.edgeLabel, 'mono')
        + maxSubLine.length * 0.12 * fontSizes.edgeLabel + 16;
      const lineH = fontSizes.edgeLabel * 1.4;
      const totalH = sublabelLines.length * lineH + 6;
      const cx = n.x + n.w / 2;
      const sy = n.y + n.h / 2 + 12 - totalH / 2;
      boxes.push({
        x: cx - sublabelW / 2, y: sy,
        w: sublabelW, h: totalH,
        kind: 'sublabel',
        label: `sublabel of '${n.label}'`,
        ownerId: n.id,
      });
    }
  }

  // 3. Annotation bounding boxes
  for (const ann of layout.annotations) {
    const lines = ann.text.split('\n');
    const maxLineLen = Math.max(...lines.map(l => l.length));
    const cappedLen = Math.min(maxLineLen, 50);
    let boxX = ann.x;
    let boxW: number;
    let boxH: number;
    let boxY: number;
    if (ann.properties?.step) boxX -= 6;
    if (lines.length === 1 && !ann.properties?.step) {
      boxW = cappedLen * 7;
      boxH = fontSizes.annotation + 4;
      boxY = ann.y - boxH / 2;
    } else {
      boxW = cappedLen * 7 + (ann.properties?.step ? 28 : 0);
      boxH = lines.length * 18;
      boxY = ann.y;
    }
    boxes.push({
      x: boxX, y: boxY,
      w: boxW, h: boxH,
      kind: 'annotation',
      label: `annotation "${ann.text.slice(0, 30)}${ann.text.length > 30 ? '...' : ''}"`,
    });
  }

  // 4. Subgraph header bounding boxes
  for (const sg of layout.subgraphs) {
    if (!sg.label) continue;
    const textW = sg.label.length * 7.5 + 20;
    const textH = fontSizes.subtitle + 10;
    const hdrX = sg.x + sg.w / 2 - textW / 2;
    const hdrY = sg.y + 26 - textH / 2 - 1;
    boxes.push({
      x: hdrX, y: hdrY,
      w: textW, h: textH,
      kind: 'subgraphHeader',
      label: `subgraph header "${sg.label}"`,
    });
  }

  // 5. Edge label bounding boxes (approximate — uses midpoint placement)
  for (const e of layout.edges) {
    if (!e.label) continue;
    const lines = wrapLabel(e.label, 22);
    const maxLine = lines.reduce((a, b) => a.length > b.length ? a : b, '');
    const labelW = measureLineWidth(maxLine, fontSizes.edgeLabel, 'mono')
      + maxLine.length * 0.12 * fontSizes.edgeLabel + 12;
    const lineH = fontSizes.edgeLabel * 1.4;
    const labelH = lines.length * lineH + 6;
    const mx = (e.fromPt.x + e.toPt.x) / 2;
    const my = (e.fromPt.y + e.toPt.y) / 2;
    boxes.push({
      x: mx - labelW / 2, y: my - labelH / 2,
      w: labelW, h: labelH,
      kind: 'edgeLabel',
      label: `edge label "${e.label.slice(0, 25)}${e.label.length > 25 ? '...' : ''}"`,
      ownerId: `${e.from}->${e.to}`,
    });
  }

  // Pairwise AABB overlap test
  const clearance = 2;

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];

      // Skip self-collisions
      if (a.ownerId && a.ownerId === b.ownerId) continue;

      // Skip nodeBody-vs-nodeBody (handled by layout engine)
      if (a.kind === 'nodeBody' && b.kind === 'nodeBody') continue;

      // Skip nodeLabel/sublabel inside their own nodeBody
      if ((a.kind === 'nodeLabel' || a.kind === 'sublabel' || a.kind === 'actorLabel') && b.kind === 'nodeBody' && a.ownerId === b.ownerId) continue;
      if ((b.kind === 'nodeLabel' || b.kind === 'sublabel' || b.kind === 'actorLabel') && a.kind === 'nodeBody' && b.ownerId === a.ownerId) continue;

      // AABB overlap test
      const hOverlap = a.x < b.x + b.w + clearance && b.x < a.x + a.w + clearance;
      const vOverlap = a.y < b.y + b.h + clearance && b.y < a.y + a.h + clearance;

      if (hOverlap && vOverlap) {
        const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        const overlapArea = Math.max(0, overlapX) * Math.max(0, overlapY);
        const smallerArea = Math.min(a.w * a.h, b.w * b.h);
        const overlapPct = smallerArea > 0 ? Math.round((overlapArea / smallerArea) * 100) : 0;

        if (overlapPct > 8) {
          overlaps.push(
            `Overlap: ${a.kind} (${a.label}) collides with ${b.kind} (${b.label}) — ${overlapPct}% overlap.`
          );
        }
      }
    }
  }

  // Cap warnings to avoid flooding the LLM
  if (overlaps.length > 12) {
    const total = overlaps.length;
    overlaps.length = 12;
    overlaps.push(`...and ${total - 12} more overlaps detected.`);
  }

  return overlaps;
}

// ─── Grammar Reference ─────────────────────────────────

function getGrammarReference() {
  const syntax = `# n9tgraph DSL Quick Reference

## Diagram Types
type sequence | flow | card

## Common Directives
title "My Diagram Title"

## Flow Diagram Directives (must appear in this order, all optional)
# Order: title → theme → direction → spacing → aspect → wrap
direction LR | TB | RL | BT
theme default | white
spacing compact | balanced | spacious
aspect auto | portrait | landscape | square
wrap auto | none

## Sequence Diagram Directives
message-step <number>      # vertical step between messages (default: 34)
participant-gap <number>   # horizontal gap between participants

## ID Derivation
IDs are auto-derived from labels: uppercase, spaces→underscores, quotes stripped. e.g. 'API Gateway' → API_GATEWAY

## Node Declarations (flow)
<kind> <label> {properties}
  service "API Gateway" {fill: hero, sublabel: "main entry"}
  component Worker {fill: crosshatch}
  external "Third Party" {border: double}
  actor User
  datastore "PostgreSQL"
  circle Start
  label "Note text"

## Edges (flow)
FROM --> TO : label text
FROM <--> TO : bidirectional
FROM -.-> TO : dashed
FROM <-.- TO : dashed reverse

## Subgraphs (flow)
subgraph "Group Name" {fill: dotgrid}
  component A
  component B
  A --> B
  overflow                    # adds "..." indicator showing the group has more items
end

## Annotations (flow)
annotation "text" near NODE_ID side top|bottom|left|right
# Default side is 'right'. For nodes at the right edge, use side left or top.

## Code Blocks (flow)
codeblock "Title" {code: "line1\\nline2"}

## Sequence Participants
participant "Name" {fill: dotgrid}
# Participants must be declared before use in messages. Declaration order = left-to-right display order.

## Sequence Messages
FROM -> TO : label text | annotation
# In messages, use derived IDs (uppercase, spaces→underscores), not labels. e.g. participant "Auth Server" → AUTH_SERVER
FROM <- TO : reverse
FROM <-> TO : bidirectional

## Sequence Fragments
loop|alt|opt|par condition
  FROM -> TO : message
end

## Sequence Notes
note over PARTICIPANT : note text

## Properties Block
{key: value, key2: "quoted value"}

## Available Properties
fill: dotgrid | crosshatch | hero | none         # flow nodes, sequence participants, subgraphs
shape: rect | pill | cylinder | doubleBorder | actor | circle   # flow nodes only
border: double                                     # flow nodes only
sublabel: "secondary text"                         # flow nodes only
emphasis: primary | secondary | muted              # flow nodes — controls border weight, text opacity
color: accent | dim | muted | <hex>                # edges — controls edge line + label color
badge: "LABEL"                                     # subgraphs — renders a colored pill badge in header
border-style: solid | dashed | none                # subgraphs — controls subgraph border rendering
step: <number>                                     # annotations and edges — numbered circle indicator
min-height: <number>                               # flow nodes only
min-width: <number>                                # flow nodes only

## Card Diagram
node "Label" {properties}
container "Group" {properties}
  card "Title" {body: "description", icon: "icon-name"}
  overflow
end
edge_in TARGET side : label
hanging TARGET side : label     # dangling edge stub pointing into a card container
FROM --> TO : label

## Topology Best Practices
# Edge direction encodes semantic meaning — get it right:
# - A --> B means "A depends on B" or "A sends to B"
# - In TB direction: A --> B places A ABOVE B visually
# - In LR direction: A --> B places A LEFT of B visually
# - Use <-- for reverse dependencies: A <-- B means B depends on A
# - Use <--> only for truly bidirectional relationships
# Common mistake: reversing dependency direction (writing A --> B when you mean B --> A)
# ALWAYS cross-check your edge list against the original topology before rendering.

## Topology Patterns
# Layered architecture (TB): each layer depends ONLY on the layer below
#   FRONTEND --> API --> DATABASE (top-to-bottom dependency chain)
#   Never connect a lower layer back up to a higher one with --> (use <-- or -.->)
# Hub-spoke: one central service node with outbound --> edges to peripherals
# Pipeline: linear chain A --> B --> C --> D
# Mesh: use <--> for peer-to-peer bidirectional connections

## Visual Hierarchy
# Use node kinds and fill patterns to establish visual importance:
# - 'service' kind = protagonist node (gets double border + hero fill automatically)
# - 'component' kind = standard workhorse nodes
# - 'external' kind = third-party / de-emphasized nodes
# - 'actor' kind = human/user entry points (stick figure, naturally distinct)
# - 'datastore' kind = persistence layer (cylinder shape)
# - 'label' kind = floating text annotation (no border)
# Use fill patterns to layer emphasis:
# - fill: hero = highest emphasis (bright green fill) — use for 1-2 key nodes
# - fill: dotgrid = medium emphasis — good for a thematic group
# - fill: crosshatch = low-medium emphasis — good for infrastructure/support nodes
# - fill: none = lowest emphasis — use for external/peripheral nodes
# Use sublabel for secondary context without adding visual weight
# Rule of thumb: 1 hero node, 2-3 dotgrid nodes, remaining plain or crosshatch
# Use emphasis property for fine-grained visual weight control:
# - emphasis: primary = bold border, full opacity — use for key nodes
# - emphasis: secondary = dimmer border + text — supporting nodes
# - emphasis: muted = gray border + reduced opacity — background/context nodes
# Use edge color to create visual layers:
# - color: accent (default) = primary flow paths
# - color: dim = secondary/optional paths
# - color: muted = background dependencies
# Use badge on subgraphs to label architectural layers (e.g. badge: "LAYER 1")
# Use border-style: dashed on subgraphs for logical/optional groupings`;

  const examples = [
    `type flow
title Simple API Flow
direction LR

service "API Gateway" {fill: hero}
component "Auth Service"
datastore "User DB"

API_GATEWAY --> AUTH_SERVICE : validate token
AUTH_SERVICE --> USER_DB : lookup user`,

    `type sequence
title Request Lifecycle

participant Client
participant "Auth Server" {fill: crosshatch}
participant Database {fill: dotgrid}

Client -> AUTH_SERVER : authenticate
AUTH_SERVER -> Database : lookup user
Database -> AUTH_SERVER : user record
AUTH_SERVER -> Client : token | session ID`,

    `type flow
title Layered Architecture
direction TB
spacing spacious

subgraph "Frontend" {fill: dotgrid}
  component "React App"
  component "State Manager"
end

subgraph "Backend" {fill: crosshatch}
  service "API Server" {fill: hero}
  component "Business Logic"
end

REACT_APP --> API_SERVER : REST calls
STATE_MANAGER --> API_SERVER : GraphQL`,

    `type card
title Team Dashboard

container "Engineering"
  card "Frontend" {body: "React + TypeScript", icon: "monitor"}
  card "Backend" {body: "Node.js services", icon: "server"}
end

container "Data"
  card "Pipeline" {body: "ETL jobs", icon: "database"}
end

edge_in PIPELINE right : feeds
FRONTEND --> BACKEND : API calls`,

    `type flow
title "Layered Architecture with Cross-Cutting Concerns"
direction TB
spacing balanced

subgraph "Presentation Layer" {fill: dotgrid}
  component "Web App"
  component "Mobile App"
end

subgraph "Application Layer" {fill: crosshatch}
  service "API Server" {fill: hero, sublabel: "REST + GraphQL"}
  component "Auth Middleware"
end

subgraph "Domain Layer" {fill: dotgrid}
  component "Business Logic"
  component "Event Bus"
end

subgraph "Infrastructure Layer" {fill: crosshatch}
  datastore "PostgreSQL"
  datastore "Redis"
end

WEB_APP --> API_SERVER : HTTPS
MOBILE_APP --> API_SERVER : HTTPS
API_SERVER --> AUTH_MIDDLEWARE : validate
AUTH_MIDDLEWARE --> BUSINESS_LOGIC : authorized request
BUSINESS_LOGIC --> EVENT_BUS : domain events
BUSINESS_LOGIC --> POSTGRESQL : queries
EVENT_BUS --> REDIS : pub/sub
API_SERVER -.-> REDIS : session cache

annotation "Each layer depends only on\\nthe layer directly below it" near API_SERVER side right`,
  ];

  const nodeKinds = ['service', 'component', 'external', 'actor', 'datastore', 'circle', 'label'];
  const fillPatterns = ['dotgrid', 'crosshatch', 'hero', 'none'];
  const arrowTypes = ['-->', '<--', '<-->', '-.->', '<-.-'];
  const properties = [
    'fill', 'shape', 'border', 'sublabel', 'code', 'step',
    'emphasis', 'color', 'badge', 'border-style',
    'min-height', 'min-width',
  ];

  return { syntax, examples, nodeKinds, fillPatterns, arrowTypes, properties };
}

// ─── MCP Server Setup ───────────────────────────────────

const server = new McpServer({
  name: "n9tgraph",
  version: "1.0.0",
});

// ─── n9t.render ─────────────────────────────────────────

server.tool(
  "n9t.render",
  "Render a .n9 diagram source to SVG (and optionally PNG). Returns dimensions, aspect ratio, node/edge counts, and layout warnings.",
  {
    source: z.string().describe(".n9 diagram source content"),
    format: z.enum(["svg", "png"]).describe("Output format"),
    scale: z.number().optional().default(2).describe("PNG scale factor (default: 2)"),
  },
  async ({ source, format, scale }) => {
    try {
      const ast = parse(source);
      const svg = render(ast);
      const { width, height } = parseSvgViewBox(svg);
      const aspectRatio = height > 0 ? Math.round((width / height) * 100) / 100 : 0;
      const nodeCount = countNodes(ast);
      const edgeCount = countEdges(ast);
      const warnings = analyzeLayout(ast, svg);

      const result: Record<string, unknown> = {
        svg,
        width,
        height,
        aspectRatio,
        warnings,
        nodeCount,
        edgeCount,
      };

      if (format === "png") {
        const bg = /theme\s+white/.test(source) ? "#ffffff" : "#000000";
        // Dynamic fitTo: ensure text stays readable at any SVG width
        // Base: max(800, svgWidth * 0.75), then multiply by user scale
        const pngWidth = Math.max(800, Math.round(width * 0.75)) * scale;
        const resvg = new Resvg(svg, {
          fitTo: { mode: "width", value: pngWidth },
          background: bg,
        });
        const pngBuffer = resvg.render().asPng();
        result.png = Buffer.from(pngBuffer).toString("base64");
      }

      // Return as content blocks — text for metadata, image for PNG
      const content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }> = [
        {
          type: "text" as const,
          text: JSON.stringify({
            width,
            height,
            aspectRatio,
            nodeCount,
            edgeCount,
            warnings,
            ...(format === "svg" ? { svg } : {}),
          }, null, 2),
        },
      ];

      if (format === "png" && result.png) {
        content.push({
          type: "image" as const,
          data: result.png as string,
          mimeType: "image/png",
        });
      }

      return { content };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Parse/render error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ─── n9t.validate ───────────────────────────────────────

server.tool(
  "n9t.validate",
  "Validate .n9 diagram source without full rendering. Returns parse errors, warnings, and diagram statistics.",
  {
    source: z.string().describe(".n9 diagram source content"),
  },
  async ({ source }) => {
    try {
      const ast = parse(source);
      const nodeCount = countNodes(ast);
      const edgeCount = countEdges(ast);
      const subgraphCount = countSubgraphs(ast);
      const warnings: string[] = [];

      // Check for isolated nodes (no edges) in flow diagrams
      if (ast.type === 'flow') {
        const connectedIds = new Set<string>();
        for (const e of ast.edges) {
          connectedIds.add(e.from);
          connectedIds.add(e.to);
        }
        for (const sg of ast.subgraphs) {
          for (const e of sg.edges) {
            connectedIds.add(e.from);
            connectedIds.add(e.to);
          }
        }
        for (const n of ast.nodes) {
          if (!connectedIds.has(n.id)) {
            warnings.push(`Node '${n.label}' (${n.id}) has no edges.`);
          }
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            valid: true,
            errors: [],
            warnings,
            stats: {
              type: ast.type,
              nodeCount,
              edgeCount,
              subgraphCount,
              ...(ast.type === 'flow' && ast.codeblocks.length > 0
                ? { codeblockCount: ast.codeblocks.length }
                : {}),
            },
          }, null, 2),
        }],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Extract location info from PEG parse errors
      let errors: Array<{ message: string; location?: unknown }> = [];
      if (err && typeof err === 'object' && 'location' in err) {
        const pegErr = err as { message: string; location: unknown };
        errors = [{ message: pegErr.message, location: pegErr.location }];
      } else {
        errors = [{ message }];
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            valid: false,
            errors,
            warnings: [],
            stats: null,
          }, null, 2),
        }],
      };
    }
  }
);

// ─── n9t.grammar ────────────────────────────────────────

server.tool(
  "n9t.grammar",
  "Get the .n9 DSL grammar reference, example snippets, available node kinds, fill patterns, arrow types, and properties.",
  {},
  async () => {
    const ref = getGrammarReference();
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(ref, null, 2),
      }],
    };
  }
);

// ─── Start ──────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});
