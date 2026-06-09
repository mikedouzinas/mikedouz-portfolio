'use client';

import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Secret login trigger. Desktop: hover the dot to open the portal.
 * Touch: long-press (~600ms) the dot to open it as a centered modal.
 * The animation is cosmetic — real auth is server-side (cookie + middleware).
 */
export function DevPortal() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openPortal = useCallback(() => setOpen(true), []);
  const closePortal = useCallback(() => {
    setOpen(false);
    setPassword('');
    setError('');
  }, []);

  const onTouchStart = () => {
    pressTimer.current = setTimeout(openPortal, 600);
  };
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/dev/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = '/dev';
        return;
      }
      setError(res.status === 429 ? 'Too many attempts. Try later.' : 'Nope.');
      setPassword('');
    } catch {
      setError('Network error. Try again.');
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-center py-1">
      <span
        aria-hidden
        onMouseEnter={openPortal}
        onTouchStart={onTouchStart}
        onTouchEnd={cancelPress}
        onTouchMove={cancelPress}
        className="cursor-default select-none text-xs text-white/10 transition-colors hover:text-white/25"
      >
        ·
      </span>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseLeave={closePortal}
            onClick={(e) => {
              if (e.target === e.currentTarget) closePortal();
            }}
          >
            <motion.form
              onSubmit={submit}
              initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0, filter: 'blur(8px)' }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="rounded-2xl border border-white/15 bg-slate-900/90 p-6 shadow-2xl"
            >
              <input
                autoFocus
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="·····"
                disabled={busy}
                className="w-40 bg-transparent text-center text-lg tracking-widest text-white outline-none placeholder-white/30"
              />
              {error && <p className="mt-3 text-center text-xs text-red-400">{error}</p>}
              <button type="submit" className="sr-only">
                Enter
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
