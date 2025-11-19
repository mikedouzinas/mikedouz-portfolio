/**
 * Ranking utilities for scoring and reranking retrieval results
 */

import { type KBItem } from '@/lib/iris/schema';

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
