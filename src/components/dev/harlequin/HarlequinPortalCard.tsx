'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Limelight } from 'next/font/google';
import BaseCard from '@/components/base_card';
import { useSpinToOpen } from './useSpinToOpen';
import { usePasscodeAuth } from './usePasscodeAuth';
import type { HarlequinShapeId } from './shapes';
import { getShape } from './shapes';

const limelight = Limelight({ weight: '400', subsets: ['latin'], display: 'swap' });

const LONG_PRESS_MS = 600;
const TAP_COUNT_TO_OPEN = 5;
const TAP_WINDOW_MS = 1500;

/**
 * HarlequinPortalCard — the productionized portal as a project card. Renders the
 * project-card chrome (BaseCard with indigo project glow + the "The Harlequin"
 * Limelight title, NO description / skills / GitHub) wrapping one of the three
 * HARLEQUIN faces (circle / diamond / window).
 *
 * Shared behavior lives here and is passed to the face: `useSpinToOpen` (the
 * ~680° spin gesture) reveals the passcode panel, and `usePasscodeAuth` submits
 * to the real `POST /api/dev/auth` and redirects to `/dev` on success. Legacy
 * fallbacks are preserved: global ⌘⇧K, mobile long-press (~600ms), and 5 quick
 * taps. The portal page (mobile/keyboard) entrypoints match `PortalCircle.tsx`.
 */
export function HarlequinPortalCard({ shape }: { shape: HarlequinShapeId }) {
  const { Face } = getShape(shape);

  const [revealed, setRevealed] = useState(false);
  const passcode = usePasscodeAuth();
  const openedRef = useRef(false);

  const reveal = useCallback(() => {
    passcode.clear(); // never reopen pre-filled (autofill)
    setRevealed(true);
    setTimeout(() => passcode.focusInput(), 320);
  }, [passcode]);

  const openPortal = useCallback(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    reveal();
  }, [reveal]);

  const spin = useSpinToOpen(openPortal);

  const resetPortal = useCallback(() => {
    openedRef.current = false;
    setRevealed(false);
    passcode.clear();
    spin.reset();
    spin.setOpened(false);
  }, [passcode, spin]);

  // Keep the spin hook's opened flag in sync so it pauses while revealed.
  useEffect(() => {
    spin.setOpened(revealed);
  }, [revealed, spin]);

  // On leave: soft-reset spin if not opened, else fully reset the portal.
  const onLeave = useCallback(() => {
    if (!openedRef.current) {
      spin.reset();
    } else {
      resetPortal();
    }
  }, [resetPortal, spin]);

  // ── global ⌘⇧K (Ctrl+Shift+K) reveals the passcode from anywhere ──
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const modifier = e.metaKey || e.ctrlKey;
      if (modifier && e.shiftKey && e.code === 'KeyK') {
        e.preventDefault();
        e.stopPropagation();
        reveal();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [reveal]);

  // ── mobile secret trigger: long-press (~600ms) OR 5 quick taps ──
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const tapTimes = useRef<number[]>([]);

  const cancelPress = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const onTouchStart = useCallback(() => {
    longPressFired.current = false;
    cancelPress();
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      reveal();
    }, LONG_PRESS_MS);
  }, [cancelPress, reveal]);

  const onTouchEnd = useCallback(() => {
    cancelPress();
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    const now = Date.now();
    tapTimes.current = [...tapTimes.current, now].filter(
      (t) => now - t <= TAP_WINDOW_MS,
    );
    if (tapTimes.current.length >= TAP_COUNT_TO_OPEN) {
      tapTimes.current = [];
      reveal();
    }
  }, [cancelPress, reveal]);

  useEffect(() => () => cancelPress(), [cancelPress]);

  return (
    <BaseCard glowColor="99, 102, 241" glowIntensity={0.35}>
      <div
        className="flex flex-col-reverse md:grid gap-x-4 items-center"
        style={{ gridTemplateColumns: 'minmax(150px, 220px) minmax(265px, 1fr)' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={cancelPress}
        onTouchMove={cancelPress}
      >
        {/* thumbnail zone — centers the portal face */}
        <div
          className="mt-6 md:mt-0 flex items-center justify-center"
          style={{ minHeight: 148 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Face
            passcode={passcode}
            spin={spin}
            revealed={revealed}
            onLeave={onLeave}
            onReveal={reveal}
          />
        </div>

        {/* title only — no description, skills, or GitHub */}
        <div className="flex flex-col">
          <h3
            className={`text-xl text-gray-900 dark:text-gray-200 ${limelight.className}`}
            style={{ letterSpacing: '0.04em' }}
          >
            The Harlequin
          </h3>
        </div>
      </div>
    </BaseCard>
  );
}
