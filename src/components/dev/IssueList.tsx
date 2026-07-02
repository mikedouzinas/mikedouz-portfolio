'use client';

import { useState } from 'react';
import type { DevIssue, DevRepo, Size } from '@/lib/dev/github';
import { STATUS_META } from '@/lib/dev/uiMeta';
import { parseReviewBlock } from '@/lib/dev/github';
import { TypeIn } from '@/components/dev/entrance/TypeIn';
import { ENTRANCE_PHASES, sub } from '@/components/dev/entrance/useEntranceReveal';
import { smartSort } from '@/lib/dev/smartSort';
import { TicketCard, DONE_GREEN, type PatchBody } from './TicketCard';

export type GroupBy = 'status' | 'repo';
export type SortBy = 'priority' | 'recent' | 'size' | 'smart';

/** Stable card identity: virtual items have number 0, so they key on itemId. */
const issueKey = (i: DevIssue) => (i.source === 'virtual' ? `v:${i.itemId}` : `${i.repo}#${i.number}`);

/** Size sort order — largest first, matching "most demanding first" like priority. */
const SIZE_RANK: Record<Size, number> = { L: 0, M: 1, S: 2 };

function byPriority(a: DevIssue, b: DevIssue): number {
  return (
    (a.priority ?? 'p9').localeCompare(b.priority ?? 'p9') ||
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

function sortIssues(items: DevIssue[], sort: SortBy): DevIssue[] {
  if (sort === 'smart') return smartSort(items);
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

/** True when an issue lives in the pinned Awaiting Review section. */
const isAwaiting = (i: DevIssue) => i.state === 'open' && i.status === 'awaiting review';

function laneOf(i: DevIssue): string {
  if (i.state === 'closed') return 'done';
  return i.status ?? 'todo';
}

function LaneHeader({ color, label, count, entrance }: { color: string; label: string; count: number; entrance?: { active: boolean; t: number } }) {
  const headT = entrance?.active ? sub(entrance.t, ENTRANCE_PHASES.heads[0], ENTRANCE_PHASES.heads[1]) : 1;
  const reveal = entrance?.active && headT > 0;
  // During the entrance, the WHOLE header (dot, label, count) stays hidden until
  // the heads phase begins — which is after the banner wipe — so nothing in the
  // columns appears before the top bar.
  const hidden = entrance?.active && !reveal;
  return (
    <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.15em] text-[#e7e2d4]/70">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color, opacity: hidden ? 0 : entrance?.active ? Math.min(1, headT * 1.5) : 1 }}
      />
      {hidden ? null : entrance?.active ? <TypeIn text={label} active durationMs={360} caret={false} /> : label}
      {hidden ? null : (
        <span className="text-[#e7e2d4]/40">· {entrance?.active ? Math.round(headT * count) : count}</span>
      )}
    </div>
  );
}

function ReviewActions({
  issue,
  onApprove,
  onSendBack,
}: {
  issue: DevIssue;
  onApprove: (i: DevIssue) => void | Promise<void>;
  onSendBack: (i: DevIssue, feedback: string) => void | Promise<void>;
}) {
  const review = parseReviewBlock(issue.body);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-2 text-xs">
      {review?.test && <p className="mb-2 text-white/70"><span className="text-white/40">Test: </span>{review.test}</p>}
      {review?.feedback && <p className="mb-2 text-amber-300/80">↩ {review.feedback}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {review?.preview && (
          <a href={review.preview} target="_blank" rel="noreferrer"
             className="rounded bg-white/10 px-2 py-1 hover:bg-white/20">Test ↗</a>
        )}
        <button
          disabled={busy}
          onClick={async () => { setBusy(true); await onApprove(issue); setBusy(false); }}
          className="rounded bg-emerald-600/80 px-2 py-1 hover:bg-emerald-600 disabled:opacity-40"
        >Approve → Done</button>
        <button onClick={() => setOpen((v) => !v)} className="rounded bg-white/10 px-2 py-1 hover:bg-white/20">Send back</button>
      </div>
      {open && (
        <div className="mt-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
            placeholder="What needs fixing?"
            className="w-full rounded bg-black/30 p-2 text-white outline-none" />
          <button
            disabled={!text.trim() || busy}
            onClick={async () => { setBusy(true); await onSendBack(issue, text.trim()); setOpen(false); setText(''); setBusy(false); }}
            className="mt-1 rounded bg-amber-600/80 px-2 py-1 disabled:opacity-40"
          >Send back to In progress</button>
        </div>
      )}
    </div>
  );
}

export function IssueList({
  issues,
  repos,
  groupBy,
  sort,
  onChanged,
  onApprove,
  onSendBack,
  entrance,
  loading = false,
  editable = true,
}: {
  issues: DevIssue[];
  repos: DevRepo[];
  groupBy: GroupBy;
  sort: SortBy;
  onChanged: () => void;
  onApprove: (i: DevIssue) => void | Promise<void>;
  onSendBack: (i: DevIssue, feedback: string) => void | Promise<void>;
  entrance?: { active: boolean; t: number };
  loading?: boolean;
  /** False = read-only board (#53): cards render without mutating affordances. */
  editable?: boolean;
}) {
  const [error, setError] = useState('');

  function repoName(slug: string): string {
    return repos.find((r) => r.slug === slug)?.name ?? slug;
  }

  async function patch(issue: DevIssue, body: PatchBody) {
    if (!editable) return; // read-only mode never mutates (API enforces too)
    setError('');
    try {
      // Virtual-project items route to the Supabase items API (keyed by itemId);
      // real GitHub issues route to the issues API (keyed by repo + number). The
      // body shape is identical, so only the endpoint/identity differs.
      const res =
        issue.source === 'virtual'
          ? await fetch(`/api/dev/items/${issue.itemId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            })
          : await fetch('/api/dev/issues', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ repo: issue.repo, number: issue.number, ...body }),
            });
      if (!res.ok) {
        setError(
          issue.source === 'virtual'
            ? `Couldn't update "${issue.title}".`
            : `Couldn't update #${issue.number} — check the GitHub token's Issues write permission.`,
        );
        return;
      }
      onChanged();
    } catch {
      setError('Network error updating the item.');
    }
  }

  // Only the LOADED-and-empty board shows the empty-state. During the entrance
  // the board mounts while issues are still being fetched (issues = []); showing
  // "No open items" then would be a false flash — render the empty lanes instead
  // and let cards box→type in as they arrive.
  if (issues.length === 0 && !loading) {
    return (
      <p className="text-white/50">
        {editable ? 'No open items. Hit ＋ Cere (⌘K) to file one.' : 'No open items.'}
      </p>
    );
  }

  // Helper: render a card with its entrance index (reading-order position).
  const card = (issue: DevIssue, entranceIdx: number) => (
    <TicketCard
      key={issueKey(issue)}
      issue={issue}
      repoName={repoName(issue.repo)}
      onPatch={patch}
      editable={editable}
      entrance={entrance}
      entranceIndex={entranceIdx}
    />
  );

  // Pinned awaiting-review items — shown above BOTH grouping views so they never
  // appear in a lane or repo section (excluded below via !isAwaiting).
  // Entrance index starts at 0 for the first awaiting-review card.
  const awaiting = sortIssues(issues.filter(isAwaiting), sort);

  const awaitingSection = awaiting.length > 0 ? (
    <div className="mb-5 rounded-xl border border-[#e7b34a]/30 bg-[#e7b34a]/[0.06] p-3">
      <LaneHeader color="#E7B34A" label="Awaiting review" count={awaiting.length} entrance={entrance} />
      <div className="flex flex-col gap-3">
        {awaiting.map((i, idx) => (
          <div key={issueKey(i)}>
            <TicketCard
              key={issueKey(i)}
              issue={i}
              repoName={repoName(i.repo)}
              onPatch={patch}
              inReview
              editable={editable}
              entrance={entrance}
              entranceIndex={idx}
            />
            {editable && <ReviewActions issue={i} onApprove={onApprove} onSendBack={onSendBack} />}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  // STATUS → a real Kanban: three columns, each a vertical stack.
  // Awaiting-review items are excluded — they live only in the pinned section.
  // Entrance indices continue after the awaiting section (reading order).
  if (groupBy === 'status') {
    // Pre-sort all lane items so we can compute indices in reading order.
    const laneItems = STATUS_LANES.map((lane) =>
      sortIssues(issues.filter((i) => laneOf(i) === lane.key && !isAwaiting(i)), sort),
    );
    // Entrance stagger uses each card's ROW index WITHIN its lane (not a global
    // reading-order index), so the three columns reveal in parallel — row 0 of
    // To Do / In Progress / Done all arrive together, then row 1, etc. (A global
    // index made In Progress + Done arrive much too late.)
    return (
      <div>
        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
        {awaitingSection}
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-3">
          {STATUS_LANES.map((lane, laneIdx) => {
            const items = laneItems[laneIdx];
            return (
              <div key={lane.key}>
                <LaneHeader color={lane.color} label={lane.label} count={items.length} entrance={entrance} />
                <div className="flex flex-col gap-3">
                  {items.length === 0 ? (
                    loading ? null : (
                      <p className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-white/25">
                        Nothing here
                      </p>
                    )
                  ) : (
                    items.map((issue, i) => card(issue, i))
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
  // Awaiting-review items are excluded — they live only in the pinned section.
  // Within each section, the active sort (incl. Size) decides the order.
  // Entrance indices continue after awaiting section, repo-by-repo top→bottom.
  const openItems = issues.filter((i) => i.state === 'open' && !isAwaiting(i));
  const sections = repos
    .map((r) => ({
      key: r.slug,
      label: r.name,
      color: `rgb(${r.accent})`,
      items: sortIssues(openItems.filter((i) => i.repo === r.slug), sort),
    }))
    .filter((s) => s.items.length > 0);

  // Entrance stagger uses each card's row index within its section, so sections
  // reveal in parallel rather than one-after-another.
  return (
    <div>
      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
      {awaitingSection}
      {sections.map((sec) => (
        <section key={sec.key} className="mb-6 last:mb-0">
          <LaneHeader color={sec.color} label={sec.label} count={sec.items.length} entrance={entrance} />
          <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sec.items.map((issue, i) => card(issue, i))}
          </div>
        </section>
      ))}
    </div>
  );
}
