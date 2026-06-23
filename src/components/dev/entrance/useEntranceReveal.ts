'use client';
import { useEffect, useState } from 'react';

// Normalized phase windows over the reveal (t in 0..1). Mirrors the approved
// prototype overnight/portal-lockups/entry/entry-reveal.html.
export const ENTRANCE_PHASES = {
  home:   [0.00, 0.16] as const, // homepage crossfade (handled by HomeFadeOverlay timing)
  banner: [0.14, 0.42] as const, // bar wipes FULL WIDTH left→right (slow, deliberate)
  cere:   [0.34, 0.52] as const, // Cere jumps in
  heads:  [0.40, 0.60] as const, // lane headers + counts type
  cards:  [0.56, 1.00] as const, // cards box→type (also gated on data being present)
};

export const ENTRANCE_DURATION_MS = 4400;

/** Drives a normalized clock while `active`. Reduced motion jumps to t=1. */
export function useEntranceReveal(active: boolean): { t: number } {
  const [t, setT] = useState(active ? 0 : 1);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rAF animation clock; synchronous guard + fast-path setT are the only valid pattern here
    if (!active) { setT(1); return; }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setT(1); return; }
    let raf = 0; let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const nt = Math.min((now - start) / ENTRANCE_DURATION_MS, 1);
      setT(nt);
      if (nt < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return { t };
}

export const sub = (t: number, a: number, b: number) =>
  Math.max(0, Math.min(1, (t - a) / (b - a)));
