# Benchmark 3: Stress-Test Suite

5 diagrams designed to reliably trigger known rendering defects (overlap, congestion, topology drift, annotation collision). Used to measure improvement across solution iterations.

## Diagrams

### 1. hub-spoke-api-gateway.n9
**Pattern tested:** Hub congestion (audit Pattern 4), edge label overlap
- 12 nodes, 20+ edges converging on a single central API Gateway
- 8 outbound service routes + 4 reverse health-check edges create dense connector hub
- 4 inter-service bypass edges add secondary crossing paths
- Bidirectional edges to Redis/Config + dashed monitoring edges
- 4 annotations near congested areas

**Expected defects:** Edge labels overlapping near hub, arrowheads cramped against node borders, annotations competing with edge labels

### 2. deep-layered-dependencies.n9
**Pattern tested:** Topology drift (audit Pattern 1), layer assignment
- 17 nodes across 5 subgraph layers (Source Input → Frontend → IR Transform → Code Generation → Output)
- Normal top-down flow between adjacent layers
- 4 cross-layer skip connections that violate strict layering
- 4 reverse/feedback dashed edges flowing upward against the layout direction
- 3 annotations describing structural intent

**Expected defects:** Topology reordering (nodes placed in wrong layers), reverse edges poorly routed, cross-layer edges creating visual noise

### 3. dense-sequence-oauth.n9
**Pattern tested:** Text overflow, annotation overlap (audit Pattern 3), fragment nesting
- 8 participants spanning full width
- 30+ messages with long technical labels (URLs, JSON-like payloads)
- Nested fragments: `par` inside top-level, nested `alt` blocks inside outer `alt`, `loop` wrapping alt blocks
- Self-messages (participant → self)
- 3 `note over` annotations at different vertical positions

**Expected defects:** Long message labels overflowing or truncating, fragment labels crowding message area, participant headers compressed at narrow widths

### 4. nested-subgraph-mesh.n9
**Pattern tested:** Container semantics (audit Pattern 5), space allocation (audit Pattern 6)
- 4 separate subgraphs representing Kubernetes namespaces (ingress, app, data, monitoring)
- 22 nodes total across all subgraphs + 3 external nodes
- 30+ edges including 8 dashed monitoring edges that cross subgraph boundaries
- Multiple edge types: solid (data flow), dashed (monitoring/config), within-subgraph and cross-subgraph
- 4 annotations anchored to nodes in different subgraphs

**Expected defects:** Cross-subgraph edges creating visual clutter, uneven space allocation between subgraphs, dashed monitoring edges crowding solid data-flow edges

### 5. mixed-complexity-platform.n9
**Pattern tested:** Combined stress — hub-spoke + layered + annotations with step markers
- Hub-spoke section: 6 data sources feeding central Data Hub (Kafka)
- Layered pipeline: 3 subgraphs (Feature Engineering → Training → Serving) with inter-layer edges
- 5 step-annotated edges showing the end-to-end data flow order
- Reverse feedback loops (dashed edges from serving back to hub)
- 5 annotations with step markers providing numbered narrative
- Mix of node types: service, component, datastore, external

**Expected defects:** Step annotations colliding with edge labels, hub section pulling layout away from pipeline layers, feedback loops creating edge crossings, annotations with step markers poorly positioned

## Rendering

```bash
./node_modules/.bin/tsx src/render-benchmark3.ts
```

Outputs SVG + PNG to `examples/benchmark3/output/` and copies PNGs to `~/Downloads/n9tgraph-benchmark3/`.

## Baseline Quality

All 5 diagrams render without errors as of the initial creation. The rendered outputs serve as the baseline for measuring improvements. Key areas to evaluate on each iteration:

1. **Edge label readability** — Are labels clearly associated with their edges?
2. **Hub congestion** — Can all edges at a hub node be traced individually?
3. **Layer preservation** — Do nodes appear in the correct vertical/horizontal layer?
4. **Annotation placement** — Do annotations avoid overlapping edges and other annotations?
5. **Cross-boundary routing** — Are edges between subgraphs routed cleanly?
6. **Space utilization** — Is space distributed proportionally to content density?
