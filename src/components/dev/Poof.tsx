'use client';

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from 'framer-motion';
import { type ReactNode } from 'react';

/**
 * Poof — a reusable "puff of smoke" appear/disappear effect.
 *
 * Wrap anything that mounts/unmounts behind a boolean and it gets a playful but
 * polished poof: the content puffs out (scale + fade + slight blur) while a ring
 * of soft particles bursts outward, and reverses on open. Everything animates
 * via transform/opacity/filter only — no layout thrash — so it stays cheap.
 *
 * Built reusable on purpose: Cere's bubble uses it now, and the board's
 * Done-action close (#32) can reuse the same component/variant later. Drive the
 * particle tint with `color` ("R, G, B").
 *
 * Note: the wrapper renders `position: relative` and `display: contents`-like
 * sizing is avoided — the caller still owns positioning via the child's own
 * styles. The particle burst is absolutely positioned and pointer-events:none,
 * so it never intercepts clicks.
 */

const POOF_PARTICLES = 8;

const puffTransition: Transition = {
  duration: 0.34,
  ease: [0.22, 1, 0.36, 1],
};

// The resting (`visible`) state must leave NO `transform`/`filter` on the
// wrapper: a non-`none` filter/transform on an ancestor disables descendant
// `backdrop-filter`, which would strip the frost off Cere's glass and leave it
// see-through. So `visible` resolves to `transform: none; filter: none`, and the
// puff transforms/blurs live only in the `hidden`/`exit` states (during the
// open/close motion, where the panel is fading anyway).
const contentVariants = {
  hidden: { opacity: 0, scale: 0.82, filter: 'blur(6px)' },
  visible: { opacity: 1, scale: 1, filter: 'none' },
  exit: { opacity: 0, scale: 1.12, filter: 'blur(8px)' },
};

function PoofParticles({ color }: { color: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center"
    >
      {Array.from({ length: POOF_PARTICLES }).map((_, i) => {
        const angle = (i / POOF_PARTICLES) * Math.PI * 2;
        const distance = 26 + (i % 3) * 8;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        const size = 7 + (i % 3) * 3;
        return (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              background: `radial-gradient(circle, rgba(${color},0.9) 0%, rgba(${color},0) 70%)`,
            }}
            initial={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
            animate={{ x, y, scale: 1.3, opacity: [0, 0.85, 0] }}
            transition={{ duration: 0.42, ease: 'easeOut', delay: i * 0.012 }}
          />
        );
      })}
    </div>
  );
}

export function Poof({
  show,
  children,
  color = '231, 226, 212',
  className = '',
  enter = true,
}: {
  /** When false, the content poofs out and unmounts after the exit animation. */
  show: boolean;
  children: ReactNode;
  /** Particle tint as "R, G, B". Defaults to champagne (THE HARLEQUIN). */
  color?: string;
  className?: string;
  /**
   * When false, skip the open ("poof in") animation: the content mounts
   * directly at rest (no entrance transform/filter, so descendant
   * `backdrop-filter` keeps working) and only the close ("poof out") animation
   * plays on unmount. Cere uses this — Mike kept the close poof but dropped the
   * open one.
   */
  enter?: boolean;
}) {
  const reduce = useReducedMotion();

  // Default to `position: relative` so the particle burst (absolute, inset-0)
  // anchors to the wrapper — but only when the caller hasn't supplied their own
  // positioning. In Tailwind's generated CSS `.relative` is emitted after
  // `.fixed`/`.absolute`, so a naive `relative ${className}` would override a
  // caller's `fixed` regardless of class order and drop the wrapper back into
  // document flow (CerePanel relies on `fixed inset-0` to stay in-viewport).
  const hasPosition = /\b(fixed|absolute|sticky|relative)\b/.test(className);
  const position = hasPosition ? '' : 'relative';

  // Skip the opening animation when `enter` is false or reduced motion is on:
  // `initial={false}` mounts the content straight at the `visible` (rest) state
  // with no entrance transform/filter. The exit animation still plays.
  const skipEnter = !enter || reduce;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={`${position} ${className}`.trim()}
          variants={contentVariants}
          initial={skipEnter ? false : 'hidden'}
          animate="visible"
          exit={reduce ? 'visible' : 'exit'}
          transition={puffTransition}
        >
          {/* Opening particle burst only when an open animation is requested. */}
          {enter && !reduce && <PoofParticles color={color} />}
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
