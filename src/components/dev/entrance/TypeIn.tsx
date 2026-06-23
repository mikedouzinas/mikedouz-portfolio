'use client';
import { useEffect, useRef, useState } from 'react';

export function TypeIn({
  text, active, durationMs = 600, startDelayMs = 0, caret = true,
}: { text: string; active: boolean; durationMs?: number; startDelayMs?: number; caret?: boolean; }) {
  const [n, setN] = useState(active ? 0 : text.length);
  const raf = useRef(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rAF animation clock; fast-path setN calls are synchronous guards before the rAF loop, not derived state
    if (!active) { setN(text.length); return; }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setN(text.length); return; }
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now + startDelayMs;
      const e = Math.max(0, now - start);
      setN(Math.min(text.length, Math.round((e / durationMs) * text.length)));
      if (e < durationMs) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [active, text, durationMs, startDelayMs]);
  const done = n >= text.length;
  return <>{text.slice(0, n)}{active && !done && caret ? <span className="hq-caret">▍</span> : null}</>;
}
