'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { DevRepo } from '@/lib/dev/github';
import { GoogleText } from '@/components/ui/GoogleText';
import { CreateIssueForm } from './CreateIssueForm';

/**
 * The `＋ dogfiris` / ⌘K slide-over. For now it hosts the manual ticket form;
 * the conversational filer (issue #35) replaces the body without moving the
 * entry point.
 */
export function DogfirisPanel({
  open,
  onClose,
  repos,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  repos: DevRepo[];
  onCreated: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
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
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-white/10 bg-[#0a0f17] p-6"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
          >
            <div className="mb-1 flex items-center justify-between">
              <GoogleText text="dogfiris" className="text-lg font-bold tracking-[0.04em]" />
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="grid h-7 w-7 place-items-center rounded-md text-white/50 transition-colors hover:bg-white/5 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-5 text-xs text-white/40">
              Conversational filing is coming — describe a ticket and it&apos;ll just appear. For
              now, file it manually below.
            </p>
            <CreateIssueForm
              repos={repos}
              onCreated={() => {
                onCreated();
                onClose();
              }}
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
