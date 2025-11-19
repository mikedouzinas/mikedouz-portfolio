/**
 * Text utilities for normalizing and matching query text
 */

/**
 * Normalizes query text by converting to lowercase, removing diacritics,
 * and standardizing whitespace
 *
 * @param text - The text to normalize
 * @returns Normalized text
 */
export function normalizeQueryText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes a skill token by replacing spaces with underscores
 *
 * @param value - The skill value to normalize
 * @returns Normalized skill token
 */
export function normalizeSkillToken(value: string): string {
  return normalizeQueryText(value).replace(/\s+/g, '_');
}

/**
 * Helper function to check if two strings are similar enough to match
 * Handles singular/plural, word order, and partial matches
 *
 * Professional comment: This enables flexible matching for user queries like
 * "sentence transformer" to match "sentence transformers" or "React" to match "ReactJS"
 *
 * @param search - The search string
 * @param target - The target string to match against
 * @returns True if the strings match closely enough
 */
export function isFuzzyMatch(search: string, target: string): boolean {
  const searchWords = search.split(/\s+/);
  const targetWords = target.split(/\s+/);

  // Exact match
  if (search === target) return true;

  // One contains the other
  if (target.includes(search) || search.includes(target)) return true;

  // Check if all search words are present in target (handles word order)
  const allWordsPresent = searchWords.every(sw =>
    targetWords.some(tw => {
      if (sw === tw) return true;
      const longEnough = sw.length >= 3 && tw.length >= 3;
      return longEnough && (tw.includes(sw) || sw.includes(tw));
    })
  );
  if (allWordsPresent) return true;

  // Handle plural/singular by checking if words match except for trailing 's'
  const searchStripped = search.endsWith('s') ? search.slice(0, -1) : search;
  const targetStripped = target.endsWith('s') ? target.slice(0, -1) : target;
  if (searchStripped === targetStripped) return true;
  const strippedLongEnough =
    searchStripped.length >= 3 && targetStripped.length >= 3;
  if (strippedLongEnough && (target.includes(searchStripped) || search.includes(targetStripped))) return true;

  return false;
}

/**
 * Escapes double quotes in attribute values for HTML/XML
 *
 * @param value - The value to escape
 * @returns Escaped value
 */
export function escapeAttribute(value: string): string {
  return value.replace(/"/g, '&quot;');
}
