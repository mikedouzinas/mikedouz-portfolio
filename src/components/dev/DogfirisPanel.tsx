'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { PawPrint, X } from 'lucide-react';
import type { DogfirisAction } from '@/lib/dev/dogfiris';
import { PRIORITY_META, SIZE_META, STATUS_META } from '@/lib/dev/uiMeta';
import { GoogleText } from '@/components/ui/GoogleText';
import { Button } from '@/components/ui/Button';
import { IrisBubble } from '@/components/iris/IrisBubble';
import { IrisChat } from '@/components/iris/IrisChat';
import { useDogfiris } from './useDogfiris';

const WIDTH = 440;
const MAX_HEIGHT = 420;

function ActionRow({ action }: { action: DogfirisAction }) {
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
  return (
    <li className="rounded-lg border border-sky-400/20 bg-sky-500/[0.06] p-2.5 text-sm">
      <div className="mb-1 flex items-center gap-2 text-[11px] text-white/55">
        <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-sky-200/90">Update</span>
        <span className="ml-auto truncate">
          {repoName} #{action.number}
        </span>
      </div>
      <p className="text-white/90">{changes.join(' · ') || 'no change'}</p>
    </li>
  );
}

/**
 * dogfiris — the conversational filer, as a floating glass bubble (same shell as
 * the blog assistant). Describe tickets, it proposes create/update actions, you
 * confirm, and they're filed through the existing issues API. Opens via the
 * ＋ dogfiris button / ⌘K.
 */
export function DogfirisPanel({
  open,
  onClose,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
}) {
  const { messages, busy, applying, actions, warnings, send, confirm, discard, reset } =
    useDogfiris(onApplied);
  const [isMobile, setIsMobile] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Fresh conversation each open.
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

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
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 100);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const style: CSSProperties | undefined = isMobile
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
    <IrisBubble ref={bubbleRef} mobile={isMobile} expanded style={style}>
      <div
        className="flex flex-col"
        style={{ height: isMobile ? undefined : MAX_HEIGHT - 40 }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PawPrint className="h-4 w-4 text-white/70" />
            <GoogleText text="dogfiris" className="text-base font-bold tracking-[0.04em]" />
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <IrisChat
            messages={messages}
            busy={busy}
            onSend={send}
            placeholder="Describe a ticket…"
            busyLabel="dogfiris is thinking…"
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
              actions.length > 0 ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="mb-2 text-[11px] uppercase tracking-[0.15em] text-white/45">
                    Proposed · {actions.length}
                  </p>
                  <ul className="mb-3 max-h-44 space-y-2 overflow-y-auto">
                    {actions.map((a, i) => (
                      <ActionRow key={i} action={a} />
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
  );
}
