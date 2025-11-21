/**
 * Temporal utilities for handling time-based queries and filtering
 */

import { type KBItem } from '@/lib/iris/schema';
import { type TemporalHints } from './types';
import { loadRankings } from '@/lib/iris/loadRankings';

/**
 * Shared helper to extract the most relevant year from a document.
 * This powers temporal boosting, grouping, and clarification prompts.
 *
 * @param doc - The document to extract the year from
 * @returns The primary year or null if not found
 */
export function extractPrimaryYear(doc: Partial<KBItem>): number | null {
  if ('dates' in doc && doc.dates) {
    const anchor = doc.dates.end || doc.dates.start;
    const match = anchor?.match?.(/\d{4}/);
    return match ? parseInt(match[0], 10) : null;
  }

  if ('term' in doc && doc.term) {
    const match = doc.term.match(/\d{4}/);
    if (match) {
      return parseInt(match[0], 10);
    }
  }

  if ('year' in doc && typeof doc.year === 'number') {
    return doc.year;
  }

  return null;
}

/**
 * Parse relative language ("this year", "last year") so filters and rerankers
 * can honor timeframe-sensitive questions without another LLM round-trip.
 *
 * @param query - The user query
 * @returns Temporal hints extracted from the query
 */
export function deriveTemporalHints(query: string): TemporalHints {
  const nowYear = new Date().getFullYear();
  const hints: TemporalHints = { years: [] };
  const lower = query.toLowerCase();

  const addYear = (year: number) => {
    if (!Number.isNaN(year) && !hints.years.includes(year)) {
      hints.years.push(year);
    }
  };

  const explicitYearMatches = query.match(/\b(20\d{2})\b/g);
  if (explicitYearMatches) {
    explicitYearMatches.forEach(match => addYear(parseInt(match, 10)));
  }

  if (/\b(this|current)\s+year\b|\bcurrent(ly)?\b|\bnow\b/.test(lower)) {
    addYear(nowYear);
    hints.relative = hints.relative ?? 'current';
  }

  if (/\bnext\s+year\b|\bupcoming\b/.test(lower)) {
    addYear(nowYear + 1);
    hints.relative = 'upcoming';
  }

  if (/\b(last|previous)\s+year\b|\bpast\s+year\b/.test(lower)) {
    addYear(nowYear - 1);
    hints.relative = 'past';
  }

  if (/\bpast\s+(?:two|couple of)\s+years\b/.test(lower)) {
    addYear(nowYear);
    addYear(nowYear - 1);
    hints.relative = 'recent';
  }

  if (/\brecent\b/.test(lower) && !hints.relative) {
    hints.relative = 'recent';
  }

  return hints;
}

/**
 * Boost retrieval results that align with the requested timeframe so evaluative
 * answers talk about the correct period instead of older highlights.
 *
 * @param results - The retrieval results to boost
 * @param hints - Temporal hints from the query
 * @returns Boosted and re-sorted results
 */
export function applyTemporalBoost(
  results: Array<{ score: number; doc: Partial<KBItem> }>,
  hints: TemporalHints
): Array<{ score: number; doc: Partial<KBItem> }> {
  if (!hints.years.length) {
    return results;
  }

  return results
    .map(result => {
      const docYear = extractPrimaryYear(result.doc);
      if (!docYear) {
        return result;
      }

      const closest = hints.years.reduce((min, year) => Math.min(min, Math.abs(year - docYear)), Infinity);
      const boost =
        closest === 0 ? 1.25 :
        closest === 1 ? 1.12 :
        closest <= 2 ? 1.05 : 1;

      return { ...result, score: result.score * boost };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Reorders filtered items so that the latest work shows up first and
 * ambiguous "list" responses feel intentional.
 *
 * Professional comment: For items with dates (projects, experiences, classes), sort by recency.
 * For items without dates (skills, values, interests), sort by importance ranking instead of alphabetically.
 * This ensures "see Mike's skills" shows top skills first, not alphabetically random ones.
 *
 * @param items - The items to sort
 * @param hints - Temporal hints from the query
 * @returns Sorted items
 */
export function sortItemsForFilter(items: KBItem[], hints: TemporalHints): KBItem[] {
  // Load importance rankings for non-temporal sorting (cached, so fast)
  const rankings = loadRankings();
  const rankingMap = new Map(rankings.all.map(r => [r.id, r.importance]));
  
  return [...items].sort((a, b) => {
    // For items with dates (projects, experiences, classes): sort by recency
    const yearA = extractPrimaryYear(a);
    const yearB = extractPrimaryYear(b);
    
    if (yearA !== null && yearB !== null) {
      // Both have dates - sort by recency
      const yearDiff = yearB - yearA;
      if (yearDiff !== 0) {
        return yearDiff;
      }

      // If same year and temporal hints provided, sort by distance to hint
      if (hints.years.length) {
        const distance = (doc: KBItem) => {
          const year = extractPrimaryYear(doc) ?? 0;
          return hints.years.reduce((min, target) => Math.min(min, Math.abs(target - year)), Infinity);
        };
        const diff = distance(a) - distance(b);
        if (diff !== 0 && Number.isFinite(diff)) {
          return diff;
        }
      }
    } else if (yearA !== null) {
      // Only A has date - prefer A (dated items first)
      return -1;
    } else if (yearB !== null) {
      // Only B has date - prefer B (dated items first)
      return 1;
    }
    
    // For items without dates (skills, values, interests): sort by importance ranking
    const importanceA = rankingMap.get(a.id) ?? 0;
    const importanceB = rankingMap.get(b.id) ?? 0;
    
    if (importanceA !== importanceB) {
      // Higher importance first
      return importanceB - importanceA;
    }

    // Fallback: alphabetical by label
    const label = (doc: KBItem) => {
      if ('title' in doc && doc.title) return doc.title;
      if ('name' in doc && doc.name) return doc.name;
      if ('role' in doc && doc.role) return doc.role;
      return doc.id;
    };

    return label(a).localeCompare(label(b));
  });
}
