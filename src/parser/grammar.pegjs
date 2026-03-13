// n9tgraph PEG grammar — sequence + flow diagram support
// Parsed by peggy at runtime

{
  function msg(from, arrow, to, label, annotation) {
    return {
      type: 'message',
      from: from,
      to: to,
      arrow: arrow,
      label: label || '',
      ...(annotation ? { annotation } : {}),
    };
  }

  function makeId(label) {
    return label.replace(/[^A-Za-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').toUpperCase();
  }
}

Diagram
  = WS "type" HS+ t:Identifier EOL &{ return t === 'sequence'; } rest:SequenceBody { return rest; }
  / WS "type" HS+ t:Identifier EOL &{ return t === 'flow'; } rest:FlowBody { return rest; }

// ═══════════════════════════════════════════════════════════
// SEQUENCE DIAGRAM
// ═══════════════════════════════════════════════════════════

SequenceBody
  = WS title:TitleLine? stmts:( WS s:SeqStatement { return s; } )* WS {
      return {
        type: 'sequence',
        title: title || undefined,
        participants: stmts.filter(s => s._kind === 'participant').map(({ _kind, ...rest }) => rest),
        elements: stmts.filter(s => s._kind !== 'participant'),
      };
    }

SeqStatement
  = ParticipantStmt / FragmentStmt / NoteStmt / MessageStmt

// ─── Participant ─────────────────────────────────────────

ParticipantStmt
  = "participant" HS+ label:ParticipantLabel HS* props:PropertiesBlock? EOL {
      const id = label.replace(/\s+/g, '_').toUpperCase();
      return {
        _kind: 'participant',
        id,
        label,
        properties: props || {},
      };
    }

ParticipantLabel
  = QuotedString
  / chars:$( [A-Za-z0-9_#\-.]+ (HS+ [A-Za-z0-9_#\-.]+ )* ) &(HS* "{" / HS* EOL) { return chars; }

// ─── Message ─────────────────────────────────────────────

MessageStmt
  = from:Identifier HS+ arrow:SeqArrow HS+ to:Identifier HS* ":" HS* label:MessageText? ann:AnnotationSuffix? EOL {
      return msg(from, arrow, to, label || '', ann);
    }
  / from:Identifier HS+ arrow:SeqArrow HS+ to:Identifier EOL {
      return msg(from, arrow, to, '', undefined);
    }

SeqArrow
  = "<->" { return '<->'; }
  / "<-"  { return '<-'; }
  / "->"  { return '->'; }

MessageText
  = chars:$[^\n\r|]+ { return chars.trim(); }

AnnotationSuffix
  = HS* "|" HS* text:RestOfLine { return text; }

// ─── Combined Fragments ──────────────────────────────────

FragmentStmt
  = kind:FragmentKind cond:(HS+ c:RestOfLine { return c; })? EOL children:( WS s:SeqStatement { return s; } )* WS "end" EOL {
      return {
        type: 'fragment',
        kind: kind,
        ...(cond ? { condition: cond } : {}),
        children: children.filter(s => s._kind !== 'participant'),
      };
    }

FragmentKind
  = "loop"i { return 'loop'; }
  / "alt"i  { return 'alt'; }
  / "opt"i  { return 'opt'; }
  / "par"i  { return 'par'; }

// ─── Note ────────────────────────────────────────────────

NoteStmt
  = "note" HS+ "over" HS+ targets:NoteTargets HS* ":" HS* text:RestOfLine EOL {
      return {
        type: 'note',
        over: targets,
        text: text,
      };
    }

NoteTargets
  = first:Identifier rest:(HS* "," HS* id:Identifier { return id; })* { return [first, ...rest]; }

// ═══════════════════════════════════════════════════════════
// FLOW DIAGRAM
// ═══════════════════════════════════════════════════════════

FlowBody
  = WS title:TitleLine? WS dir:DirectionLine? stmts:( WS s:FlowStatement { return s; } )* WS {
      const nodes = stmts.filter(s => s._kind === 'node').map(({ _kind, ...rest }) => rest);
      const edges = stmts.filter(s => s._kind === 'edge').map(({ _kind, ...rest }) => rest);
      const annotations = stmts.filter(s => s._kind === 'annotation').map(({ _kind, ...rest }) => rest);
      const subgraphs = stmts.filter(s => s._kind === 'subgraph').map(({ _kind, ...rest }) => rest);
      const codeblocks = stmts.filter(s => s._kind === 'codeblock').map(({ _kind, ...rest }) => rest);
      return {
        type: 'flow',
        title: title || undefined,
        direction: dir || 'LR',
        nodes: nodes,
        edges: edges,
        annotations: annotations,
        subgraphs: subgraphs,
        codeblocks: codeblocks,
      };
    }

DirectionLine
  = "direction" HS+ d:$("LR" / "TB" / "RL" / "BT") EOL { return d; }

FlowStatement
  = FlowAnnotationStmt / FlowSubgraphStmt / FlowCodeblockStmt / FlowNodeStmt / FlowEdgeStmt

// ─── Flow Subgraph ──────────────────────────────────────

FlowSubgraphStmt
  = "subgraph" HS+ label:FlowNodeLabel HS* props:PropertiesBlock? EOL
    children:( WS s:FlowSubgraphChild { return s; } )*
    WS "end" EOL {
      const childNodes = children.filter(s => s._kind === 'node').map(({ _kind, ...rest }) => rest);
      const childEdges = children.filter(s => s._kind === 'edge').map(({ _kind, ...rest }) => rest);
      const childOrder = children.filter(s => s._kind === 'node' || s._kind === 'overflow').map(s => {
        if (s._kind === 'node') return { kind: 'node', id: s.id };
        return { kind: 'overflow' };
      });
      return {
        _kind: 'subgraph',
        id: makeId(label),
        label: label,
        properties: props || {},
        nodes: childNodes,
        edges: childEdges,
        childOrder: childOrder,
      };
    }

FlowSubgraphChild
  = FlowOverflowStmt / FlowNodeStmt / FlowEdgeStmt

// ─── Flow Overflow ──────────────────────────────────────

FlowOverflowStmt
  = "overflow" EOL {
      return { _kind: 'overflow' };
    }

// ─── Flow Code Block ────────────────────────────────────

FlowCodeblockStmt
  = "codeblock" HS+ label:FlowNodeLabel HS* props:PropertiesBlock? EOL {
      return {
        _kind: 'codeblock',
        id: makeId(label),
        label: label,
        properties: props || {},
      };
    }

// ─── Flow Node ───────────────────────────────────────────

FlowNodeStmt
  = kind:FlowNodeKind HS+ label:FlowNodeLabel HS* props:PropertiesBlock? EOL {
      const id = makeId(label);
      return {
        _kind: 'node',
        id,
        label,
        kind: kind,
        properties: props || {},
      };
    }

FlowNodeKind
  = "service"   { return 'service'; }
  / "component" { return 'component'; }
  / "external"  { return 'external'; }
  / "actor"     { return 'actor'; }
  / "datastore" { return 'datastore'; }
  / "circle"    { return 'circle'; }
  / "label"     { return 'label'; }

FlowNodeLabel
  = QuotedString
  / chars:$( [A-Za-z0-9_#\-.]+ (HS+ [A-Za-z0-9_#\-.]+ )* ) &(HS* "{" / HS* EOL) { return chars; }

// ─── Flow Edge ───────────────────────────────────────────

FlowEdgeStmt
  = from:Identifier HS+ arrow:FlowArrow HS+ to:Identifier HS* ":" HS* label:EdgeText HS* props:PropertiesBlock? EOL {
      return {
        _kind: 'edge',
        from: from,
        to: to,
        arrow: arrow,
        label: label,
        dashed: arrow.indexOf('-.') >= 0 || arrow.indexOf('.-') >= 0,
        properties: props || {},
      };
    }
  / from:Identifier HS+ arrow:FlowArrow HS+ to:Identifier HS* props:PropertiesBlock? EOL {
      return {
        _kind: 'edge',
        from: from,
        to: to,
        arrow: arrow,
        label: undefined,
        dashed: arrow.indexOf('-.') >= 0 || arrow.indexOf('.-') >= 0,
        properties: props || {},
      };
    }

EdgeText
  = chars:$[^\n\r{]+ { return chars.trim(); }

FlowArrow
  = "<-->" { return '<-->'; }
  / "<--"  { return '<--'; }
  / "-->"  { return '-->'; }
  / "-.->" { return '-.->'; }
  / "<-.-" { return '<-.-'; }

// ─── Flow Annotation ────────────────────────────────────

FlowAnnotationStmt
  = "annotation" HS+ text:QuotedString HS+ props:AnnotationProps HS* extra:PropertiesBlock? EOL {
      return {
        _kind: 'annotation',
        text: text,
        ...props,
        properties: extra || {},
      };
    }

AnnotationProps
  = pairs:AnnotationPropPair+ {
      const obj = {};
      for (const [k, v] of pairs) obj[k] = v;
      return obj;
    }

AnnotationPropPair
  = HS* key:("near" / "side") HS+ value:Identifier HS* { return [key, value]; }

// ═══════════════════════════════════════════════════════════
// SHARED PRIMITIVES
// ═══════════════════════════════════════════════════════════

TitleLine
  = "title" HS+ text:RestOfLine EOL { return text; }

PropertiesBlock
  = "{" HS* pairs:PropertyPair* HS* "}" {
      const obj = {};
      for (const [k, v] of pairs) obj[k] = v;
      return obj;
    }

PropertyPair
  = HS* key:Identifier HS* ":" HS* value:PropertyValue HS* ","? { return [key, value]; }

PropertyValue
  = QuotedString / Identifier / $[0-9]+

Identifier
  = $( [A-Za-z_] [A-Za-z0-9_]* )

QuotedString
  = '"' chars:DQChar* '"' { return chars.join(''); }
  / "'" chars:SQChar* "'" { return chars.join(''); }

DQChar
  = '\\n' { return '\n'; }
  / '\\\\' { return '\\'; }
  / '\\"' { return '"'; }
  / c:[^"\\] { return c; }

SQChar
  = '\\n' { return '\n'; }
  / '\\\\' { return '\\'; }
  / "\\'" { return "'"; }
  / c:[^'\\] { return c; }

RestOfLine
  = chars:$[^\n\r]+ { return chars.trim(); }

EOL "end of line"
  = HS* (Comment / NL / EOF)

NL "newline"
  = "\n" / "\r\n" / "\r"

EOF = !.

HS "horizontal space"
  = [ \t]

WS "whitespace"
  = (HS / NL / Comment)*

Comment
  = ("//" / "#") [^\n\r]* NL
