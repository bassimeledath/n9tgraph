# n9tgraph

A beautiful, opinionated diagramming DSL and renderer. Write `.n9` diagram source, get SVG or PNG output.

Supports **flow**, **sequence**, and **card** diagram types with automatic layout, subgraphs, annotations, and dark/white themes.

## Install

```bash
npm install
npm run build
```

## CLI Usage

```bash
# Render .n9 file to SVG (stdout)
npx n9tgraph examples/layered-architecture.n9

# Render to PNG file
npx n9tgraph examples/layered-architecture.n9 -f png -o output.png

# Watch mode
npx n9tgraph examples/layered-architecture.n9 -o output.svg --watch
```

## MCP Server

n9tgraph includes an MCP (Model Context Protocol) server that exposes three tools over stdio:

| Tool | Description |
|------|-------------|
| `n9t.render` | Parse and render `.n9` source to SVG or PNG. Returns dimensions, aspect ratio, node/edge counts, and layout warnings. |
| `n9t.validate` | Validate `.n9` source without rendering. Returns parse errors, warnings, and diagram statistics. |
| `n9t.grammar` | Get the full `.n9` DSL grammar reference, examples, node kinds, fill patterns, arrow types, and properties. |

### Quick Install (npx)

No clone needed — install directly from GitHub:

```json
{
  "mcpServers": {
    "n9tgraph": {
      "command": "npx",
      "args": ["-y", "github:bassimeledath/n9tgraph"]
    }
  }
}
```

This works in **Claude Desktop** (`claude_desktop_config.json`), **Claude Code** (`.mcp.json` or `~/.claude/mcp.json`), and **Cursor** (`.cursor/mcp.json`).

### Generic MCP Client (stdio)

Run directly after cloning:

```bash
npx tsx src/mcp-server.ts
```

Or after building:

```bash
node dist/mcp-server.js
```

## Quick DSL Example

```
type flow
title "API Architecture"
direction LR

service "API Gateway" {fill: hero}
component "Auth Service"
datastore "User DB"

API_GATEWAY --> AUTH_SERVICE : validate token
AUTH_SERVICE --> USER_DB : lookup user
```

See the `examples/` directory for more.

## License

MIT
