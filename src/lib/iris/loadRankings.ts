/**
 * Load pre-computed rankings from derived data
 */

import type { Rankings } from './rankings';
import rankingsData from '@/data/iris/derived/rankings.json';

/**
 * Load rankings (synchronous since it's a static import)
 */
export function loadRankings(): Rankings {
  return rankingsData as Rankings;
}
