/**
 * Hover definition preprocessor for blog markdown.
 *
 * Syntax: ::visible text|definition|key=value|key=value::
 *
 * The first two pipe-separated fields are required (visible text and definition).
 * Additional fields use key=value format:
 *   - source=Aristotle, Nicomachean Ethics
 *   - greek=ευδαιμονια
 *   - link=https://example.com
 *   - kind=clarification|reference|aside
 *
 * Examples:
 *   ::eudaimonia|The condition of human flourishing::
 *   ::eudaimonia|The condition of flourishing|source=Nicomachean Ethics|greek=ευδαιμονία::
 *   ::Alain de Botton|Swiss-British psychotherapist|kind=reference|link=https://youtube.com/watch?v=abc::
 */

// Match ::...:: blocks. Uses a non-greedy match that stops at ::
// but allows colons inside (links have colons), so we match until we find :: preceded by non-:
const HOVER_DEF_REGEX = /::([^|]+?)\|([\s\S]+?)::/g;

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

interface ParsedDefinition {
  text: string;
  definition: string;
  source?: string;
  greek?: string;
  link?: string;
  kind?: string;
}

function parseFields(text: string, rest: string): ParsedDefinition {
  // Split on unescaped pipes
  const parts = rest.split(/(?<!\\)\|/);
  const definition = parts[0].trim();

  const result: ParsedDefinition = {
    text: text.trim(),
    definition,
  };

  // Parse remaining parts as key=value or positional fallbacks
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    const eqIndex = part.indexOf('=');
    if (eqIndex > 0) {
      const key = part.slice(0, eqIndex).trim().toLowerCase();
      const value = part.slice(eqIndex + 1).trim();
      if (key === 'source') result.source = value;
      else if (key === 'greek') result.greek = value;
      else if (key === 'link') result.link = value;
      else if (key === 'kind') result.kind = value;
    } else {
      // Positional fallback: 2nd field = source, 3rd = greek
      if (!result.source) result.source = part;
      else if (!result.greek) result.greek = part;
    }
  }

  return result;
}

export function preprocessDefinitions(markdown: string): string {
  return markdown.replace(HOVER_DEF_REGEX, (_match, text, rest) => {
    const parsed = parseFields(text, rest);

    const attrs: string[] = [
      `term="${escapeAttr(parsed.text)}"`,
      `definition="${escapeAttr(parsed.definition)}"`,
    ];

    if (parsed.source) {
      attrs.push(`source="${escapeAttr(parsed.source)}"`);
    }
    if (parsed.greek) {
      attrs.push(`greek="${escapeAttr(parsed.greek)}"`);
    }
    if (parsed.link) {
      attrs.push(`link="${escapeAttr(parsed.link)}"`);
    }
    if (parsed.kind) {
      attrs.push(`kind="${escapeAttr(parsed.kind)}"`);
    }

    return `<hoverdef ${attrs.join(' ')}>${parsed.text}</hoverdef>`;
  });
}
