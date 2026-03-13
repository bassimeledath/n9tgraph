// AST type definitions for all n9tgraph diagram types

// ─── Common ──────────────────────────────────────────────

export type FillPattern = 'dotgrid' | 'crosshatch' | 'hero' | 'none';
export type ShapeType = 'rect' | 'pill' | 'cylinder' | 'doubleBorder' | 'actor';

export interface Properties {
  fill?: FillPattern;
  shape?: ShapeType;
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

// ─── Flow Diagram (placeholder for future) ───────────────

export interface FlowNode {
  id: string;
  label: string;
  properties: Properties;
}

export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
}

export interface Subgraph {
  id: string;
  label: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowDiagram {
  type: 'flow';
  title?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  subgraphs: Subgraph[];
}

// ─── Card Diagram (placeholder for future) ───────────────

export interface Card {
  id: string;
  title: string;
  body?: string;
  icon?: string;
  properties: Properties;
}

export interface Container {
  id: string;
  label: string;
  cards: Card[];
}

export interface CardDiagram {
  type: 'card';
  title?: string;
  cards: Card[];
  containers: Container[];
}

// ─── Union type ──────────────────────────────────────────

export type DiagramAST = SequenceDiagram | FlowDiagram | CardDiagram;
