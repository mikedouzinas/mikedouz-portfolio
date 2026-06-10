'use client';

import { useEffect, useRef, useState } from 'react';
import { LogOut, Settings, SlidersHorizontal } from 'lucide-react';

/**
 * Overflow menu on the repo bar. Holds the two rare actions — Manage repos and
 * Log out — so the header stays clean. (The wordmark's back-diamond only
 * navigates home; it does NOT end the session, so Log out lives here.)
 */
export function GearMenu({
  onManage,
  onLogout,
  loggingOut,
}: {
  onManage: () => void;
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Board settings"
        onClick={() => setOpen((o) => !o)}
        className="grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-white/60 transition-colors hover:border-[#e7e2d4]/30 hover:text-[#e7e2d4]"
      >
        <Settings className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 min-w-[10rem] overflow-hidden rounded-lg border border-white/10 bg-[#0c1118] p-1 shadow-xl">
          <button
            type="button"
            onClick={() => {
              onManage();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-white/75 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Manage repos
          </button>
          <button
            type="button"
            onClick={() => {
              onLogout();
              setOpen(false);
            }}
            disabled={loggingOut}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-red-300/80 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            {loggingOut ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      )}
    </div>
  );
}
