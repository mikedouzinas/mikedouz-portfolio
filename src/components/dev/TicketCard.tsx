'use client';

/**
 * TicketCard — the board's ticket card as a standalone, props-driven component
 * (#53, extraction folded in from #31). Renders the inline collapsed card and
 * its detached centered panel (shared-layout morph), with every mutation
 * funneled through the single `onPatch` callback. The `editable` toggle is the
 * read-only seam: when false, every mutating affordance (complete checkbox,
 * subtask toggles, edit/complete/reopen, priority/status/size dropdowns, the
 * Claude copy actions) is not rendered — viewing and expand/collapse remain.
 * Read-only SAFETY is enforced at the API layer (visitor sessions); this flag
 * only shapes the UI.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Check, CheckSquare, Copy, Maximize2, Minimize2, Pencil, Square, X } from 'lucide-react';
import ContainedMouseGlow from '@/components/ContainedMouseGlow';
import type { DevIssue, Priority, Size, Status } from '@/lib/dev/github';
import { PRIORITY_META, SIZE_META, STATUS_META } from '@/lib/dev/uiMeta';
import {
  addSubtask,
  checkAllSubtasks,
  composeBody,
  parseSubtasks,
  stripSubtasks,
  subtaskProgress,
  toggleSubtask,
  type DraftSubtask,
} from '@/lib/dev/subtasks';
import { buildClaudePrompt } from '@/lib/dev/copy';
import { Dropdown } from '@/components/ui/Dropdown';
import { Button } from '@/components/ui/Button';
import { CopyForClaude } from './CopyForClaude';
import { TypeIn } from '@/components/dev/entrance/TypeIn';

const emptySubscribe = () => () => {};

// Priority shows just the code (P1…P5) — the descriptive word ("· Medium") was
// confusable with the t-shirt size's "M · Medium". The color dot carries severity.
const PRIORITY_OPTS = (['p1', 'p2', 'p3', 'p4', 'p5'] as Priority[]).map((p) => ({
  value: p,
  label: PRIORITY_META[p].short,
  color: PRIORITY_META[p].color,
}));
const STATUS_OPTS = (['todo', 'in progress', 'awaiting review'] as Status[]).map((s) => ({
  value: s,
  label: STATUS_META[s].label,
  color: STATUS_META[s].color,
}));
const SIZE_OPTS = (['S', 'M', 'L'] as Size[]).map((s) => ({
  value: s,
  label: SIZE_META[s].label,
  color: SIZE_META[s].color,
}));

export type PatchBody = {
  priority?: Priority;
  status?: Status;
  size?: Size;
  state?: 'open' | 'closed';
  title?: string;
  body?: string;
};

/** One green for everything "done" — the Done lane dot and the expand tint. */
export const DONE_GREEN = '#1DB954';

// Expanded-card tint keyed by status, so the lift colour tells you where a
// ticket stands at a glance: blue = todo, amber = in progress, champagne = awaiting review,
// and the original Spotify-panel green = done. Same dark-tint-of-the-accent recipe.
// Translucent so the harlequin argyle whispers through the glass card.
const STATUS_EXPAND: Record<Status | 'done', { bg: string; border: string }> = {
  todo: { bg: 'rgba(11, 19, 34, 0.66)', border: 'rgba(66, 133, 244, 0.45)' }, // blue
  'in progress': { bg: 'rgba(26, 22, 7, 0.66)', border: 'rgba(251, 188, 5, 0.45)' }, // amber
  'awaiting review': { bg: 'rgba(26, 22, 7, 0.66)', border: 'rgba(231, 179, 74, 0.45)' }, // champagne-amber
  done: { bg: 'rgba(10, 26, 19, 0.66)', border: 'rgba(29, 185, 84, 0.45)' }, // Spotify green
};

// #63 — Morph spring tokens. Expand overshoots slightly (springy/bouncy);
// collapse is near-critical (decisive, no bounce on the way home).
const MORPH_SPRING_EXPAND = { type: 'spring', stiffness: 420, damping: 32, mass: 1.1 } as const;
const MORPH_SPRING_COLLAPSE = { type: 'spring', stiffness: 480, damping: 40 } as const;
// Reduced-motion fallback: a plain short tween, no overshoot.
const MORPH_TWEEN_REDUCED = { duration: 0.2, ease: 'easeOut' } as const;

/** Compact markdown for a ticket description — tuned for the dark card, no images/headings sprawl. */
function IssueBodyMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-white/90">{children}</strong>,
        em: ({ children }) => <em className="text-white/60">{children}</em>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline underline-offset-2 hover:text-sky-200">
            {children}
          </a>
        ),
        ul: ({ children }) => <ul className="mb-1.5 ml-4 list-disc space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="mb-1.5 ml-4 list-decimal space-y-0.5">{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
        h1: ({ children }) => <p className="mb-1 font-semibold text-white/90">{children}</p>,
        h2: ({ children }) => <p className="mb-1 font-semibold text-white/90">{children}</p>,
        h3: ({ children }) => <p className="mb-1 font-semibold text-white/85">{children}</p>,
        blockquote: ({ children }) => (
          <blockquote className="my-1.5 border-l-2 border-white/20 pl-2.5 italic text-white/55">{children}</blockquote>
        ),
        code: ({ children }) => (
          <code className="rounded bg-white/[0.08] px-1 py-0.5 text-[0.9em] text-sky-200/90">{children}</code>
        ),
        pre: ({ children }) => (
          <pre className="my-1.5 overflow-x-auto rounded-md bg-black/30 p-2.5 text-[12px]">{children}</pre>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

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

// The detached panel is noticeably wider than the inline card and tall enough
// for a full description — the same centered, elevated treatment as the Cere /
// blog-Iris panels, just larger.
const DETACHED_WIDTH = 800; // inline cards sit at ~320–360px in the 3-col grid; this zooms in closer
const DETACHED_MAX_HEIGHT_VH = 90; // cap so a long ticket scrolls inside the panel; short tickets size to content

export function TicketCard({
  issue,
  repoName,
  onPatch,
  inReview = false,
  editable = true,
  entrance,
  entranceIndex = 0,
}: {
  issue: DevIssue;
  repoName: string;
  onPatch: (issue: DevIssue, body: PatchBody) => void;
  inReview?: boolean;
  /** False = read-only: no mutating affordances render (#53). */
  editable?: boolean;
  entrance?: { active: boolean; t: number };
  entranceIndex?: number;
}) {
  const [open, setOpen] = useState(false); // true === detached + centered
  // The vacated-slot placeholder lives on its own flag so it can OUTLAST the
  // collapse: it stays mounted while the card morphs back and only unmounts
  // once the inline card's layout animation lands (onLayoutAnimationComplete).
  const [placeholderVisible, setPlaceholderVisible] = useState(false);
  // portal target ready (client only) — true only after mount, SSR-safe
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  // #63 — animation controls for the press-in beat on the inline card.
  const inlineControls = useAnimationControls();
  const prefersReducedMotion = useReducedMotion();
  // Entrance reveal: this card "arrives" when t passes its per-index threshold.
  // When entrance is not active, entranceArrived is always true (normal render).
  const cardStartT = 0.56 + Math.min(entranceIndex * 0.03, 0.4);
  const entranceArrived = entrance?.active ? (entrance.t >= cardStartT) : true;
  const [addText, setAddText] = useState('');
  const [copiedSub, setCopiedSub] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editProse, setEditProse] = useState('');
  const [editSubs, setEditSubs] = useState<DraftSubtask[]>([]);
  const slotRef = useRef<HTMLDivElement>(null);
  const pr = PRIORITY_META[issue.priority ?? 'p3'];
  const size = issue.size ?? 'M';
  const closed = issue.state === 'closed';
  // Closed items read as "Done" (green) regardless of their lingering status label.
  const st = closed ? { label: 'Done', color: DONE_GREEN } : STATUS_META[issue.status ?? 'todo'];
  const expandKey: Status | 'done' = closed ? 'done' : issue.status ?? 'todo';
  const tint = STATUS_EXPAND[expandKey];
  const subs = parseSubtasks(issue.body);
  const prog = subtaskProgress(issue.body);
  const prose = stripSubtasks(issue.body); // description without the checklist lines

  // Stable shared-layout id: framer animates the SAME card between its inline
  // slot and the detached centered panel, so the morph reads as one element
  // lifting out and flying back — the detach effect.
  const layoutId = `ticket-${issue.repo}-${issue.source === 'virtual' ? issue.itemId : issue.number}`;

  // Lock body scroll while a ticket is detached so the centered panel is the
  // sole focus (and the backdrop scrim can't be scrolled past).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function detach() {
    if (!prefersReducedMotion) {
      // #63 — press-in beat: dip scale + tiny y before the shared-layout morph fires.
      await inlineControls.start({ scale: 0.96, y: 2, transition: { duration: 0.09, ease: 'easeIn' } });
    }
    setPlaceholderVisible(true);
    setOpen(true);
  }
  const collapse = useCallback(() => {
    // Keep the placeholder up; it's cleared by the inline card's
    // onLayoutAnimationComplete once the card has contracted back into its slot.
    setOpen(false);
  }, []);

  // Esc collapses the detached panel back into its slot.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') collapse();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, collapse]);

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
    if (editing) {
      // Edit mode batches everything into the draft; persist happens on Save.
      setEditSubs((prev) => [...prev, { text: t, done: false }]);
    } else {
      onPatch(issue, { body: addSubtask(issue.body, t) });
    }
    setAddText('');
  }

  function startEdit() {
    setEditTitle(issue.title);
    setEditProse(prose);
    setEditSubs(subs.map((s) => ({ text: s.text, done: s.done })));
    setAddText('');
    setEditing(true);
  }

  // Edit mode is a fully-local draft (title + prose + subtasks). Nothing patches
  // until Save, so a stray reload can't wipe a half-typed edit.
  function updateDraftSub(i: number, patch: Partial<DraftSubtask>) {
    setEditSubs((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function removeDraftSub(i: number) {
    setEditSubs((prev) => prev.filter((_, idx) => idx !== i));
  }

  function saveEdit() {
    const t = editTitle.trim();
    if (!t) return;
    const patch: PatchBody = {};
    if (t !== issue.title) patch.title = t;
    // Save-absorbs-pending: a half-typed subtask sitting in the add input is
    // committed into the draft as part of Save, so it can never be silently lost.
    const pending = addText.trim();
    const subsToSave = pending ? [...editSubs, { text: pending, done: false }] : editSubs;
    const newBody = composeBody(editProse, subsToSave);
    if (newBody !== issue.body) patch.body = newBody;
    if (patch.title || patch.body) onPatch(issue, patch); // reload remounts with fresh props
    setAddText('');
    setEditing(false);
  }

  // Shared close/complete action — used by both the Complete button and the
  // card-level checkbox so the two paths behave identically. Marking the ticket
  // Done completes its checklist too.
  function completeIssue() {
    onPatch(issue, {
      state: 'closed',
      ...(prog.total > 0 ? { body: checkAllSubtasks(issue.body) } : {}),
    });
  }

  // The card header — the always-visible summary. Shared between the inline
  // (collapsed) card and the top of the detached panel. `detached` widens the
  // title to a single line and swaps the expand glyph for a "collapse" one.
  const header = (detached: boolean) => (
    <button
      onClick={detached ? collapse : detach}
      className={`relative z-10 block w-full p-4 text-left ${detached ? 'pr-12' : ''}`}
    >
      <div className="mb-1.5 flex items-center gap-2.5 text-[11px] text-white/40">
        {/* Complete checkbox — sits to the LEFT of the priority badge and fires
            the SAME close/complete action as the Complete button. It must not
            also expand the ticket, so its click/keydown stop propagation to the
            surrounding header button. Hidden once closed (then it reads Done),
            and entirely absent in read-only mode. */}
        {!closed && !inReview && editable && (
          <span
            role="checkbox"
            aria-checked={false}
            aria-label="Mark ticket complete"
            tabIndex={0}
            title="Mark complete"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              completeIssue();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                e.preventDefault();
                completeIssue();
              }
            }}
            className="-my-1 inline-flex shrink-0 cursor-pointer items-center text-white/45 transition-colors hover:text-emerald-300"
          >
            <Square className="h-3.5 w-3.5" />
          </span>
        )}
        <span style={{ color: pr.color }}>{pr.short}</span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: st.color }} />
          {st.label}
        </span>
        <SizeChip size={size} />
        {issue.source === 'virtual' && (
          <span className="rounded bg-[#e7e2d4]/10 px-1 text-[9px] uppercase tracking-wide text-[#e7e2d4]/70 ring-1 ring-[#e7e2d4]/25">
            vault
          </span>
        )}
        <span className="ml-auto truncate">
          {issue.source === 'virtual' ? repoName : `${repoName} #${issue.number}`}
        </span>
        {detached ? (
          <Minimize2 className="h-3.5 w-3.5 shrink-0" aria-label="Collapse ticket" />
        ) : (
          <Maximize2 className="h-3.5 w-3.5 shrink-0" aria-label="Expand ticket" />
        )}
      </div>
      {/* In edit mode the title is shown as an input below, so suppress the
          static title + progress here to avoid a duplicate header. */}
      {!editing && (
        <>
          <p
            className={`font-medium leading-snug ${
              closed ? 'text-white/55 line-through' : 'text-white/90'
            } ${detached ? 'text-base' : 'line-clamp-2'}`}
          >
            {entrance?.active && !detached
              ? <TypeIn
                  text={issue.title}
                  active={entranceArrived}
                  durationMs={Math.min(700, 200 + issue.title.length * 12)}
                  startDelayMs={120}
                  caret
                />
              : issue.title}
          </p>
          {prog.total > 0 && (
            <p className="mt-1 text-[11px] text-white/35">
              {prog.done}/{prog.total} subtasks
            </p>
          )}
        </>
      )}
    </button>
  );

  // The expanded detail — description, checklist, action row (or the edit
  // draft). Only ever rendered inside the detached centered panel.
  const detail = (
    <>
      {editing ? (
            // EDIT MODE — a self-contained draft. Nothing persists until Save, so
            // a stray board reload can't wipe an in-progress edit. No status/Done
            // controls here: editing is about content (title, description, tasks).
            <div className="space-y-3 px-4 pb-4">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Title"
                className="w-full rounded-md border border-white/15 bg-white/[0.03] px-2.5 py-1.5 text-sm font-medium text-white outline-none focus:border-white/30"
              />
              <textarea
                value={editProse}
                onChange={(e) => setEditProse(e.target.value)}
                placeholder="Description (markdown supported)…"
                rows={4}
                className="w-full resize-y rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-2 text-sm leading-relaxed text-white/85 outline-none placeholder:text-white/30 focus:border-white/25"
              />

              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-[0.15em] text-white/35">
                  Subtasks · {editSubs.length}
                </p>
                {editSubs.length > 0 && (
                  <ul className="mb-2 space-y-1">
                    {editSubs.map((s, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <button
                          type="button"
                          onClick={() => updateDraftSub(i, { done: !s.done })}
                          className="shrink-0 text-white/50 transition-colors hover:text-emerald-300"
                          aria-label={s.done ? 'Mark subtask incomplete' : 'Mark subtask complete'}
                        >
                          {s.done ? (
                            <CheckSquare className="h-4 w-4 text-emerald-300/80" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                        <input
                          value={s.text}
                          onChange={(e) => updateDraftSub(i, { text: e.target.value })}
                          placeholder="subtask…"
                          className="flex-1 rounded-md border border-white/10 bg-white/[0.02] px-2 py-1 text-sm text-white/85 outline-none placeholder:text-white/30 focus:border-white/25"
                        />
                        <button
                          type="button"
                          onClick={() => removeDraftSub(i)}
                          className="shrink-0 text-white/40 transition-colors hover:text-red-300"
                          aria-label="Remove subtask"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <form onSubmit={submitSubtask}>
                  <input
                    value={addText}
                    onChange={(e) => setAddText(e.target.value)}
                    placeholder="add subtask…"
                    className="w-full rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/25"
                  />
                </form>

                <div className="mt-3 flex items-center gap-2">
                  <Button variant="hatch" glowColor="52, 211, 153" onClick={saveEdit} className="text-xs text-emerald-300/85">
                    <Check className="h-3.5 w-3.5" />
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    glowColor="148, 163, 184"
                    onClick={() => setEditing(false)}
                    className="text-xs text-white/60"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
      ) : (
        // VIEW MODE — rendered description, toggleable checklist, action row.
        <div className="relative z-10 px-4 pb-4">
          {prose && (
                <div className="dev-markdown mb-3 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm leading-relaxed text-white/70">
                  <IssueBodyMarkdown>{prose}</IssueBodyMarkdown>
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
                          {editable ? (
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
                          ) : (
                            <span className="shrink-0 text-white/40" aria-hidden>
                              {s.done ? (
                                <CheckSquare className="h-4 w-4 text-emerald-300/60" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </span>
                          )}
                          <span className={s.done ? 'text-white/40 line-through' : 'text-white/75'}>
                            {s.text}
                          </span>
                          {editable && (
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
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {/* Adding a subtask is gated behind Edit mode — only checkbox
                    toggling and per-subtask copy are available in view mode. */}
              </div>

              {editable && (
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
                  <Button
                    variant="ghost"
                    glowColor="148, 163, 184"
                    onClick={startEdit}
                    className="text-xs text-white/70"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  {closed ? (
                    <Button
                      variant="ghost"
                      glowColor="148, 163, 184"
                      onClick={() => onPatch(issue, { state: 'open' })}
                      className="text-xs text-white/70"
                    >
                      Reopen
                    </Button>
                  ) : !inReview ? (
                    <Button
                      variant="ghost"
                      glowColor="52, 211, 153"
                      onClick={completeIssue}
                      className="text-xs text-emerald-300/85"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Complete
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
      )}
    </>
  );

  return (
    // Fixed-height slot keeps the grid/lane uniform. While detached, the slot
    // holds a styled placeholder so neighbours don't reflow — the card itself
    // has flown out to the centered panel (rendered in a portal below).
    <div ref={slotRef} className="relative h-32">
      {placeholderVisible && (
        // PLACEHOLDER — the vacated slot. A dashed champagne outline with a
        // little "Be right back." note + a softly pulsing dot, so the gap reads
        // as intentional ("this ticket stepped out") rather than broken.
        // (#64 spotlight-pool treatment was reverted — sent back for a rethink.)
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#e7e2d4]/20 bg-white/[0.015] text-center">
          <motion.span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-[#e7e2d4]/50"
            animate={{ opacity: [0.25, 0.9, 0.25], scale: [0.85, 1.15, 0.85] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="text-[11px] italic text-[#e7e2d4]/45">Be right back.</span>
          <span className="text-[10px] text-white/25">
            {issue.source === 'virtual' ? repoName : `${repoName} #${issue.number}`}
          </span>
        </div>
      )}
      {!open && (
        // INLINE CARD — collapsed summary, sitting in the slot. layoutId ties it
        // to the detached panel so the expand morphs the same element forward.
        // It renders after the placeholder in the DOM, so while collapsing it
        // animates home ON TOP of the still-visible placeholder, which only
        // unmounts once this card's layout animation lands.
        //
        // ENTRANCE: A non-layout wrapper handles the box-in animation so that the
        // inner motion.div (which carries layoutId) is never touched. This keeps
        // the shared-layout morph (expand/collapse) completely clean — the wrapper
        // is invisible once t=1 / entrance=false and adds no DOM cost post-reveal.
        <motion.div
          className="absolute inset-x-0 top-0 h-32"
          {...(entrance?.active ? {
            initial: { opacity: 0, x: 24, scale: 0.98 },
            animate: entranceArrived
              ? { opacity: 1, x: 0, scale: 1 }
              : { opacity: 0, x: 24, scale: 0.98 },
            transition: prefersReducedMotion
              ? { duration: 0.2 }
              : { type: 'spring', stiffness: 320, damping: 30, delay: entranceIndex * 0.07 },
          } : {})}
        >
          <motion.div
            layoutId={layoutId}
            data-suppress-reveal
            data-has-contained-glow="true"
            initial={false}
            animate={inlineControls}
            onLayoutAnimationComplete={() => {
              // The card finished morphing. If we're collapsed, it has now
              // contracted into its slot — drop the placeholder exactly here.
              if (!open) setPlaceholderVisible(false);
            }}
            whileHover={{
              scale: 1.02,
              backgroundColor: tint.bg,
              borderColor: tint.border,
            }}
            // #63 — layout transition: spring on collapse (expand is handled by the
            // detached node's transition since it's the layout-driving node when open).
            transition={prefersReducedMotion ? MORPH_TWEEN_REDUCED : MORPH_SPRING_COLLAPSE}
            style={{
              backgroundColor: 'rgba(12, 17, 24, 0.52)',
              borderColor: 'rgba(255, 255, 255, 0.10)',
            }}
            className={`absolute inset-0 cursor-pointer overflow-hidden rounded-xl border backdrop-blur-md hover:shadow-2xl hover:shadow-black/60 ${
              closed ? 'opacity-70' : ''
            }`}
          >
            {/* Cursor-following light contained to the ticket — the harlequin's
                confined "lighting up", distinct from the board's argyle reveal. */}
            <ContainedMouseGlow color="231, 226, 212" intensity={0.16} size={220} />
            {header(false)}
          </motion.div>
        </motion.div>
      )}

      {/* DETACHED PANEL — portalled to <body> so it escapes the lane's overflow
          and stacking context, centered + enlarged over an invisible click-catch
          (no dimming). Same centered-elevated treatment as Cere / blog-Iris, wider. */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                key={layoutId}
                className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:p-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {/* Invisible click-catch — collapse on outside click without
                    darkening the board behind the panel. */}
                <button
                  type="button"
                  aria-label="Close ticket"
                  onClick={collapse}
                  className="absolute inset-0 cursor-default"
                />
                <motion.div
                  layoutId={layoutId}
                  data-suppress-reveal
                  data-has-contained-glow="true"
                  style={{
                    width: '100%',
                    maxWidth: DETACHED_WIDTH,
                    maxHeight: `${DETACHED_MAX_HEIGHT_VH}vh`,
                    backgroundColor: tint.bg,
                    borderColor: tint.border,
                  }}
                  // #63 — expand spring: slight overshoot gives the "grows up/out past
                  // target then settles" pop. Collapse spring (near-critical) applied on
                  // the inline node. Reduced-motion: plain short tween.
                  transition={prefersReducedMotion ? MORPH_TWEEN_REDUCED : MORPH_SPRING_EXPAND}
                  className="relative z-10 my-auto overflow-y-auto rounded-2xl border shadow-[0_0_80px_40px_rgba(0,0,0,0.45),0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl"
                >
                  <ContainedMouseGlow color="231, 226, 212" intensity={0.16} size={320} />
                  {/* Explicit close affordance (Esc / scrim also work). */}
                  <button
                    type="button"
                    aria-label="Collapse ticket"
                    onClick={collapse}
                    className="absolute right-3 top-3 z-20 grid h-7 w-7 place-items-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  {header(true)}
                  {detail}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
