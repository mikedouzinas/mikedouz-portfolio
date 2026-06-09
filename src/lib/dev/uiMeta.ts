/**
 * Shared display metadata for THE HARLEQUIN board: priority, status, and
 * t-shirt-size colors. (The old regex "suggested tags" system was removed —
 * size is the meaningful axis now, set explicitly per ticket.)
 */
import type { Priority, Status, Size } from './github';

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
  todo: { label: 'Todo', color: '#4285F4' }, // blue
  'in progress': { label: 'In progress', color: '#FBBC05' }, // amber
};

export const SIZE_META: Record<Size, { short: string; label: string; color: string }> = {
  S: { short: 'S', label: 'S · Small', color: '#4285F4' }, // blue — quick win
  M: { short: 'M', label: 'M · Medium', color: '#FBBC05' }, // yellow
  L: { short: 'L', label: 'L · Large', color: '#FB923C' }, // orange — deep work
};
