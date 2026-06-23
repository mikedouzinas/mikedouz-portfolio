/**
 * Eager board snapshot cache for the HARLEQUIN exit.
 *
 * The disintegration EXIT needs a pixel-perfect, OPAQUE image of the live `/dev`
 * board to use as the cover that the diamonds erode away from. The previous
 * attempt ran html2canvas at CLICK time — a ~600–700ms (plus lazy-import) stall
 * during which the board just sat there doing nothing. That dead delay was the
 * single biggest reason the exit "felt wrong."
 *
 * Fix: capture the board AHEAD of the click and cache it here, so when the user
 * hits the back-diamond the cover is ready instantly and the dissolve starts on
 * the very next frame. We refresh the capture when the board is idle and again
 * when the pointer enters the back affordance (the freshest possible frame right
 * before a likely click). `HarlequinExit` reads `getBoardSnapshot()` first and
 * only falls back to a click-time capture if nothing is cached.
 */

type Snapshot = { canvas: HTMLCanvasElement; at: number };

const BASE = '#0d0b11'; // matches .dev-workpad background-color exactly (no gray wash)

let cached: Snapshot | null = null;
let capturing = false;
let scheduled: ReturnType<typeof setTimeout> | null = null;

/** The most recent cached board snapshot, or null if none captured yet. */
export function getBoardSnapshot(): Snapshot | null {
  return cached;
}

export function clearBoardSnapshot(): void {
  cached = null;
}

/**
 * Capture the live board into an opaque canvas and cache it. Guarded so only one
 * capture runs at a time; cheap to call repeatedly. Never throws.
 */
export async function captureBoardSnapshot(): Promise<void> {
  if (capturing || typeof window === 'undefined') return;
  const root = document.querySelector('[data-board-root]') as HTMLElement | null;
  if (!root) return;
  capturing = true;
  try {
    const { default: html2canvas } = await import('html2canvas');
    // The cover only ever shows the VISIBLE viewport. On mobile the board is a
    // tall single column, so laying out its FULL scroll height at 2x cost ~1.4s
    // — re-introducing the very "dead delay" the eager snapshot exists to kill.
    // On small screens, cap the layout to one screen (windowHeight) and drop the
    // scale; desktop keeps the full-document capture (already fast, leave it).
    const mobile = window.innerWidth < 768;
    const canvas = await html2canvas(root, {
      backgroundColor: BASE,
      scale: mobile ? 1.5 : Math.max(2, Math.min(window.devicePixelRatio || 1, 2)),
      logging: false,
      useCORS: true,
      x: window.scrollX,
      y: window.scrollY,
      width: window.innerWidth,
      height: window.innerHeight,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: mobile ? window.innerHeight : document.documentElement.scrollHeight,
      // Skip <canvas> elements: html2canvas calls getContext('2d') on each, which
      // would poison any live WebGL canvas on the board with a 2D context.
      ignoreElements: (el: Element) => el.tagName === 'CANVAS',
    });
    if (canvas.width > 0 && canvas.height > 0) {
      cached = { canvas, at: Date.now() };
    }
  } catch {
    /* leave the previous cache in place; exit falls back to a click capture */
  } finally {
    capturing = false;
  }
}

/** Debounced capture — coalesces bursts of idle/scroll/hover triggers. */
export function scheduleBoardSnapshot(delay = 250): void {
  if (scheduled) clearTimeout(scheduled);
  scheduled = setTimeout(() => {
    scheduled = null;
    void captureBoardSnapshot();
  }, delay);
}
