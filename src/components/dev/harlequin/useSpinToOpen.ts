'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Spin-to-open detection — ported verbatim from the approved lockups
 * (`portal-circle-v2.html`, `variant-c2.html`, `window-frost.html`). All three
 * share the exact same math: accumulate clockwise angular delta as the cursor
 * orbits the shape's center; a significant counter-clockwise move softly resets;
 * reaching ~680° fires `onOpen` once. Idle > 1800ms resets.
 *
 * `feed(angle)` is called from each face's mousemove handler with the cursor
 * angle (radians, atan2) about the shape center. `reset()` clears accumulation
 * (used on leave). `opened` is a ref the face flips when the panel is showing
 * so spin tracking pauses.
 */

const SPIN_THRESHOLD = 680; // degrees needed (~almost two full rotations)
const SPIN_RESET_MS = 1800; // reset if idle > this

export function useSpinToOpen(onOpen: () => void) {
  const lastAngle = useRef<number | null>(null);
  const spinAccumulated = useRef(0);
  const spinResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedRef = useRef(false);

  const reset = useCallback(() => {
    lastAngle.current = null;
    spinAccumulated.current = 0;
    if (spinResetTimer.current) clearTimeout(spinResetTimer.current);
  }, []);

  const feed = useCallback(
    (angle: number) => {
      if (openedRef.current) return;
      if (lastAngle.current === null) {
        lastAngle.current = angle;
        return;
      }
      let delta = angle - lastAngle.current;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;

      const deltaDeg = delta * (180 / Math.PI);
      if (deltaDeg > 0) {
        spinAccumulated.current += deltaDeg;
      } else if (deltaDeg < -15) {
        // significant counter-clockwise = soft reset
        spinAccumulated.current = Math.max(
          0,
          spinAccumulated.current - Math.abs(deltaDeg) * 0.5,
        );
      }
      lastAngle.current = angle;

      if (spinResetTimer.current) clearTimeout(spinResetTimer.current);
      spinResetTimer.current = setTimeout(reset, SPIN_RESET_MS);

      if (spinAccumulated.current >= SPIN_THRESHOLD && !openedRef.current) {
        openedRef.current = true;
        onOpen();
        reset();
      }
    },
    [onOpen, reset],
  );

  // The face flips this when the passcode panel opens / closes.
  const setOpened = useCallback((value: boolean) => {
    openedRef.current = value;
  }, []);

  useEffect(
    () => () => {
      if (spinResetTimer.current) clearTimeout(spinResetTimer.current);
    },
    [],
  );

  return { feed, reset, setOpened, openedRef };
}
