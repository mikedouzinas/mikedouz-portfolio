'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { X } from 'lucide-react';
import type { CereAction } from '@/lib/dev/cere';
import type { DevIssue } from '@/lib/dev/github';
import { PRIORITY_META, SIZE_META, STATUS_META } from '@/lib/dev/uiMeta';
import { Button } from '@/components/ui/Button';
import { CereMark } from './CereMark';
import { CereGameLoader } from './CereGameLoader';
import { BodyDiff } from './BodyDiff';
import { IrisBubble } from '@/components/iris/IrisBubble';
import { IrisChat, type IrisChatHandle } from '@/components/iris/IrisChat';
import { Poof } from './Poof';
import { useCere } from './useCere';

const WIDTH = 440;
const MAX_HEIGHT = 420;
// The desktop IrisBubble shell adds p-5 padding (20px each side) plus a 1px
// border each side. Subtract both so the inner content fits the shell's client
// box exactly — otherwise it overshoots by 2px and the shell shows a faint
// scrollbar the moment Cere opens, before any messages.
const BUBBLE_INSET = 42; // 40 padding + 2 border

function ActionRow({ action, title }: { action: CereAction; title: string }) {
  const repoName = action.repo.split('/')[1] ?? action.repo;

  if (action.kind === 'create') {
    const pr = PRIORITY_META[action.priority];
    return (
      <li className="rounded-lg border border-emerald-400/20 bg-emerald-500/[0.06] p-2.5 text-sm">
        <div className="mb-1 flex items-center gap-2 text-[11px] text-white/55">
          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-200/90">New</span>
          <span style={{ color: pr.color }}>{pr.short}</span>
          <span style={{ color: SIZE_META[action.size].color }}>{action.size}</span>
          <span className="ml-auto truncate">{repoName}</span>
        </div>
        <p className="text-white/90">{action.title}</p>
        {action.subtasks.length > 0 && (
          <p className="mt-1 text-[11px] text-white/45">{action.subtasks.length} subtasks</p>
        )}
      </li>
    );
  }

  const changes: string[] = [];
  if (action.state === 'closed') changes.push('mark Done');
  if (action.state === 'open') changes.push('reopen');
  if (action.priority) changes.push(PRIORITY_META[action.priority].short);
  if (action.status) changes.push(STATUS_META[action.status].label);
  if (action.size) changes.push(`size ${action.size}`);
  const bodyChanged = typeof action.body === 'string';
  if (bodyChanged) changes.push('edit description');
  return (
    <li className="rounded-lg border border-sky-400/20 bg-sky-500/[0.06] p-2.5 text-sm">
      <div className="mb-1 flex items-center gap-2 text-[11px] text-white/55">
        <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-sky-200/90">Update</span>
        <span className="ml-auto truncate">{repoName}</span>
      </div>
      {/* Lead with #number + title so each change is individually identifiable,
          even when several updates land in one turn (ticket #66). */}
      <p className="text-white/90">
        <span className="text-white/60">#{action.number}</span> — {title}
      </p>
      <p className="mt-0.5 text-white/65">{changes.join(' · ') || 'no change'}</p>
      {bodyChanged && <BodyDiff before={action.bodyBefore ?? ''} after={action.body ?? ''} />}
    </li>
  );
}

/**
 * Cere — the conversational filer, as a floating glass bubble (same shell as
 * the blog assistant). Describe tickets, it proposes create/update actions, you
 * confirm, and they're filed through the existing issues API. Opens via the
 * ＋ Cere button / ⌘K.
 */
export function CerePanel({
  open,
  onClose,
  onApplied,
  issues = [],
}: {
  open: boolean;
  onClose: () => void;
  /** Called after actions are applied, with any newly-created issues so the
   *  board can optimistically insert them (ticket #71). */
  onApplied: (created: DevIssue[]) => void;
  /** Live board issues — used to resolve ticket titles for the proposal preview
   *  (ticket #66). */
  issues?: DevIssue[];
}) {
  const { messages, busy, applying, actions, warnings, send, confirm, discard, reset } =
    useCere(onApplied, issues);

  // Resolve the display title for a proposed action: creates carry their own;
  // updates/closes resolve theirs from the already-loaded board (ticket #66).
  const titleFor = (a: CereAction): string => {
    if (a.kind === 'create') return a.title;
    const hit = issues.find((i) => i.repo === a.repo && i.number === a.number);
    return hit?.title ?? `ticket #${a.number}`;
  };
  const [isMobile, setIsMobile] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<IrisChatHandle>(null);
  // Live (untrimmed) composer text — non-empty means an unsent draft we must
  // guard before dismissing.
  const inputRef = useRef('');

  // Confirm before dismissing if there's a conversation in progress OR unsent
  // text in the composer; otherwise close immediately. Mirrors Blog Iris's
  // close-confirmation UX, extended with the dirty-input guard.
  const isDirty = useCallback(
    () => messages.length > 0 || inputRef.current.trim().length > 0,
    [messages.length],
  );

  const attemptClose = useCallback(() => {
    if (isDirty()) setShowDiscard(true);
    else onClose();
  }, [isDirty, onClose]);

  // Reset the discard confirmation the moment the panel closes. Done during
  // render (tracking the previous `open`) rather than in an effect so it doesn't
  // trip set-state-in-effect / cause an extra render.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) setShowDiscard(false);
  }

  // Fresh conversation each open: clear the conversation + composer draft when
  // the panel closes. (reset() lives in useCere and is a side effect, so it
  // stays in an effect; the discard flag is reset during render above.)
  useEffect(() => {
    if (!open) {
      reset();
      inputRef.current = '';
    }
  }, [open, reset]);

  // Auto-dismiss the discard confirmation after 3s (matches Blog Iris).
  useEffect(() => {
    if (!showDiscard) return;
    const t = setTimeout(() => setShowDiscard(false), 3000);
    return () => clearTimeout(t);
  }, [showDiscard]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close on Escape or a click outside the bubble (after a tick so the opening
  // click doesn't immediately dismiss it).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') attemptClose();
    };
    const onDown = (e: MouseEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) attemptClose();
    };
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 100);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, attemptClose]);

  // Keep rendering through the close animation: Poof owns mount/unmount, so we
  // can't early-return on !open or the exit "poof" never plays. SSR renders
  // nothing (Poof's show is false until the client opens it).
  const hasWindow = typeof window !== 'undefined';

  const style: CSSProperties | undefined =
    isMobile || !hasWindow
      ? undefined
      : {
          position: 'fixed',
          top: Math.max(16, (window.innerHeight - MAX_HEIGHT) / 2),
          left: (window.innerWidth - WIDTH) / 2,
          width: WIDTH,
          maxHeight: MAX_HEIGHT,
          zIndex: 50,
        };

  return (
    <Poof show={open} enter={false} color="231, 226, 212" className="fixed inset-0 z-50 pointer-events-none">
    <IrisBubble ref={bubbleRef} mobile={isMobile} expanded tone="champagne" noEnterAnim className="pointer-events-auto" style={isMobile ? undefined : { ...style, position: 'absolute' }}>
      <div
        className="flex flex-col"
        style={{ height: isMobile ? undefined : MAX_HEIGHT - BUBBLE_INSET }}
      >
        <div className="mb-3 flex items-center justify-between">
          <CereMark size="md" />
          <button
            type="button"
            aria-label="Close"
            onClick={attemptClose}
            className="grid h-6 w-6 place-items-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Dismiss confirmation — shown when closing with a conversation or an
            unsent draft. Cancel restores the composer; Discard closes cleanly. */}
        {showDiscard && (
          <div className="mb-3 flex items-center justify-between rounded-lg bg-white/[0.06] px-2.5 py-2">
            <span className="text-[11px] text-white/55">Discard this conversation?</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setShowDiscard(false);
                  chatRef.current?.focusInput();
                }}
                className="rounded px-1.5 py-0.5 text-[11px] text-white/45 transition-colors hover:text-white/80"
              >
                Keep
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded px-1.5 py-0.5 text-[11px] text-red-400/80 transition-colors hover:text-red-400"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col">
          <IrisChat
            handleRef={chatRef}
            onInputChange={(v) => {
              inputRef.current = v;
              // Typing again after a stale prompt should clear it.
              if (v.trim() && showDiscard) setShowDiscard(false);
            }}
            messages={messages}
            busy={busy}
            onSend={send}
            placeholder="Describe a ticket…"
            thinkingSlot={<CereGameLoader />}
            accent="52, 211, 153"
            sendVariant="harlequin"
            emptyHint={
              <div className="mt-1 space-y-2 text-sm text-white/45">
                <p>Tell me what to file — I&apos;ll draft the tickets and you confirm. One message can create several.</p>
                <p className="text-white/30">
                  e.g. &ldquo;a P1 bug that the header overlaps the first card on mobile, and a small ticket to add Escape-to-close with subtasks.&rdquo;
                </p>
              </div>
            }
            belowMessages={
              actions.length === 0 && warnings.length > 0 && !busy ? (
                // Honest surface for dropped/invalid proposals when there's no
                // card to attach them to — never let a skip stay silent (#77/#80).
                <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/[0.06] p-2.5">
                  <p className="text-[11px] text-amber-300/80">{warnings.join(' ')}</p>
                </div>
              ) : actions.length > 0 ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="mb-2 text-[11px] uppercase tracking-[0.15em] text-white/45">
                    Proposed · {actions.length}
                  </p>
                  <ul className="mb-3 max-h-44 space-y-2 overflow-y-auto">
                    {actions.map((a, i) => (
                      <ActionRow key={i} action={a} title={titleFor(a)} />
                    ))}
                  </ul>
                  {warnings.length > 0 && (
                    <p className="mb-2 text-[11px] text-amber-300/80">{warnings.join(' ')}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <Button variant="hatch" glowColor="52, 211, 153" onClick={confirm} disabled={applying}>
                      {applying ? 'Filing…' : `Confirm ${actions.length}`}
                    </Button>
                    <Button
                      variant="ghost"
                      glowColor="148, 163, 184"
                      onClick={discard}
                      disabled={applying}
                      className="text-white/60"
                    >
                      Discard
                    </Button>
                  </div>
                </div>
              ) : null
            }
          />
        </div>
      </div>
    </IrisBubble>
    </Poof>
  );
}
