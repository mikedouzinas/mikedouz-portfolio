'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PawPrint, X } from 'lucide-react';
import type { DogfirisAction } from '@/lib/dev/dogfiris';
import { PRIORITY_META, SIZE_META, STATUS_META } from '@/lib/dev/uiMeta';
import { GoogleText } from '@/components/ui/GoogleText';
import { Button } from '@/components/ui/Button';
import { IrisChat } from '@/components/iris/IrisChat';
import { useDogfiris } from './useDogfiris';

function ActionRow({ action }: { action: DogfirisAction }) {
  const repoName = action.repo.split('/')[1] ?? action.repo;

  if (action.kind === 'create') {
    const pr = PRIORITY_META[action.priority];
    return (
      <li className="rounded-lg border border-emerald-400/20 bg-emerald-500/[0.04] p-2.5 text-sm">
        <div className="mb-1 flex items-center gap-2 text-[11px] text-white/45">
          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300/90">New</span>
          <span style={{ color: pr.color }}>{pr.short}</span>
          <span style={{ color: SIZE_META[action.size].color }}>{action.size}</span>
          <span className="ml-auto truncate">{repoName}</span>
        </div>
        <p className="text-white/85">{action.title}</p>
        {action.subtasks.length > 0 && (
          <p className="mt-1 text-[11px] text-white/40">{action.subtasks.length} subtasks</p>
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
    <li className="rounded-lg border border-blue-400/20 bg-blue-500/[0.04] p-2.5 text-sm">
      <div className="mb-1 flex items-center gap-2 text-[11px] text-white/45">
        <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-blue-300/90">Update</span>
        <span className="ml-auto truncate">
          {repoName} #{action.number}
        </span>
      </div>
      <p className="text-white/85">{changes.join(' · ') || 'no change'}</p>
    </li>
  );
}

/**
 * The `dogfiris` slide-over: a conversational filer. You describe tickets, the
 * planner proposes create/update actions, you confirm, and they're filed
 * through the existing issues API. Opens via the ＋ dogfiris button / ⌘K.
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

  // Fresh conversation each time it opens; close on Escape.
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#0a0f17]"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-2">
                <PawPrint className="h-4 w-4 text-white/70" />
                <GoogleText text="dogfiris" className="text-lg font-bold tracking-[0.04em]" />
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="grid h-7 w-7 place-items-center rounded-md text-white/50 transition-colors hover:bg-white/5 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
              <IrisChat
                messages={messages}
                busy={busy}
                onSend={send}
                placeholder="Describe a ticket…"
                busyLabel="dogfiris is thinking…"
                accent="52, 211, 153"
                emptyHint={
                  <div className="mt-1 space-y-2 text-sm text-white/40">
                    <p>
                      Tell me what to file — I&apos;ll draft the tickets and you confirm. One message
                      can create several.
                    </p>
                    <p className="text-white/30">
                      e.g. &ldquo;a P1 bug that the header overlaps the first card on mobile, and a
                      small ticket to add Escape-to-close with subtasks.&rdquo;
                    </p>
                  </div>
                }
                belowMessages={
                  actions.length > 0 ? (
                    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <p className="mb-2 text-[11px] uppercase tracking-[0.15em] text-white/40">
                        Proposed · {actions.length}
                      </p>
                      <ul className="mb-3 max-h-52 space-y-2 overflow-y-auto">
                        {actions.map((a, i) => (
                          <ActionRow key={i} action={a} />
                        ))}
                      </ul>
                      {warnings.length > 0 && (
                        <p className="mb-2 text-[11px] text-amber-300/70">{warnings.join(' ')}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="hatch"
                          glowColor="52, 211, 153"
                          onClick={confirm}
                          disabled={applying}
                        >
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
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
