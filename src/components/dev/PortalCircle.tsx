'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Limelight } from 'next/font/google';
import ContainedMouseGlow from '@/components/ContainedMouseGlow';

// Art Deco / 1930s-marquee display face — matches THE HARLEQUIN wordmark.
const marquee = Limelight({ weight: '400', subsets: ['latin'], display: 'swap' });

const LONG_PRESS_MS = 600;
const TAP_COUNT_TO_OPEN = 5;
const TAP_WINDOW_MS = 1500; // taps must land within this rolling window

// The exact harlequin argyle tile (red diamonds, champagne stroke) used across
// the /dev theme — see HarlequinReveal.tsx. 44px tile to match the lockup.
const ARGYLE_TILE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='44'%3E%3Cpolygon points='22,2 42,22 22,42 2,22' fill='%23B3122B' stroke='%23EDE6D6' stroke-width='1'/%3E%3C/svg%3E\")";

// Size presets. `sm` sits inline with the 24px social icons; `md` is a standalone mark.
const SIZES = {
  sm: { box: 28, fontPx: 6, glow: 60 },
  md: { box: 80, fontPx: 13, glow: 150 },
} as const;

/**
 * The portal circle — the secret entrance to THE HARLEQUIN board.
 *
 * Visual: a circle filled with the harlequin argyle pattern, a champagne ring,
 * a centered Limelight "Harlequin" wordmark, a springy hover bounce, and a
 * contained champagne glow that tracks the cursor inside the circle.
 *
 * Interaction: it's a real `<button>`. Click or keyboard (Enter/Space) opens the
 * password modal. Hover only does the bounce + glow. The legacy entrypoints are
 * preserved: global ⌘⇧K (Ctrl+Shift+K), mobile long-press (~600ms), and 5 quick
 * taps. The animation is cosmetic — real auth is server-side (cookie + middleware).
 */
export function PortalCircle({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md';
  className?: string;
}) {
  const dims = SIZES[size];
  const reduceMotion = useReducedMotion();

  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const tapTimes = useRef<number[]>([]);

  const openPortal = useCallback(() => {
    setPassword(''); // never reopen pre-filled (e.g. browser/password-manager autofill)
    setError('');
    setOpen(true);
  }, []);
  const closePortal = useCallback(() => {
    setOpen(false);
    setPassword('');
    setError('');
  }, []);

  // Global ⌘⇧K (Ctrl+Shift+K) opens the portal from anywhere on the page.
  // PortalCircle is only mounted on the homepage (not on /dev), so this never
  // reaches Cere's ⌘K on /dev. The shiftKey requirement keeps it distinct from
  // Iris's plain ⌘K on the main site. We key off event.code ('KeyK') so it's
  // unaffected by Shift altering event.key to 'K'.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const modifier = e.metaKey || e.ctrlKey;
      if (modifier && e.shiftKey && e.code === 'KeyK') {
        e.preventDefault();
        e.stopPropagation();
        openPortal();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openPortal]);

  // Mobile secret trigger: long-press (~600ms) OR 5 quick taps.
  const onTouchStart = () => {
    longPressFired.current = false;
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      openPortal();
    }, LONG_PRESS_MS);
  };
  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  const onTouchEnd = () => {
    cancelPress();
    // A completed long-press already opened the portal; don't also count it as a tap.
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    const now = Date.now();
    tapTimes.current = [...tapTimes.current, now].filter((t) => now - t <= TAP_WINDOW_MS);
    if (tapTimes.current.length >= TAP_COUNT_TO_OPEN) {
      tapTimes.current = [];
      openPortal();
    }
  };

  // Clean up any pending long-press timer on unmount.
  useEffect(() => () => cancelPress(), []);

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

  // Springy hover bounce: jump up + small scale. Spring easing matches the lockup.
  const lift = reduceMotion ? 0 : -6;
  const scale = reduceMotion ? 1 : 1.06;

  return (
    <div className={`flex justify-center ${className}`}>
      <motion.button
        type="button"
        aria-label="Enter THE HARLEQUIN"
        onClick={openPortal}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={cancelPress}
        onTouchMove={cancelPress}
        animate={{ y: hovered ? lift : 0, scale: hovered ? scale : 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 14 }}
        style={{ width: dims.box, height: dims.box }}
        className="relative grid place-items-center overflow-hidden rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#E7E2D4]/60"
      >
        {/* Argyle pattern fills the portal interior */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            backgroundColor: '#0d0b11',
            backgroundImage: ARGYLE_TILE,
            backgroundSize: '44px 44px',
          }}
        />
        {/* Radial vignette inside the circle so it reads like depth */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 50% 45%, transparent 0%, rgba(13,11,17,0.55) 55%, rgba(13,11,17,0.90) 100%)',
          }}
        />
        {/* Champagne ring (double-stroke, hand-inked) */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            boxShadow:
              '0 0 0 1.5px rgba(231,226,212,0.65), 0 0 0 3px rgba(13,11,17,0.9), 0 0 0 4px rgba(231,226,212,0.22), inset 0 0 24px 6px rgba(0,0,0,0.7)',
          }}
        />
        {/* Centered Limelight wordmark */}
        <span
          aria-hidden
          className={`${marquee.className} relative z-[2] select-none leading-none tracking-[0.16em] text-[#E7E2D4]/80`}
          style={{ fontSize: dims.fontPx, textShadow: '0 0 12px rgba(231,226,212,0.18)' }}
        >
          Harlequin
        </span>
        {/* Contained champagne glow tracking the cursor inside the circle */}
        <ContainedMouseGlow color="231, 226, 212" intensity={0.45} size={dims.glow} />
      </motion.button>

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
              autoComplete="off"
              initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0, filter: 'blur(8px)' }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="rounded-2xl border border-white/15 bg-slate-900/90 p-6 shadow-2xl"
            >
              <input
                autoFocus
                type="password"
                id="dev-portal-code"
                name="dev-portal-code"
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                data-bwignore="true"
                data-form-type="other"
                aria-autocomplete="none"
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
