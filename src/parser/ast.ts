// AST type definitions for all n9tgraph diagram types

// ─── Common ──────────────────────────────────────────────

export type FillPattern = 'dotgrid' | 'crosshatch' | 'hero' | 'none';
export type ShapeType = 'rect' | 'pill' | 'cylinder' | 'doubleBorder' | 'actor' | 'circle';

export interface Properties {
  fill?: FillPattern;
  shape?: ShapeType;
  border?: string;
  sublabel?: string;
  code?: string;
  step?: string;
  [key: string]: string | undefined;
}

// ─── Sequence Diagram ────────────────────────────────────

export interface Participant {
  id: string;
  label: string;
  properties: Properties;
}

export type ArrowDirection = '->' | '<-' | '<->';

export interface Message {
  type: 'message';
  from: string;
  to: string;
  arrow: ArrowDirection;
  label: string;
  annotation?: string;
}

export type FragmentKind = 'loop' | 'alt' | 'opt' | 'par';

export interface CombinedFragment {
  type: 'fragment';
  kind: FragmentKind;
  condition?: string;
  children: SequenceElement[];
}

export interface Note {
  type: 'note';
  over: string[];
  text: string;
}

export type SequenceElement = Message | CombinedFragment | Note;

export interface SequenceDiagram {
  type: 'sequence';
  title?: string;
  participants: Participant[];
  elements: SequenceElement[];
}

// ─── Flow Diagram ───────────────────────────────────────

export type FlowDirection = 'LR' | 'TB';
export type FlowNodeKind = 'service' | 'component' | 'external' | 'actor' | 'datastore' | 'label' | 'circle';

export interface FlowNode {
  id: string;
  label: string;
  kind: FlowNodeKind;
  properties: Properties;
}

export interface FlowEdge {
  from: string;
  to: string;
  arrow: '-->' | '<--' | '<-->' | '-.->' | '<-.-';
  label?: string;
  dashed?: boolean;
  properties?: Properties;
}

export interface FlowAnnotation {
  text: string;
  near: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  properties?: Properties;
}

export interface SubgraphChildOrder {
  kind: 'node' | 'overflow';
  id?: string; // only for 'node'
}

export interface Subgraph {
  id: string;
  label: string;
  properties: Properties;
  nodes: FlowNode[];
  edges: FlowEdge[];
  childOrder: SubgraphChildOrder[];
}

export interface CodeBlock {
  id: string;
  label: string;
  properties: Properties;
}

export type ThemeName = 'default' | 'white';

export interface FlowDiagram {
  type: 'flow';
  title?: string;
  theme?: ThemeName;
  direction: FlowDirection;
  nodes: FlowNode[];
  edges: FlowEdge[];
  annotations: FlowAnnotation[];
  subgraphs: Subgraph[];
  codeblocks: CodeBlock[];
}

// ─── Card Diagram ──────────────────────────────────────────

export interface CardNode {
  id: string;
  label: string;
  properties: Properties;
}

export interface CardCard {
  id: string;
  title: string;
  body?: string;
  icon?: string;
  properties: Properties;
}

export interface CardContainer {
  id: string;
  label: string;
  cards: CardCard[];
  hasOverflow: boolean;
  properties: Properties;
}

export interface CardEdgeIn {
  target: string;
  side: 'left' | 'right' | 'top' | 'bottom';
  label?: string;
  icon?: string;
  properties: Properties;
}

export interface CardHangingLabel {
  target: string;
  side: 'top' | 'bottom' | 'left' | 'right';
  label: string;
  icon?: string;
  properties: Properties;
}

export interface CardEdge {
  from: string;
  to: string;
  arrow: string;
  label?: string;
  properties: Properties;
}

export interface CardDiagram {
  type: 'card';
  title?: string;
  nodes: CardNode[];
  containers: CardContainer[];
  edges: CardEdge[];
  edgesIn: CardEdgeIn[];
  hangingLabels: CardHangingLabel[];
}

// ─── Union type ──────────────────────────────────────────

export type DiagramAST = SequenceDiagram | FlowDiagram | CardDiagram;
