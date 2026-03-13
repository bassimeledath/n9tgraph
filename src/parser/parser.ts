// Parser wrapper — compiles PEG grammar and parses input to AST
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import peggy from 'peggy';
import type { DiagramAST } from './ast.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve grammar relative to this file (works from both src/ and dist/)
function findGrammar(): string {
  // Try src/ first (dev via tsx), then fall back to dist/ sibling
  for (const rel of [
    join(__dirname, 'grammar.pegjs'),
    join(__dirname, '..', '..', 'src', 'parser', 'grammar.pegjs'),
  ]) {
    try {
      return readFileSync(rel, 'utf-8');
    } catch {
      continue;
    }
  }
  throw new Error('Could not locate grammar.pegjs');
}

let cachedParser: peggy.Parser | null = null;

function getParser(): peggy.Parser {
  if (!cachedParser) {
    const grammarSource = findGrammar();
    cachedParser = peggy.generate(grammarSource);
  }
  return cachedParser;
}

export function parse(input: string): DiagramAST {
  const parser = getParser();
  // Ensure input ends with a newline (grammar expects NL terminators)
  const normalized = input.endsWith('\n') ? input : input + '\n';
  return parser.parse(normalized) as DiagramAST;
}
