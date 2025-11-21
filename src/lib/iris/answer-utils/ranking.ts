/**
 * Ranking utilities for scoring and reranking retrieval results
 */

import { type KBItem } from '@/lib/iris/schema';
import type { Rankings } from '@/lib/iris/rankings';

/**
 * Calculates a technical complexity score for an experience
 * Used to boost technically challenging work in results
 *
 * Factors considered:
 * - AI/ML keywords (document AI, NLP, embeddings, transformers, etc.)
 * - Algorithmic complexity (rule engines, optimization, search algorithms)
 * - Data scale (100k+ records, batch processing, etc.)
 * - Low-level systems (C#/.NET, assembly, hardware)
 *
 * @param doc - The document to score
 * @returns Technical complexity score
 */
export function getTechnicalScore(doc: Partial<KBItem>): number {
  if (!('summary' in doc) || !doc.summary) return 0;

  const text = (doc.summary + ' ' + ('specifics' in doc && Array.isArray(doc.specifics) ? doc.specifics.join(' ') : '')).toLowerCase();

  let score = 0;

  // AI/ML indicators (+3 each)
  if (/(document ai|nlp|embeddings|transformers|faiss|sentence|gpt|neural|deep learning)/i.test(text)) score += 3;

  // Algorithmic complexity (+2 each)
  if (/(algorithm|optimization|rule engine|search|similarity|clustering|matching|pipeline)/i.test(text)) score += 2;

  // Data scale (+2 each)
  if (/(100\+|600k|batch|parallel|throughput|scale|automation)/i.test(text)) score += 2;

  // Low-level/systems programming (+1 each)
  if (/(c#|\.net|assembly|hardware|cpu|memory)/i.test(text)) score += 1;

  return score;
}

/**
 * Reranks results to prioritize technically complex experiences for technical queries
 * Only applies boosting if the query seems technical in nature
 *
 * @param results - The retrieval results to rerank
 * @param query - The user's query
 * @returns Reranked results
 */
export function reranktechnical(results: Array<{ score: number; doc: Partial<KBItem> }>, query: string): Array<{ score: number; doc: Partial<KBItem> }> {
  const queryLower = query.toLowerCase();

  // Check if query is asking about technical work
  const isTechnicalQuery = /(technical|tech|engineer|build|develop|algorithm|ml|ai|data|code|system)/i.test(queryLower);

  if (!isTechnicalQuery) return results; // No reranking needed

  // Boost experiences by their technical score
  return results.map(r => {
    if ('kind' in r.doc && r.doc.kind === 'experience') {
      const techScore = getTechnicalScore(r.doc);
      // Boost score by up to 20% based on technical complexity
      const boost = 1 + (techScore * 0.03);
      return { ...r, score: r.score * boost };
    }
    return r;
  }).sort((a, b) => b.score - a.score); // Re-sort after boosting
}

/**
 * Boosts retrieval results using pre-computed importance rankings
 * Combines semantic similarity score with importance score for evaluative queries
 *
 * @param results - The retrieval results from semantic search
 * @param rankings - Pre-computed importance rankings
 * @param query - The user's query
 * @param isEvaluative - Whether this is an evaluative query ("best", "top", etc.)
 * @returns Reranked results with boosted scores
 */
export function boostWithImportance(
  results: Array<{ score: number; doc: Partial<KBItem> }>,
  rankings: Rankings,
  query: string,
  isEvaluative: boolean
): Array<{ score: number; doc: Partial<KBItem> }> {
  // For evaluative queries, prioritize importance over semantics
  // For non-evaluative queries, keep semantics dominant
  const importanceWeight = isEvaluative ? 0.6 : 0.2;
  const semanticWeight = isEvaluative ? 0.4 : 0.8;

  return results.map(r => {
    // Find importance score for this item
    let importance = 50; // Default middling score if not found

    if ('id' in r.doc && r.doc.id) {
      const itemId = r.doc.id;
      const kind = 'kind' in r.doc ? r.doc.kind : null;

      // Look up importance based on kind
      if (kind === 'project') {
        const ranking = rankings.projects.find(p => p.id === itemId);
        if (ranking) importance = ranking.importance;
      } else if (kind === 'experience') {
        const ranking = rankings.experiences.find(e => e.id === itemId);
        if (ranking) importance = ranking.importance;
      } else if (kind === 'skill') {
        const ranking = rankings.skills.find(s => s.id === itemId);
        if (ranking) importance = ranking.importance;
      } else if (kind === 'class') {
        const ranking = rankings.classes.find(c => c.id === itemId);
        if (ranking) importance = ranking.importance;
      } else if (kind === 'blog') {
        const ranking = rankings.blogs.find(b => b.id === itemId);
        if (ranking) importance = ranking.importance;
      }
    }

    // Normalize importance to 0-1 range (from 0-100)
    const normalizedImportance = importance / 100;

    // Combine semantic score with importance score
    // Semantic score is already 0-1 from cosine similarity
    const boostedScore = (r.score * semanticWeight) + (normalizedImportance * importanceWeight);

    return { ...r, score: boostedScore };
  }).sort((a, b) => b.score - a.score); // Re-sort by boosted scores
}
