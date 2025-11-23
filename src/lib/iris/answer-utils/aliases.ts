/**
 * Alias resolution utilities for matching entity names
 */

import { type KBItem } from '@/lib/iris/schema';
import { loadSkills } from '@/lib/iris/load';
import { type AliasEntry } from './types';
import { normalizeQueryText, isFuzzyMatch } from './text';

/**
 * Collects all alias matches from the query
 *
 * @param query - The user query
 * @param aliasIndex - The alias index to search
 * @returns Array of matching alias entries
 */
export function collectAliasMatches(query: string, aliasIndex: AliasEntry[]): AliasEntry[] {
  const normalizedQuery = normalizeQueryText(query);
  return aliasIndex.filter(entry => matchesAlias(normalizedQuery, entry));
}

/**
 * Checks if a normalized query matches an alias entry
 *
 * @param normalizedQuery - The normalized query string
 * @param entry - The alias entry to check
 * @returns True if the query matches the alias
 * 
 * Professional comment: This function handles both exact substring matches and token-based matching.
 * For short aliases (like "Lilie"), it checks for exact substring inclusion. For longer names,
 * it also checks if significant tokens (4+ characters) appear in the query to handle partial matches.
 */
export function matchesAlias(normalizedQuery: string, entry: AliasEntry): boolean {
  const candidates = [entry.name, ...(entry.aliases || [])];
  return candidates.some(candidate => {
    const normalizedCandidate = normalizeQueryText(candidate || '');
    if (!normalizedCandidate) return false;
    
    // Professional comment: Check for exact substring match first (handles "Lilie" in "whats lilie")
    if (normalizedQuery.includes(normalizedCandidate)) {
      return true;
    }
    
    // Professional comment: For multi-word candidates, check if the query contains significant tokens
    // This handles cases like "Liu Idea Lab" matching "liu idea lab" in complex queries
    const tokens = normalizedCandidate.split(' ').filter(token => token.length >= 4);
    if (tokens.length > 0) {
      return tokens.some(token => normalizedQuery.includes(token));
    }
    
    // Professional comment: For short single-word aliases (like "Lilie"), also check if the alias
    // appears as a standalone word or as part of a longer phrase
    if (normalizedCandidate.length >= 4) {
      // Check if the alias appears as a word boundary (handles "lilie" in "worked for lilie")
      const wordBoundaryRegex = new RegExp(`\\b${normalizedCandidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      return wordBoundaryRegex.test(normalizedQuery);
    }
    
    return false;
  });
}

/**
 * Resolves skill names/aliases to their canonical skill IDs
 * Handles fuzzy matching for names like "framer motion" → "framer_motion"
 *
 * @param skillNames - Array of skill names or aliases from user query
 * @param allItems - All KB items (includes skills with kind: "skill")
 * @returns Array of matching skill IDs
 *
 * Professional comment: This function enables users to query by skill names
 * (e.g., "Framer Motion") instead of requiring exact ID matches (e.g., "framer_motion").
 * It fuzzy-matches against skill names, IDs, and aliases to maximize query success.
 */
export function resolveSkillNamesToIds(skillNames: string[], allItems: KBItem[]): string[] {
  // Extract all skills from KB items
  const skills = allItems.filter(item => item.kind === 'skill') as Array<KBItem & {
    id: string;
    name: string;
    aliases?: string[];
  }>;

  const resolvedIds = new Set<string>();

  for (const searchName of skillNames) {
    const searchLower = searchName.toLowerCase().trim();

    for (const skill of skills) {
      // Match against skill ID (with underscores or hyphens normalized to spaces)
      const skillIdNormalized = skill.id.toLowerCase().replace(/[_-]/g, ' ');

      // Match against skill name
      const skillNameLower = skill.name.toLowerCase();

      // Match against aliases
      const aliasesLower = (skill.aliases || []).map(a => a.toLowerCase());

      // Check if search matches ID, name, or any alias using fuzzy matching
      if (
        isFuzzyMatch(searchLower, skillIdNormalized) ||
        isFuzzyMatch(searchLower, skillNameLower) ||
        aliasesLower.some(alias => isFuzzyMatch(searchLower, alias))
      ) {
        resolvedIds.add(skill.id);
      }
    }
  }

  return Array.from(resolvedIds);
}

/**
 * Builds a skill name map for resolving skill IDs to display names
 * Creates a lookup map from skill ID to skill name for fast resolution
 *
 * Professional comment: This function resolves skill IDs (e.g., "python", "react")
 * to their proper names (e.g., "Python", "React") so Iris responses use readable names
 * instead of technical IDs.
 *
 * @returns Map of skill ID to skill name
 */
export async function buildSkillNameMap(): Promise<Map<string, string>> {
  const skills = await loadSkills();
  const skillMap = new Map<string, string>();
  for (const skill of skills) {
    skillMap.set(skill.id.toLowerCase(), skill.name);
  }
  return skillMap;
}

/**
 * Resolves an array of skill IDs to their display names
 * Falls back to the ID if no match is found
 *
 * @param skillIds - Array of skill IDs
 * @param skillMap - Map of skill ID to skill name
 * @returns Array of skill names
 */
export function resolveSkillIdsToNames(skillIds: string[], skillMap: Map<string, string>): string[] {
  return skillIds.map(id => {
    const name = skillMap.get(id.toLowerCase());
    return name || id; // Fallback to ID if not found
  });
}
