/**
 * HARLEQUIN page-transition trigger channel.
 *
 * The magician's ENTER (homepage → board) and the disintegration EXIT (board →
 * homepage) are played by a single overlay that lives in the ROOT layout
 * (`HarlequinTransitionHost`), so the same WebGL surface survives the route
 * change. Triggers live in different route subtrees — the homepage passcode
 * card fires `enter`, the /dev back-diamond + logout fire `exit` — so they reach
 * the host through this module-level pub/sub instead of React context (no
 * app-wide re-render; the host is the only subscriber).
 *
 * If no host is mounted (it's in the root layout, so this shouldn't happen) we
 * fall back to a hard navigation so the user always ends up where they meant to.
 */

export type HarlequinTransitionKind = 'enter' | 'exit';

type Listener = (kind: HarlequinTransitionKind) => void;

const listeners = new Set<Listener>();

/** The host registers here on mount; returns an unsubscribe. */
export function onHarlequinTransition(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Fire a page transition (or hard-navigate if the host isn't listening). */
export function requestHarlequinTransition(kind: HarlequinTransitionKind): void {
  if (listeners.size === 0) {
    if (typeof window !== 'undefined') {
      window.location.href = kind === 'enter' ? '/dev' : '/';
    }
    return;
  }
  for (const fn of listeners) fn(kind);
}
