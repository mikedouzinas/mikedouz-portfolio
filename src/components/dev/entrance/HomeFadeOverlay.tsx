'use client';
import { useEffect, useRef, useState } from 'react';
import { getHomeSnapshot, clearHomeSnapshot } from '@/components/dev/transition/homeSnapshot';

/**
 * Shows the captured homepage over the freshly-mounted board, then fades it out
 * to reveal the workpad backdrop. No snapshot (or reduced motion) → renders
 * nothing and reports done immediately.
 */
export function HomeFadeOverlay({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLImageElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const snap = getHomeSnapshot();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!snap || reduced) { clearHomeSnapshot(); onDoneRef.current(); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time init from a module singleton, not derived state
    setUrl(snap.toDataURL('image/png'));
    clearHomeSnapshot();
  }, []);

  useEffect(() => {
    if (!url) return;
    const el = ref.current;
    if (!el) return;
    // start opaque, fade to 0 on the next frame
    const r1 = requestAnimationFrame(() => { el.style.opacity = '0'; });
    const t = setTimeout(() => onDoneRef.current(), 320);
    return () => { cancelAnimationFrame(r1); clearTimeout(t); };
  }, [url]);

  if (!url) return null;
  return (
    <img
      ref={ref}
      src={url}
      alt=""
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[120] h-full w-full object-cover"
      style={{ opacity: 1, transition: 'opacity 300ms ease' }}
    />
  );
}
