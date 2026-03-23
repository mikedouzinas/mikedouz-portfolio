'use client';

import { useEffect, useRef, useCallback } from 'react';

const NOTES = ['♪', '♫', '♬', '♩'];
const SPAWN_INTERVAL = 450;
const NOTE_LIFETIME = 1600;

interface NoteParticle {
  id: number;
  el: HTMLSpanElement;
  born: number;
}

/**
 * Subtle music notes that float up and outward from the album art.
 * Rendered as an overlay on the art container — parent needs overflow:visible.
 */
export default function FloatingNotes({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<NoteParticle[]>([]);
  const nextIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);

  const spawnNote = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const id = nextIdRef.current++;
    const note = NOTES[id % NOTES.length];
    const el = document.createElement('span');

    // Start from edges of the album art, drift outward
    const side = Math.random();
    let startX: number, startY: number, driftX: number;

    if (side < 0.4) {
      // Right side
      startX = 90 + Math.random() * 20;
      startY = 20 + Math.random() * 60;
      driftX = 8 + Math.random() * 15;
    } else if (side < 0.8) {
      // Left side
      startX = -10 - Math.random() * 10;
      startY = 20 + Math.random() * 60;
      driftX = -(8 + Math.random() * 15);
    } else {
      // Top
      startX = 20 + Math.random() * 60;
      startY = -5;
      driftX = (Math.random() - 0.5) * 20;
    }

    const fontSize = size === 'sm' ? 8 + Math.random() * 3 : 10 + Math.random() * 4;

    el.textContent = note;
    el.style.cssText = `
      position: absolute;
      left: ${startX}%;
      top: ${startY}%;
      font-size: ${fontSize}px;
      color: #1DB954;
      opacity: 0;
      pointer-events: none;
      animation: noteFloat ${NOTE_LIFETIME}ms ease-out forwards;
      --dx: ${driftX}px;
    `;

    wrapper.appendChild(el);
    notesRef.current.push({ id, el, born: Date.now() });
  }, [size]);

  const cleanup = useCallback(() => {
    const now = Date.now();
    notesRef.current = notesRef.current.filter((n) => {
      if (now - n.born > NOTE_LIFETIME + 100) {
        n.el.remove();
        return false;
      }
      return true;
    });
    rafRef.current = requestAnimationFrame(cleanup);
  }, []);

  const spawnBurst = useCallback(() => {
    spawnNote();
    // 50% chance of a second note for density
    if (Math.random() > 0.5) setTimeout(spawnNote, 80);
  }, [spawnNote]);

  useEffect(() => {
    const t = setTimeout(spawnBurst, 100);
    timerRef.current = setInterval(spawnBurst, SPAWN_INTERVAL);
    rafRef.current = requestAnimationFrame(cleanup);

    return () => {
      clearTimeout(t);
      if (timerRef.current) clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      notesRef.current.forEach((n) => n.el.remove());
      notesRef.current = [];
    };
  }, [spawnBurst, cleanup]);

  return (
    <>
      <style>{`
        @keyframes noteFloat {
          0% {
            opacity: 0;
            transform: translateY(0) translateX(0) scale(0.5);
          }
          20% {
            opacity: 0.7;
            transform: translateY(-4px) translateX(calc(var(--dx) * 0.2)) scale(1);
          }
          75% {
            opacity: 0.3;
          }
          100% {
            opacity: 0;
            transform: translateY(-28px) translateX(var(--dx)) scale(0.5);
          }
        }
      `}</style>
      <div
        ref={wrapperRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 10, overflow: 'visible' }}
      />
    </>
  );
}
