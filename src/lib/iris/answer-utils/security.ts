/**
 * Security utilities for detecting malicious or off-topic queries
 */

import { type KBItem } from '@/lib/iris/schema';

/**
 * Regex pattern for detecting prompt injection attempts
 */
const PROMPT_INJECTION_REGEX = /(ignore|forget|bypass|override)\b[^.]*\b(instruction|rule|system prompt)/i;

/**
 * Patterns for detecting clearly off-topic queries
 */
const OFF_TOPIC_PATTERNS = [
  /\bcapital of\b/i,
  /\bweather\b/i,
  /\bstock\b/i,
  /\bcrypto\b/i,
  /\bnews\b/i,
  /\bjoke\b/i,
  /\briddle\b/i,
  /\bpoem\b/i,
  /\bmovie\b/i,
  /\bcelebrity\b/i,
  /\b2\s*\+\s*2\b/,
  /\btranslate\b/i,
  /\brandom\b/i,
];

/**
 * Detects potential prompt injection attempts in the query
 *
 * @param query - The user's query
 * @returns True if prompt injection is detected
 */
export function detectPromptInjection(query: string): boolean {
  return PROMPT_INJECTION_REGEX.test(query);
}

/**
 * Build a set of context entities from the knowledge base
 * This is mutable and updates when KB content changes
 * Extracts: companies, schools, project titles, skills, blog titles, and aliases
 *
 * Professional comment: Includes aliases so queries like "what is iris?" are recognized
 * as valid even when "Iris" is an alias rather than the full project title.
 *
 * @param items - All KB items
 * @returns Set of entity names in lowercase
 */
export function buildContextEntities(items: KBItem[]): Set<string> {
  const entities = new Set<string>();

  for (const item of items) {
    // Add project titles
    if (item.kind === 'project' && 'title' in item && item.title) {
      entities.add(item.title.toLowerCase());
    }

    // Add company names
    if ('company' in item && item.company) {
      entities.add(item.company.toLowerCase());
    }

    // Add school names
    if ('school' in item && item.school) {
      entities.add(item.school.toLowerCase());
    }

    // Add technologies/skills (top level ones)
    if ('skills' in item && Array.isArray(item.skills)) {
      item.skills.forEach(skill => entities.add(skill.toLowerCase()));
    }

    // Add blog/story titles
    if ((item.kind === 'blog' || item.kind === 'story') && 'title' in item && item.title) {
      entities.add(item.title.toLowerCase());
    }

    // Add aliases for all item types (projects, experiences, classes, etc.)
    // This allows queries like "what is iris?" to be recognized when "Iris" is an alias
    if ('aliases' in item && Array.isArray(item.aliases)) {
      item.aliases.forEach(alias => entities.add(alias.toLowerCase()));
    }
  }

  return entities;
}

/**
 * Checks if a query is clearly off-topic based on patterns and context entities
 *
 * @param query - The user's query
 * @param contextEntities - Set of valid entities from the KB
 * @returns True if the query is off-topic
 */
export function isClearlyOffTopic(query: string, contextEntities: Set<string>): boolean {
  const lowerQuery = query.toLowerCase();

  // Allow queries that mention any entity in the knowledge base
  // This makes the system automatically adapt to KB content
  for (const entity of contextEntities) {
    if (lowerQuery.includes(entity)) {
      return false; // NOT off-topic
    }
  }

  // Otherwise, check against off-topic patterns
  return OFF_TOPIC_PATTERNS.some(pattern => pattern.test(query));
}
