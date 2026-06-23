'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { onHarlequinTransition } from './store';

// Lazy — the WebGL exit overlay (and html2canvas inside the snapshot path) only
// loads when a transition actually fires, so it never enters the homepage bundle.
const HarlequinExit = dynamic(
  () => import('@/components/dev/HarlequinExit').then((m) => m.HarlequinExit),
  { ssr: false },
);

const ENTER_TARGET = '/dev';
const EXIT_TARGET = '/';
// The destination's root marker — we wait for THIS in the DOM (proof the target
// page has mounted + painted underneath the cover) before revealing/arming.
const ENTER_MARKER = '[data-board-root]';
const EXIT_MARKER = '[data-home-root]';

// If the marker never appears, proceed anyway so we never hang on a cover.
const NAV_FAILSAFE_MS = 3500;
// Whole-transition backstop: if the overlay never finishes, hard-navigate.
const DONE_FAILSAFE_MS = 8000;

type Active = { kind: 'enter' | 'exit'; navStarted: boolean } | null;

/**
 * HarlequinTransitionHost — mounted once in the root layout. Plays the entrance
 * build over the CURRENT page, navigates client-side (so this overlay survives
 * the route change), then reveals the destination once it has actually PAINTED
 * underneath. Same surface for the exit, in reverse.
 *
 * Flow (enter): build over homepage → `onAssembled` → router.push('/dev') →
 *   wait for [data-board-root] to paint → `revealReady` → overlay dims to board.
 * Flow (exit): snapshot the board (cover stays up) → `onSnapshotReady` →
 *   router.push('/') → wait for [data-home-root] to paint → `armed` →
 *   disintegrate, revealing the now-painted homepage beneath.
 *
 * The reveal gate is the destination's DOM MARKER, not the URL: usePathname
 * flips a beat before the new route paints, which let the dissolve briefly
 * reveal the OLD board. Waiting for the marker (+1 frame) guarantees the target
 * is on screen first.
 */
export function HarlequinTransitionHost() {
  const router = useRouter();
  const [active, setActive] = useState<Active>(null);
  const [proceedNow, setProceedNow] = useState(false); // marker painted OR failsafe

  // Guard against a second transition while one is mid-flight. Written only in
  // callbacks (the trigger + reset), never during render.
  const inFlightRef = useRef(false);
  const navFired = useRef(false);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (navTimer.current) {
      clearTimeout(navTimer.current);
      navTimer.current = null;
    }
    if (doneTimer.current) {
      clearTimeout(doneTimer.current);
      doneTimer.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    inFlightRef.current = false;
    navFired.current = false;
    setActive(null);
    setProceedNow(false);
  }, [clearTimers]);

  // Register the trigger channel once. setState here runs in the subscription
  // callback (a transition request), not synchronously in the effect body.
  useEffect(() => {
    return onHarlequinTransition((kind) => {
      if (kind === 'enter') {
        // The old argyle entrance is retired (the Mark-42 assemble will replace
        // it). For now, entering the board is a plain client navigation — no
        // overlay, no argyle build that conflated with the exit.
        router.push(ENTER_TARGET);
        return;
      }
      if (inFlightRef.current) return; // one transition at a time
      inFlightRef.current = true;
      navFired.current = false;
      clearTimers();
      setProceedNow(false);
      // Warm the destination so the cover-hold after nav stays short.
      router.prefetch(EXIT_TARGET);
      // Whole-transition backstop — hard-nav if we somehow never finish.
      doneTimer.current = setTimeout(() => {
        window.location.href = EXIT_TARGET;
      }, DONE_FAILSAFE_MS);
      setActive({ kind, navStarted: false });
    });
  }, [clearTimers, router]);

  // When the overlay says its cover is up (`navStarted`), push the route ONCE,
  // start watching for the destination marker, and arm the nav failsafe. No
  // synchronous setState in the effect body — both set state from callbacks.
  useEffect(() => {
    if (!active || !active.navStarted || navFired.current) return;
    navFired.current = true;
    const isEnter = active.kind === 'enter';
    router.push(isEnter ? ENTER_TARGET : EXIT_TARGET);

    const selector = isEnter ? ENTER_MARKER : EXIT_MARKER;
    let raf = 0;
    const check = () => {
      if (document.querySelector(selector)) {
        // +1 frame so the destination has actually painted before we reveal it.
        raf = requestAnimationFrame(() => setProceedNow(true));
        return;
      }
      raf = requestAnimationFrame(check);
    };
    raf = requestAnimationFrame(check);

    navTimer.current = setTimeout(() => setProceedNow(true), NAV_FAILSAFE_MS);

    return () => cancelAnimationFrame(raf);
  }, [active, router]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const markNavStarted = useCallback(() => {
    setActive((cur) => (cur && !cur.navStarted ? { ...cur, navStarted: true } : cur));
  }, []);

  if (!active) return null;

  // Only the exit plays an overlay now; 'enter' navigates directly (see above).
  return <HarlequinExit armed={proceedNow} onSnapshotReady={markNavStarted} onDone={reset} />;
}
