/**
 * Smart sort for THE HARLEQUIN board (#36).
 *
 * Blends the board's signals into one 0–100 composite so "what's shown first"
 * reflects what actually matters, mirroring the spirit of Iris's rankings.ts
 * importance scores. It's an opt-in sort option next to Priority | Recent |
 * Size — never a silent override of the explicit choice.
 *
 * Signals and weights:
 *   - Priority (50%): p1 → 100 … p5 → 20; unlabeled counts as p3.
 *   - Recency (30%): exponential decay on updatedAt with a 7-day half-life,
 *     so stale items sink smoothly instead of falling off a cliff.
 *   - Size (20%): quick-win bias — S surfaces first (S=100, M=60, L=30),
 *     the opposite of the plain Size sort's "most demanding first".
 *
 * Live commit activity (the ticket's optional fourth signal) is deliberately
 * not blended client-side — it needs per-repo listCommits() calls; wire it in
 * server-side if it earns its keep.
 */
import type { DevIssue, Priority, Size } from './github';

const PRIORITY_SCORE: Record<Priority, number> = { p1: 100, p2: 80, p3: 60, p4: 40, p5: 20 };
const SIZE_SCORE: Record<Size, number> = { S: 100, M: 60, L: 30 };

const HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;

const W_PRIORITY = 0.5;
const W_RECENCY = 0.3;
const W_SIZE = 0.2;

/** 100 for "touched just now", 50 at one week untouched, → 0 as it goes stale. */
export function recencyScore(updatedAt: string, nowMs: number): number {
  const age = nowMs - Date.parse(updatedAt);
  if (!Number.isFinite(age) || age <= 0) return 100;
  return 100 * Math.pow(0.5, age / HALF_LIFE_MS);
}

/** Composite 0–100 importance for one board item. */
export function smartScore(issue: DevIssue, nowMs = Date.now()): number {
  const priority = PRIORITY_SCORE[issue.priority ?? 'p3'];
  const recency = recencyScore(issue.updatedAt, nowMs);
  const size = SIZE_SCORE[issue.size ?? 'M'];
  return W_PRIORITY * priority + W_RECENCY * recency + W_SIZE * size;
}

/**
 * Sort board items by composite score, highest first. `nowMs` is captured once
 * per call so a render pass scores every card against the same clock.
 */
export function smartSort(items: DevIssue[], nowMs = Date.now()): DevIssue[] {
  const scored = items.map((issue) => ({ issue, score: smartScore(issue, nowMs) }));
  scored.sort(
    (a, b) => b.score - a.score || b.issue.updatedAt.localeCompare(a.issue.updatedAt),
  );
  return scored.map((s) => s.issue);
}
