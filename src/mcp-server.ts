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

// ─── Grammar Reference ─────────────────────────────────

function getGrammarReference() {
  const syntax = `# n9tgraph DSL Quick Reference

## Diagram Types
type sequence | flow | card

## Common Directives
title "My Diagram Title"

## Flow Diagram Directives
direction LR | TB
theme default | white
spacing compact | balanced | spacious
aspect auto | portrait | landscape | square
wrap auto | none

## Sequence Diagram Directives
message-step <number>      # vertical step between messages (default: 34)
participant-gap <number>   # horizontal gap between participants

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
  overflow
end

## Annotations (flow)
annotation "text" near NODE_ID side top|bottom|left|right

## Code Blocks (flow)
codeblock "Title" {code: "line1\\nline2"}

## Sequence Messages
FROM -> TO : label text | annotation
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
fill: dotgrid | crosshatch | hero | none
shape: rect | pill | cylinder | doubleBorder | actor | circle
border: double
sublabel: "secondary text"
step: <number>
min-height: <number>
min-width: <number>

## Card Diagram
node "Label" {properties}
container "Group" {properties}
  card "Title" {body: "description", icon: "icon-name"}
  overflow
end
edge_in TARGET side : label
hanging TARGET side : label
FROM --> TO : label`;

  const examples = [
    `type flow
direction LR
title Simple API Flow

service "API Gateway" {fill: hero}
component "Auth Service"
datastore "User DB"

API_GATEWAY --> AUTH_SERVICE : validate token
AUTH_SERVICE --> USER_DB : lookup user`,

    `type sequence
title Request Lifecycle

participant Client
participant Server {fill: dotgrid}
participant Database {fill: crosshatch}

Client -> Server : HTTP Request
Server -> Database : Query
Database -> Server : Results
Server -> Client : HTTP Response`,

    `type flow
direction TB
title Layered Architecture
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
  ];

  const nodeKinds = ['service', 'component', 'external', 'actor', 'datastore', 'circle', 'label'];
  const fillPatterns = ['dotgrid', 'crosshatch', 'hero', 'none'];
  const arrowTypes = ['-->', '<--', '<-->', '-.->', '<-.-'];
  const properties = [
    'fill', 'shape', 'border', 'sublabel', 'code', 'step',
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
        const resvg = new Resvg(svg, {
          fitTo: { mode: "zoom", value: scale },
          background: "#000000",
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
