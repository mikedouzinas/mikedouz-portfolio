/**
 * Shared display metadata for THE HARLEQUIN board:
 * priority/status colors and heuristic tag suggestions.
 */
import type { Priority, Status } from './github';

/** Google palette, reused as a recurring accent throughout the console. */
export const GOOGLE_COLORS = ['#4285F4', '#EA4335', '#FBBC05', '#34A853'] as const;

export const PRIORITY_META: Record<Priority, { short: string; label: string; color: string }> = {
  p1: { short: 'P1', label: 'P1 · Critical', color: '#EA4335' }, // red
  p2: { short: 'P2', label: 'P2 · High', color: '#FB923C' }, // orange
  p3: { short: 'P3', label: 'P3 · Medium', color: '#FBBC05' }, // yellow
  p4: { short: 'P4', label: 'P4 · Low', color: '#34A853' }, // green
  p5: { short: 'P5', label: 'P5 · Someday', color: '#4285F4' }, // blue
};

export const STATUS_META: Record<Status, { label: string; color: string }> = {
  todo: { label: 'Todo', color: '#9AA0A6' }, // gray
  'in progress': { label: 'In progress', color: '#FBBC05' }, // amber
};

const TAG_RULES: { tag: string; color: string; re: RegExp }[] = [
  { tag: 'ui', color: '#4285F4', re: /\b(ui|design|theme|button|dropdown|dashboard|colou?r|layout|card|portal|harlequin|wordmark)\b/i },
  { tag: 'security', color: '#EA4335', re: /\b(security|lockout|auth|password|pin|session|token|brute|csrf|rate.?limit)\b/i },
  { tag: 'infra', color: '#34A853', re: /\b(supabase|redis|upstash|vercel|env|deploy|deployment|migration|infra|cron)\b/i },
  { tag: 'docs', color: '#FBBC05', re: /\b(kb|docs|readme|skill|documentation|knowledge.?base)\b/i },
  { tag: 'data', color: '#A142F4', re: /\b(import|importer|seed|launchpad|links?|data|schema)\b/i },
  { tag: 'ux', color: '#24C1E0', re: /\b(shortcut|keyboard|mobile|gesture|long.?press|tap|accessib|navigation|back arrow)\b/i },
];

/** Heuristic "suggested tags" derived from an item's title + body. */
export function suggestTags(title: string, body: string): { tag: string; color: string }[] {
  const text = `${title} ${body}`;
  const out: { tag: string; color: string }[] = [];
  for (const rule of TAG_RULES) {
    if (rule.re.test(text)) out.push({ tag: rule.tag, color: rule.color });
  }
  return out.slice(0, 3);
}
