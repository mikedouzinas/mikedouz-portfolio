/**
 * One-shot "play the entrance" signal that survives the home → /dev navigation.
 * Set at passcode-success; consumed (read + cleared) once by the /dev page on
 * mount, so a refresh or second mount renders the board normally.
 * sessionStorage (not a module variable) so it survives the full-document load
 * that a fresh route can incur.
 */
const KEY = 'hq-entrance';

export function markEntrance(): void {
  try { sessionStorage.setItem(KEY, '1'); } catch { /* private mode — entrance just won't play */ }
}

export function consumeEntrance(): boolean {
  try {
    const on = sessionStorage.getItem(KEY) === '1';
    if (on) sessionStorage.removeItem(KEY);
    return on;
  } catch {
    return false;
  }
}
