'use client';

import { useEffect, useRef, useState } from 'react';

// A dim harlequin argyle (red diamonds, white outline) that only shows in a
// tight soft circle under the cursor — the page stays dark and legible, the
// motif blooms on interaction. Same radial-mask reveal as the blog's WebPattern.
// Transparent tile (no black filler) so the dark page reads as the black diamonds.
const TILE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Cpolygon points='28,2 54,28 28,54 2,28' fill='%23B3122B' stroke='%23EDE6D6' stroke-width='1'/%3E%3C/svg%3E\")";

export function HarlequinReveal() {
  const [pos, setPos] = useState({ x: -1000, y: -1000 });
  const raf = useRef(0);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (raf.current) return;
      const target = e.target as Element | null;
      const x = e.clientX;
      const y = e.clientY;
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        // Hide the bloom over the header and over individual tickets — the
        // argyle only reveals on the bare board (see [data-suppress-reveal]).
        if (target?.closest?.('[data-suppress-reveal]')) {
          setPos({ x: -1000, y: -1000 });
        } else {
          setPos({ x, y });
        }
      });
    }
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  const mask = `radial-gradient(circle 130px at ${pos.x}px ${pos.y}px, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.32) 52%, transparent 100%)`;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        backgroundImage: TILE,
        backgroundSize: '56px 56px',
        opacity: 0.36,
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    />
  );
}
