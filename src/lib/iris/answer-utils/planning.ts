/**
 * Planning utilities for query routing and result expansion
 */

import { type KBItem } from '@/lib/iris/schema';
import { type Intent, type AutoContactPlan, type AliasEntry } from './types';
import { buildContactDraft } from './responses';
import { extractPrimaryYear } from './temporal';

/**
 * Regex for detecting comparison queries
 */
const COMPARISON_REGEX = /\b(compare|comparison|versus|vs\.?|before|after|previous|next|difference)\b/i;

/**
 * Pre-routing function for fast evaluative/list query detection
 * Routes evaluative queries (best/strongest/what makes) to general intent
 * Routes explicit list queries to filter_query intent
 * Returns null if query should be processed by LLM classifier
 *
 * Professional comment: This fast pre-routing improves latency by avoiding
 * LLM calls for obvious patterns, and ensures evaluative queries get proper
 * semantic search treatment rather than being misclassified.
 *
 * @param query - The user's query
 * @returns Intent if pre-routed, null otherwise
 */
export function preRoute(query: string): Intent | null {
  // Regex patterns for evaluative/comparative language
  const EVAL_REGEX = /\b(best|strongest|top|most|unique|what makes|why should|why .* hire|biggest|differen(t|ce))\b/i;

  // Regex patterns for explicit list queries
  const LIST_REGEX = /\b(list|show (me )?all|every|enumerate)\b/i;

  // Check for list queries first (more specific pattern)
  if (LIST_REGEX.test(query)) {
    return 'filter_query';
  }

  // Check for evaluative queries
  if (EVAL_REGEX.test(query)) {
    return 'general';
  }

  // No pre-routing match - defer to LLM classifier
  return null;
}

/**
 * Plans automatic contact suggestions based on query patterns
 *
 * @param query - The user's query
 * @param intent - The detected intent
 * @returns Auto-contact plan or null if not applicable
 */
export function planAutoContact(query: string, intent: Intent): AutoContactPlan | null {
  if (intent === 'contact') return null;
  const lower = query.toLowerCase();
  const draft = buildContactDraft(query);

  if (/\b(future|upcoming|next|later)\b.*\bplan(s)?\b|\broadmap\b/.test(lower)) {
    return {
      reason: 'insufficient_context',
      draft,
      preface: "Mike hasn't shared his future plans publicly yet, so I teed up a note you can send him directly.",
      open: 'auto'
    };
  }

  if (/\b(thoughts?|opinion|stance|favorite|favourite)\b/.test(lower)) {
    return {
      reason: 'insufficient_context',
      draft,
      preface: "He hasn't published personal opinions on that, so I prepared a quick draft if you'd like to ask him yourself.",
      open: 'auto'
    };
  }

  if (/\b(collaborate|partner|hire|bring (him|you) on|consult|speaking|speaker|panel|work with|work together)\b/.test(lower)) {
    return {
      reason: 'more_detail',
      draft,
      preface: "I can connect you two directly so you can discuss the opportunity.",
      open: 'auto'
    };
  }

  if (/\bavailability\b|\bavailable\b|\bwork authorization\b|\bvisa\b|\bwhere\b.*\bbased\b/.test(lower)) {
    return {
      reason: 'more_detail',
      draft,
      preface: "If you'd like to confirm details or kick off a conversation, I queued up a quick message you can send.",
      open: 'auto'
    };
  }

  return null;
}

/**
 * Checks if the query needs comparison data (before/after, versus, etc.)
 *
 * @param query - The user's query
 * @returns True if comparison is needed
 */
export function needsComparisonQuery(query: string): boolean {
  return COMPARISON_REGEX.test(query);
}

/**
 * Expands results for comparative queries by adding related items
 * Adds items from adjacent years when query asks for before/after comparison
 *
 * @param query - The user's query
 * @param results - Current retrieval results
 * @param allItems - All KB items
 * @param aliasMatches - Matched aliases
 * @returns Expanded results
 */
export function expandResultsForComparativeQuery(
  query: string,
  results: Array<{ score: number; doc: Partial<KBItem> }>,
  allItems: KBItem[],
  aliasMatches: AliasEntry[]
): Array<{ score: number; doc: Partial<KBItem> }> {
  if (!needsComparisonQuery(query)) {
    return results;
  }

  const seen = new Set<string>();
  const unique: Array<{ score: number; doc: Partial<KBItem> }> = [];

  const keyForDoc = (doc: Partial<KBItem>): string => {
    if (doc.id) return doc.id;
    if ('title' in doc && doc.title) return doc.title;
    if ('name' in doc && doc.name) return doc.name;
    if ('role' in doc && doc.role) return doc.role;
    return JSON.stringify(doc);
  };

  results.forEach(result => {
    const key = keyForDoc(result.doc);
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(result);
  });

  let scoreSeed = unique.length > 0 ? Math.min(...unique.map(r => r.score)) : 1;
  const pushDoc = (doc: Partial<KBItem>) => {
    const key = keyForDoc(doc);
    if (seen.has(key)) return;
    scoreSeed -= 0.0005;
    unique.push({ score: scoreSeed, doc });
    seen.add(key);
  };

  const itemsById = new Map(allItems.map(item => [item.id, item]));
  const aliasDocs = aliasMatches
    .map(match => itemsById.get(match.id))
    .filter((doc): doc is KBItem => !!doc);

  aliasDocs.forEach(doc => pushDoc(doc));

  const anchorDoc = aliasDocs[0] ?? unique[0]?.doc;
  const anchorYear = anchorDoc ? extractPrimaryYear(anchorDoc) : null;

  if (!anchorYear) {
    return unique;
  }

  const comparisonPool = allItems.filter(item => item.kind === 'experience' || item.kind === 'project');

  const addDocsForYear = (year: number) => {
    comparisonPool
      .filter(item => extractPrimaryYear(item) === year)
      .sort((a, b) => {
        const nameA = ('title' in a && a.title) || ('role' in a && a.role) || a.id;
        const nameB = ('title' in b && b.title) || ('role' in b && b.role) || b.id;
        return nameA.localeCompare(nameB);
      })
      .forEach(item => pushDoc(item));
  };

  if (/\b(before|previous|prior|last)\b/i.test(query)) {
    addDocsForYear(anchorYear - 1);
  }
  if (/\b(after|next|following|upcoming)\b/i.test(query)) {
    addDocsForYear(anchorYear + 1);
  }

  return unique;
}
