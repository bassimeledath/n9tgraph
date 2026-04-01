# n9tgraph

A beautiful, opinionated diagramming DSL and renderer. Write `.n9` diagram source, get SVG or PNG output. Inspired by the diagram style in [OpenAI's Codex engineering blog](https://openai.com/index/harness-engineering/).

Supports **flow**, **sequence**, and **card** diagram types with automatic layout, subgraphs, annotations, dark/white themes, and custom accent colors.

## Examples

### n9tgraph Architecture

<img src="examples/output/n9tgraph-architecture.png" alt="n9tgraph Architecture" width="600">

### Event-Driven Order System

![Event-Driven Order System](examples/output/event-driven-system.png)

## Themes & Colors

Built-in white theme and custom accent colors via `accentColor`.

![Themes & Accent Colors](examples/output/theme-accent-composite.png)

## MCP Server Install

### Claude Code (recommended)

```bash
claude mcp add --scope user --transport stdio n9tgraph -- npx -y n9tgraph
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "n9tgraph": {
      "command": "npx",
      "args": ["-y", "n9tgraph"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "n9tgraph": {
      "command": "npx",
      "args": ["-y", "n9tgraph"]
    }
  }
}
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `n9t.render` | Parse and render `.n9` source to SVG or PNG. Returns dimensions, aspect ratio, node/edge counts, and layout warnings. |
| `n9t.render-ascii` | Render a diagram from grid-based JSON layout with n9tgraph styling. Use for precise control over node positioning. Supports custom `accentColor`. |
| `n9t.validate` | Validate `.n9` source without rendering. Returns parse errors, warnings, and diagram statistics. |
| `n9t.grammar` | Get the full `.n9` DSL grammar reference, examples, node kinds, fill patterns, arrow types, and properties. |

## CLI Usage

```bash
# Render .n9 file to SVG (stdout)
npx n9tgraph-cli examples/ci-deploy-pipeline.n9

# Render to PNG file
npx n9tgraph-cli examples/ci-deploy-pipeline.n9 -f png -o output.png

# Watch mode
npx n9tgraph-cli examples/ci-deploy-pipeline.n9 -o output.svg --watch
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

## Development

```bash
npm install
npm run build
```

## License

MIT
