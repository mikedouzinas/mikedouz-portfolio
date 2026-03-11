/**
 * Regex to match hover definition syntax: ::visible text|definition|source?|greek?::
 *
 * Captures:
 *   1: visible text (the trigger phrase shown in the post)
 *   2: definition text
 *   3: source (optional, may be empty)
 *   4: greek text (optional, may be empty)
 *
 * Supports escaped pipes (\|) within fields.
 */
const HOVER_DEF_REGEX = /::([^|:]+?)\|([^:]+?)(?:\|([^|:]*?))?(?:\|([^|:]*?))?::/g;

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\?\|/g, '|');
}

export function preprocessDefinitions(markdown: string): string {
  return markdown.replace(HOVER_DEF_REGEX, (_match, text, definition, source, greek) => {
    const attrs: string[] = [
      `term="${escapeAttr(text.trim())}"`,
      `definition="${escapeAttr(definition.trim())}"`,
    ];

    if (source?.trim()) {
      attrs.push(`source="${escapeAttr(source.trim())}"`);
    }

    if (greek?.trim()) {
      attrs.push(`greek="${escapeAttr(greek.trim())}"`);
    }

    return `<hoverdef ${attrs.join(' ')}>${text.trim()}</hoverdef>`;
  });
}
