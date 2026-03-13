// n9tgraph PEG grammar — sequence diagram subset
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
}

Diagram
  = WS header:TypeLine WS title:TitleLine? stmts:( WS s:Statement { return s; } )* WS {
      return {
        type: header,
        title: title || undefined,
        participants: stmts.filter(s => s._kind === 'participant').map(({ _kind, ...rest }) => rest),
        elements: stmts.filter(s => s._kind !== 'participant'),
      };
    }

TypeLine
  = "type" HS+ t:Identifier EOL { return t; }

TitleLine
  = "title" HS+ text:RestOfLine EOL { return text; }

Statement
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

PropertiesBlock
  = "{" HS* pairs:PropertyPair* HS* "}" {
      const obj = {};
      for (const [k, v] of pairs) obj[k] = v;
      return obj;
    }

PropertyPair
  = HS* key:Identifier HS* ":" HS* value:PropertyValue HS* ","? { return [key, value]; }

PropertyValue
  = QuotedString / Identifier

// ─── Message ─────────────────────────────────────────────

MessageStmt
  = from:Identifier HS+ arrow:Arrow HS+ to:Identifier HS* ":" HS* label:MessageText? ann:AnnotationSuffix? EOL {
      return msg(from, arrow, to, label || '', ann);
    }
  / from:Identifier HS+ arrow:Arrow HS+ to:Identifier EOL {
      return msg(from, arrow, to, '', undefined);
    }

Arrow
  = "<->" { return '<->'; }
  / "<-"  { return '<-'; }
  / "->"  { return '->'; }

MessageText
  = chars:$[^\n\r|]+ { return chars.trim(); }

AnnotationSuffix
  = HS* "|" HS* text:RestOfLine { return text; }

// ─── Combined Fragments ──────────────────────────────────

FragmentStmt
  = kind:FragmentKind cond:(HS+ c:RestOfLine { return c; })? EOL children:( WS s:Statement { return s; } )* WS "end" EOL {
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

// ─── Primitives ──────────────────────────────────────────

Identifier
  = $( [A-Za-z_] [A-Za-z0-9_]* )

QuotedString
  = '"' chars:$[^"]* '"' { return chars; }
  / "'" chars:$[^']* "'" { return chars; }

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
