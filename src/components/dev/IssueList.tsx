'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, CheckSquare, ChevronDown, Copy, Square } from 'lucide-react';
import type { DevIssue, DevRepo, Priority, Size, Status } from '@/lib/dev/github';
import { PRIORITY_META, SIZE_META, STATUS_META } from '@/lib/dev/uiMeta';
import { addSubtask, parseSubtasks, subtaskProgress, toggleSubtask } from '@/lib/dev/subtasks';
import { buildClaudePrompt } from '@/lib/dev/copy';
import { Dropdown } from '@/components/ui/Dropdown';
import { Button } from '@/components/ui/Button';
import { CopyForClaude } from './CopyForClaude';

export type GroupBy = 'status' | 'repo';
export type SortBy = 'priority' | 'recent' | 'size';

const PRIORITY_OPTS = (['p1', 'p2', 'p3', 'p4', 'p5'] as Priority[]).map((p) => ({
  value: p,
  label: PRIORITY_META[p].label,
  color: PRIORITY_META[p].color,
}));
const STATUS_OPTS = (['todo', 'in progress'] as Status[]).map((s) => ({
  value: s,
  label: STATUS_META[s].label,
  color: STATUS_META[s].color,
}));
const SIZE_OPTS = (['S', 'M', 'L'] as Size[]).map((s) => ({
  value: s,
  label: SIZE_META[s].label,
  color: SIZE_META[s].color,
}));

type PatchBody = {
  priority?: Priority;
  status?: Status;
  size?: Size;
  state?: 'open' | 'closed';
  body?: string;
};

/** One green for everything "done" — the Done lane dot and the expand tint. */
const DONE_GREEN = '#1DB954';

// Expanded-card tint keyed by status, so the lift colour tells you where a
// ticket stands at a glance: blue = todo, amber = in progress, and the
// original Spotify-panel green = done. Same dark-tint-of-the-accent recipe.
const STATUS_EXPAND: Record<'todo' | 'in progress' | 'done', { bg: string; border: string }> = {
  todo: { bg: '#0b1322', border: 'rgba(66, 133, 244, 0.40)' }, // blue
  'in progress': { bg: '#1a1607', border: 'rgba(251, 188, 5, 0.40)' }, // amber
  done: { bg: '#0a1a13', border: 'rgba(29, 185, 84, 0.40)' }, // Spotify green
};

/** Size sort order — largest first, matching "most demanding first" like priority. */
const SIZE_RANK: Record<Size, number> = { L: 0, M: 1, S: 2 };

function SizeChip({ size }: { size: Size }) {
  const s = SIZE_META[size];
  return (
    <span
      className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded px-1 text-[10px] font-semibold leading-none"
      style={{ color: s.color, backgroundColor: `${s.color}1f`, border: `1px solid ${s.color}55` }}
      title={s.label}
    >
      {s.short}
    </span>
  );
}

function IssueCard({
  issue,
  repoName,
  onPatch,
}: {
  issue: DevIssue;
  repoName: string;
  onPatch: (issue: DevIssue, body: PatchBody) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showDetail, setShowDetail] = useState(false); // mounted through the close tween, then dropped
  const [dropUp, setDropUp] = useState(false);
  const [addText, setAddText] = useState('');
  const [copiedSub, setCopiedSub] = useState<number | null>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const pr = PRIORITY_META[issue.priority ?? 'p3'];
  const size = issue.size ?? 'M';
  const closed = issue.state === 'closed';
  // Closed items read as "Done" (green) regardless of their lingering status label.
  const st = closed ? { label: 'Done', color: DONE_GREEN } : STATUS_META[issue.status ?? 'todo'];
  const expandKey: 'todo' | 'in progress' | 'done' = closed ? 'done' : issue.status ?? 'todo';
  const tint = STATUS_EXPAND[expandKey];
  const subs = parseSubtasks(issue.body);
  const prog = subtaskProgress(issue.body);

  // The card lifts out of its slot (absolute) so neighbors don't reflow. For the
  // bottom row that would overflow past the workpad backdrop, so when there isn't
  // room below we anchor to the slot's bottom and grow upward instead.
  function toggle() {
    if (!open) {
      if (slotRef.current) {
        const { top } = slotRef.current.getBoundingClientRect();
        const ESTIMATED_EXPANDED = 420; // header + title + body + subtasks + actions
        setDropUp(window.innerHeight - top < ESTIMATED_EXPANDED);
      }
      setShowDetail(true);
      setOpen(true);
    } else {
      setOpen(false); // keep the detail mounted so the collapse animates; drop it on complete
    }
  }

  async function copySubtask(text: string, index: number) {
    try {
      await navigator.clipboard.writeText(buildClaudePrompt(issue, text));
      setCopiedSub(index);
      setTimeout(() => setCopiedSub((c) => (c === index ? null : c)), 1500);
    } catch {
      // Clipboard unavailable — no-op.
    }
  }

  function submitSubtask(e: React.FormEvent) {
    e.preventDefault();
    const t = addText.trim();
    if (!t) return;
    onPatch(issue, { body: addSubtask(issue.body, t) });
    setAddText('');
  }

  return (
    // Fixed-height slot keeps the grid/lane uniform; the card lifts out of it on
    // expand. Lift the whole slot above siblings while active so the overflowing
    // card never paints under the ticket below it.
    <div ref={slotRef} className={`relative h-32 ${showDetail ? 'z-30' : ''}`}>
      <motion.div
        // framer animates the actual height (CSS can't tween to auto), so open/
        // close slide; background/border ease toward the Spotify-panel green.
        initial={false}
        animate={{
          height: open ? 'auto' : 128,
          backgroundColor: open ? tint.bg : '#0c1118',
          borderColor: open ? tint.border : 'rgba(255, 255, 255, 0.10)',
          scale: open ? 1.02 : 1,
        }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        onAnimationComplete={() => {
          if (!open) setShowDetail(false);
        }}
        style={{ transformOrigin: dropUp ? 'bottom' : 'top' }}
        className={`absolute inset-x-0 overflow-hidden rounded-xl border ${
          dropUp ? 'bottom-0' : 'top-0'
        } ${showDetail ? 'shadow-2xl shadow-black/60' : ''} ${closed && !open ? 'opacity-70' : ''}`}
      >
        <button onClick={toggle} className="block w-full p-4 text-left">
          <div className="mb-1.5 flex items-center gap-2.5 text-[11px] text-white/40">
            <span style={{ color: pr.color }}>{pr.short}</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: st.color }} />
              {st.label}
            </span>
            <SizeChip size={size} />
            <span className="ml-auto truncate">
              {repoName} #{issue.number}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </div>
          <p
            className={`font-medium leading-snug ${
              closed ? 'text-white/55 line-through' : 'text-white/90'
            } ${open ? '' : 'line-clamp-2'}`}
          >
            {issue.title}
          </p>
          {prog.total > 0 && (
            <p className="mt-1 text-[11px] text-white/35">
              {prog.done}/{prog.total} subtasks
            </p>
          )}
        </button>

        {showDetail && (
          <div className="px-4 pb-4" aria-hidden={!open}>
            {issue.body.trim() && (
              <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm leading-relaxed text-white/70">
                <p className="whitespace-pre-wrap">{issue.body}</p>
              </div>
            )}

            <div className="mb-3">
              {subs.length > 0 && (
                <>
                  <p className="mb-1.5 text-[11px] uppercase tracking-[0.15em] text-white/35">
                    Subtasks · {prog.done}/{prog.total}
                  </p>
                  <ul className="mb-2 space-y-1">
                    {subs.map((s) => (
                      <li key={s.index} className="group/sub flex items-center gap-2 text-sm">
                        <button
                          type="button"
                          onClick={() => onPatch(issue, { body: toggleSubtask(issue.body, s.index, !s.done) })}
                          className="shrink-0 text-white/50 transition-colors hover:text-emerald-300"
                          aria-label={s.done ? 'Mark subtask incomplete' : 'Mark subtask complete'}
                        >
                          {s.done ? (
                            <CheckSquare className="h-4 w-4 text-emerald-300/80" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                        <span className={s.done ? 'text-white/40 line-through' : 'text-white/75'}>
                          {s.text}
                        </span>
                        <button
                          type="button"
                          onClick={() => copySubtask(s.text, s.index)}
                          className="ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] text-white/40 opacity-0 transition-opacity hover:text-white/80 group-hover/sub:opacity-100"
                          title="Copy this subtask (with full context) for Claude"
                        >
                          {copiedSub === s.index ? (
                            <Check className="h-3 w-3 text-emerald-300" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          copy
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <form onSubmit={submitSubtask}>
                <input
                  value={addText}
                  onChange={(e) => setAddText(e.target.value)}
                  placeholder="add subtask…"
                  className="w-full rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/25"
                />
              </form>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Dropdown
                ariaLabel="Priority"
                value={issue.priority ?? 'p3'}
                options={PRIORITY_OPTS}
                onChange={(v) => onPatch(issue, { priority: v as Priority })}
              />
              <Dropdown
                ariaLabel="Status"
                value={issue.status ?? 'todo'}
                options={STATUS_OPTS}
                onChange={(v) => onPatch(issue, { status: v as Status })}
              />
              <Dropdown
                ariaLabel="Size"
                value={size}
                options={SIZE_OPTS}
                onChange={(v) => onPatch(issue, { size: v as Size })}
              />
              <CopyForClaude issue={issue} />
              {closed ? (
                <Button
                  variant="ghost"
                  glowColor="148, 163, 184"
                  onClick={() => onPatch(issue, { state: 'open' })}
                  className="text-xs text-white/70"
                >
                  Reopen
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  glowColor="52, 211, 153"
                  onClick={() => onPatch(issue, { state: 'closed' })}
                  className="text-xs text-emerald-300/85"
                >
                  <Check className="h-3.5 w-3.5" />
                  Done
                </Button>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function byPriority(a: DevIssue, b: DevIssue): number {
  return (
    (a.priority ?? 'p9').localeCompare(b.priority ?? 'p9') ||
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

function sortIssues(items: DevIssue[], sort: SortBy): DevIssue[] {
  const arr = [...items];
  if (sort === 'recent') {
    arr.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } else if (sort === 'size') {
    arr.sort((a, b) => SIZE_RANK[a.size ?? 'M'] - SIZE_RANK[b.size ?? 'M'] || byPriority(a, b));
  } else {
    arr.sort(byPriority);
  }
  return arr;
}

const STATUS_LANES: { key: string; label: string; color: string }[] = [
  { key: 'todo', label: 'Todo', color: STATUS_META.todo.color },
  { key: 'in progress', label: 'In progress', color: STATUS_META['in progress'].color },
  { key: 'done', label: 'Done', color: DONE_GREEN },
];

function laneOf(i: DevIssue): string {
  if (i.state === 'closed') return 'done';
  return i.status ?? 'todo';
}

function LaneHeader({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.15em] text-white/45">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
      <span className="text-white/25">· {count}</span>
    </div>
  );
}

export function IssueList({
  issues,
  repos,
  groupBy,
  sort,
  onChanged,
}: {
  issues: DevIssue[];
  repos: DevRepo[];
  groupBy: GroupBy;
  sort: SortBy;
  onChanged: () => void;
}) {
  const [error, setError] = useState('');

  function repoName(slug: string): string {
    return repos.find((r) => r.slug === slug)?.name ?? slug;
  }

  async function patch(issue: DevIssue, body: PatchBody) {
    setError('');
    try {
      const res = await fetch('/api/dev/issues', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: issue.repo, number: issue.number, ...body }),
      });
      if (!res.ok) {
        setError(`Couldn't update #${issue.number} — check the GitHub token's Issues write permission.`);
        return;
      }
      onChanged();
    } catch {
      setError('Network error updating the issue.');
    }
  }

  if (issues.length === 0) {
    return <p className="text-white/50">No open items. Hit ＋ dogfiris (⌘K) to file one.</p>;
  }

  const card = (issue: DevIssue) => (
    <IssueCard
      key={`${issue.repo}#${issue.number}`}
      issue={issue}
      repoName={repoName(issue.repo)}
      onPatch={patch}
    />
  );

  // STATUS → a real Kanban: three columns, each a vertical stack.
  if (groupBy === 'status') {
    return (
      <div>
        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-3">
          {STATUS_LANES.map((lane) => {
            const items = sortIssues(issues.filter((i) => laneOf(i) === lane.key), sort);
            return (
              <div key={lane.key}>
                <LaneHeader color={lane.color} label={lane.label} count={items.length} />
                <div className="flex flex-col gap-3">
                  {items.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-white/25">
                      Nothing here
                    </p>
                  ) : (
                    items.map(card)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // REPO → vertical sections per repo (too many to be columns). Closed items
  // only surface in the Status Kanban's Done lane, so filter to open here.
  // Within each section, the active sort (incl. Size) decides the order.
  const openItems = issues.filter((i) => i.state === 'open');
  const sections = repos
    .map((r) => ({
      key: r.slug,
      label: r.name,
      color: `rgb(${r.accent})`,
      items: openItems.filter((i) => i.repo === r.slug),
    }))
    .filter((s) => s.items.length > 0);

  return (
    <div>
      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
      {sections.map((sec) => (
        <section key={sec.key} className="mb-6 last:mb-0">
          <LaneHeader color={sec.color} label={sec.label} count={sec.items.length} />
          <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortIssues(sec.items, sort).map(card)}
          </div>
        </section>
      ))}
    </div>
  );
}
