/**
 * Captures the homepage ([data-home-root]) into an opaque canvas at
 * passcode-success, so the entrance can crossfade the portfolio INTO the /dev
 * workpad backdrop. Mirrors boardSnapshot.ts (lazy html2canvas, ignore <canvas>).
 */
let cached: HTMLCanvasElement | null = null;
let capturing = false;

export function getHomeSnapshot(): HTMLCanvasElement | null { return cached; }
export function clearHomeSnapshot(): void { cached = null; }

export async function captureHomeSnapshot(): Promise<void> {
  if (capturing || typeof window === 'undefined') return;
  const root = document.querySelector('[data-home-root]') as HTMLElement | null;
  if (!root) return;
  capturing = true;
  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(root, {
      backgroundColor: '#0d0b11',
      scale: Math.max(1, Math.min(window.devicePixelRatio || 1, 1.5)),
      logging: false,
      useCORS: true,
      x: window.scrollX, y: window.scrollY,
      width: window.innerWidth, height: window.innerHeight,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
      ignoreElements: (el: Element) => el.tagName === 'CANVAS',
    });
    if (canvas.width > 0 && canvas.height > 0) cached = canvas;
  } catch { /* fall back to no crossfade */ } finally { capturing = false; }
}
