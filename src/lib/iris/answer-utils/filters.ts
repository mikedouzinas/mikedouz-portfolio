/**
 * Filter utilities for structured KB queries
 */

import { type KBItem } from '@/lib/iris/schema';
import { type QueryFilter, type AliasEntry } from './types';
import { normalizeQueryText, normalizeSkillToken } from './text';
import { resolveSkillNamesToIds } from './aliases';

/**
 * Ensures a type is present in the filter's type array
 *
 * @param next - The filter object to modify
 * @param type - The type to ensure is present
 */
export function ensureType(next: QueryFilter, type: NonNullable<QueryFilter['type']>[number]) {
  if (!next.type) {
    next.type = [type];
    return;
  }
  if (!next.type.includes(type)) {
    next.type = [...next.type, type];
  }
}

/**
 * Merges two filter objects, combining arrays and overriding primitives
 *
 * @param base - The base filter
 * @param extra - The filter to merge in
 * @returns Merged filter
 */
export function mergeFilters(base: QueryFilter | undefined, extra: QueryFilter): QueryFilter {
  if (!base) return { ...extra };
  const merged: QueryFilter = { ...base };

  const mergeArray = <T>(field: keyof QueryFilter, values?: T[]) => {
    if (!values || values.length === 0) return;
    const current = new Set((merged[field] as T[] | undefined) ?? []);
    values.forEach(value => {
      if (value !== undefined && value !== null) current.add(value);
    });
    merged[field] = Array.from(current) as never;
  };

  mergeArray('type', extra.type);
  mergeArray('skills', extra.skills);
  mergeArray('company', extra.company);
  mergeArray('year', extra.year);
  mergeArray('tags', extra.tags);

  if (extra.title_match) {
    merged.title_match = extra.title_match;
  }
  if (extra.operation) {
    merged.operation = extra.operation;
  }
  if (extra.show_all) {
    merged.show_all = true;
  }

  return merged;
}

/**
 * Derives filter defaults from query patterns and alias matches
 *
 * @param query - The user query
 * @param filters - Existing filters
 * @param aliasMatches - Matched aliases
 * @returns Updated filters or original if no changes
 */
export function deriveFilterDefaults(
  query: string,
  filters: QueryFilter | undefined,
  aliasMatches: AliasEntry[]
): QueryFilter | undefined {
  const normalized = normalizeQueryText(query);
  let mutated = false;
  const next: QueryFilter = filters ? { ...filters } : {};

  if (/\b(list|show|give me|display|enumerate|all|every|everything)\b/.test(normalized)) {
    if (!next.show_all) {
      next.show_all = true;
      mutated = true;
    }
  }

  if (/\bskill(s)?\b|\btech\b|\btechnology\b|\bstack\b|\blanguage(s)?\b|\btools?\b/.test(normalized)) {
    ensureType(next, 'skill');
    mutated = true;
  }

  if (/\bproject(s)?\b/.test(normalized)) {
    ensureType(next, 'project');
    mutated = true;
  }

  if (/\bexperience(s)?\b|\bwork\b|\brole(s)?\b|\bjob(s)?\b|\bintern(ship|ships)?\b/.test(normalized)) {
    ensureType(next, 'experience');
    mutated = true;
  }

  if (/\bclass(es)?\b|\bcourse(s)?\b/.test(normalized)) {
    ensureType(next, 'class');
    mutated = true;
  }

  // Company detection via alias matches
  const companyMatches = aliasMatches
    .filter(match => match.type === 'experience')
    .map(match => match.name)
    .filter(Boolean);

  if (companyMatches.length > 0) {
    ensureType(next, 'experience');
    const existing = new Set(next.company ?? []);
    companyMatches.forEach(name => existing.add(name));
    next.company = Array.from(existing);
    mutated = true;
  }

  // Specific item detection via aliases
  if (!next.title_match) {
    const specificMatch = aliasMatches.find(match => match.type === 'project' || match.type === 'experience');
    if (specificMatch) {
      next.title_match = specificMatch.name;
      mutated = true;
    }
  }

  if (next.type?.includes('skill') && next.show_all !== false) {
    if (!next.show_all) mutated = true;
    next.show_all = true;
  }

  return mutated ? next : filters;
}

/**
 * Detects profile-related filters from query patterns
 *
 * @param query - The user query
 * @returns Profile filters or null if no profile patterns detected
 */
export function detectProfileFilter(query: string): QueryFilter | null {
  const normalized = normalizeQueryText(query);
  const filters: QueryFilter = {};
  let matched = false;

  const ensureTypes = (types: Array<NonNullable<QueryFilter['type']>[number]>) => {
    filters.type = filters.type ? Array.from(new Set([...filters.type, ...types])) : types;
    filters.show_all = true;
  };

  if (/\bavailability\b|\bavailable\b|\bopen to\b/.test(normalized)) {
    ensureTypes(['bio']);
    matched = true;
  }

  if (/\bwork authorization\b|\bvisa\b|\bwork permit\b|\bcitizen(ship)?\b/.test(normalized)) {
    ensureTypes(['bio']);
    matched = true;
  }

  if (/\blocation\b|\bwhere\b.*\b(based|located)\b|\bwhat city\b/.test(normalized)) {
    ensureTypes(['bio']);
    matched = true;
  }

  if (/\blanguage(s)?\b|\bspeak\b|\bfluency\b/.test(normalized)) {
    ensureTypes(['bio']);
    matched = true;
  }

  if (/\bwhat\b.*\bmakes\b.*\b(mike|him)\b.*\b(special|unique)\b/.test(normalized) || /\bunique\b.*\babout\b.*\bmike\b/.test(normalized)) {
    ensureTypes(['bio', 'value', 'story']);
    matched = true;
  }

  return matched ? filters : null;
}

/**
 * Applies structured filters to KB items
 * Enables precise queries like "all Python projects" or "2024 experiences"
 *
 * @param items - All KB items to filter
 * @param filters - Structured filters from intent detection
 * @returns Filtered items matching all criteria
 *
 * Professional comment: We keep a reference to the original unfiltered items
 * to enable skill name resolution even after type filtering has been applied.
 */
export function applyFilters(items: KBItem[], filters: QueryFilter): KBItem[] {
  const allItems = items; // Keep reference to all items for skill resolution
  let filtered = items;

  // Filter by document type
  if (filters.type && filters.type.length > 0) {
    filtered = filtered.filter(item => filters.type!.includes(item.kind));
  }

  // Filter by title match (for specific item queries)
  if (filters.title_match) {
    const searchTitle = filters.title_match.toLowerCase();
    filtered = filtered.filter(item => {
      // Check title field
      if ('title' in item && item.title) {
        return item.title.toLowerCase().includes(searchTitle);
      }
      // Check role/company for experiences
      if ('role' in item && item.role) {
        const fullTitle = `${item.role} ${item.company || ''}`.toLowerCase();
        return fullTitle.includes(searchTitle);
      }
      // Check value/interest names
      if ('value' in item && item.value) {
        return item.value.toLowerCase().includes(searchTitle);
      }
      if ('interest' in item && item.interest) {
        return item.interest.toLowerCase().includes(searchTitle);
      }
      return false;
    });
  }

  // Filter by skills (works for any item with skills field)
  // Professional comment: Resolves skill names to IDs before matching, enabling
  // queries like "projects using Framer Motion" to match items with "framer_motion" ID
  if (filters.skills && filters.skills.length > 0) {
    // Resolve skill names to canonical IDs using the KB
    // Use allItems (not filtered) to ensure skills are available for resolution
    const resolvedSkillIds = resolveSkillNamesToIds(filters.skills, allItems);

    // If no skills resolved, fall back to normalized direct matches
    const searchSkills = resolvedSkillIds.length > 0
      ? resolvedSkillIds.map(normalizeSkillToken)
      : filters.skills.map(normalizeSkillToken);

    filtered = filtered.filter(item => {
      if (!('skills' in item) || !Array.isArray(item.skills)) return false;

      const itemSkills = item.skills.map(skill => normalizeSkillToken(skill));

      if (filters.operation === 'exact') {
        return searchSkills.every(s => itemSkills.includes(s));
      } else {
        return searchSkills.some(s => itemSkills.includes(s));
      }
    });
  }

  // Filter by company (experiences)
  if (filters.company && filters.company.length > 0) {
    filtered = filtered.filter(item => {
      if (!('company' in item) || !item.company) return false;

      const company = item.company.toLowerCase();
      const searchCompanies = filters.company!.map(c => c.toLowerCase());

      return searchCompanies.some(c => company.includes(c));
    });
  }

  // Filter by year (extract from dates field or term field)
  // Note: We prioritize date ranges to check if the year falls within the project/experience period
  if (filters.year && filters.year.length > 0) {
    filtered = filtered.filter(item => {
      // Check start/end dates for projects and experiences
      // A year matches if it falls within the start-end range
      if ('dates' in item && item.dates) {
        const startYear = parseInt(item.dates.start.split('-')[0]);
        const endYear = item.dates.end ? parseInt(item.dates.end.split('-')[0]) : new Date().getFullYear();

        return filters.year!.some(y => y >= startYear && y <= endYear);
      }

      // Check term field for classes (e.g., "Spring 2025")
      if ('term' in item && item.term && typeof item.term === 'string') {
        const yearMatch = item.term.match(/\d{4}/);
        if (yearMatch) {
          const year = parseInt(yearMatch[0]);
          return filters.year!.includes(year);
        }
      }

      return false;
    });
  }

  // Filter by tags
  if (filters.tags && filters.tags.length > 0) {
    filtered = filtered.filter(item => {
      if (!('tags' in item) || !Array.isArray(item.tags)) return false;

      const itemTags = item.tags.map(t => t.toLowerCase());
      const searchTags = filters.tags!.map(t => t.toLowerCase());

      if (filters.operation === 'exact') {
        return searchTags.every(t => itemTags.includes(t));
      } else if (filters.operation === 'any') {
        return searchTags.some(t => itemTags.includes(t));
      } else { // 'contains'
        return searchTags.some(t => itemTags.some(it => it.includes(t)));
      }
    });
  }

  return filtered;
}

/**
 * Merges temporal hints into structured filters
 *
 * @param filters - Existing filters
 * @param hints - Temporal hints to merge
 * @returns Updated filters or original if no changes
 */
export function applyTemporalHintsToFilters(
  filters: QueryFilter | undefined,
  hints: { years: number[]; relative?: string }
): QueryFilter | undefined {
  if (!hints.years.length) {
    return filters;
  }

  const nextFilters: QueryFilter = filters ? { ...filters } : {};
  const existingYears = new Set(nextFilters.year || []);
  hints.years.forEach(year => existingYears.add(year));
  nextFilters.year = Array.from(existingYears);
  return nextFilters;
}
