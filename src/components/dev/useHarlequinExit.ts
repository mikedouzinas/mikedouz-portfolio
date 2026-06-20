'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useHarlequinExit — shared trigger for the diamond-ash disintegration on
 * leaving the board. Both the back-diamond (HarlequinTitle, session kept) and
 * logout (page.tsx, session ended) use this so they play the SAME animation.
 *
 * Flow:
 *   1. Caller runs `start(beforeNavigate?)`. `beforeNavigate` is an optional
 *      async step that MUST complete before leaving (logout passes the DELETE
 *      that ends the session; the back-diamond passes nothing).
 *   2. `exiting` flips true → caller renders <HarlequinExit onDone={navigate} />.
 *   3. When the animation's onDone fires (or the failsafe trips), we navigate
 *      to `/` exactly once.
 *
 * Failsafe: a hard timeout guarantees navigation even if the snapshot or anim
 * fails / onDone never fires. `navigate` is idempotent (guarded so a
 * double-trigger can't double-assign).
 */
const FAILSAFE_MS = 2600;

export function useHarlequinExit() {
  const [exiting, setExiting] = useState(false);
  const navigated = useRef(false);
  const failsafe = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useCallback(() => {
    if (navigated.current) return;
    navigated.current = true;
    if (failsafe.current) clearTimeout(failsafe.current);
    window.location.href = '/';
  }, []);

  const start = useCallback(
    async (beforeNavigate?: () => Promise<void> | void) => {
      setExiting((prev) => {
        if (prev) return prev;
        // Arm the failsafe so an interrupted/failed snapshot or anim still
        // navigates. The session-ending step (if any) runs in parallel.
        failsafe.current = setTimeout(navigate, FAILSAFE_MS);
        return true;
      });
      try {
        await beforeNavigate?.();
      } catch {
        // Even if the pre-navigate step fails, we still leave — the failsafe or
        // the animation's onDone carries us to `/`.
      }
    },
    [navigate],
  );

  useEffect(() => {
    return () => {
      if (failsafe.current) clearTimeout(failsafe.current);
    };
  }, []);

  return { exiting, start, navigate };
}
