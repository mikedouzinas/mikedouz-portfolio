# HARLEQUIN Entry Reveal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user unlocks `/dev`, the board reveals itself sequentially — the homepage fades into the workpad backdrop, the banner wipes in edge-to-edge left→right, Cere jumps into place, column headers + counts type in, and each ticket card's box flies in then its title types in as the GitHub issues load.

**Architecture:** The reveal animates the **real `/dev` board DOM** as it mounts (it is NOT a WebGL/texture effect like the exit). A one-shot `sessionStorage` signal set at passcode-success tells the freshly-mounted `/dev` page to play the reveal. A captured homepage snapshot crossfades into the workpad. The board page drives a time-based phase timeline and passes an entrance context to its header and `IssueList`, which reveal via CSS classes + a small `TypeIn` leaf component. Card titles type in as issues arrive (the "box→type" order makes the animation robust to async data).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript (strict, no `any`), Framer Motion (already used on the board), `html2canvas` (already used by the exit snapshot), CSS keyframes in `globals.css`.

## Global Constraints

- TypeScript strict mode, **no `any`**. Type all props/returns.
- This repo has **no generic unit-test runner** (only `npm run test:iris`, a bespoke suite). Verification is: `npx tsc --noEmit` (must exit 0), `npx eslint <files>` (0 errors), and **visual verification in Playwright** against the approved standalone prototype `overnight/portal-lockups/entry/entry-reveal.html` (with `order = box → type`). The prototype is the visual spec.
- **Respect `prefers-reduced-motion: reduce`** in every animated piece — skip to the final board, no animation. Follow the existing pattern: Framer `useReducedMotion()`, or `window.matchMedia('(prefers-reduced-motion: reduce)').matches` for raw JS.
- Lazy-load `html2canvas` (dynamic `import()`) — keep it off the homepage bundle, exactly as `boardSnapshot.ts` does.
- Champagne duotone palette: ink `#0d0b11`, champagne `#e7e2d4`/`#E7E2D4`, green `#27b06f`, red `#b3122b`. Wordmark font is Limelight (already wired in `HarlequinTitle.tsx`). **No new fonts.**
- The entrance ONLY plays on the passcode-unlock path. Direct navigation / existing-session mounts render normally (no entrance). Do not change non-entrance behavior.
- Commit after each task. Branch: `feat/portal-transitions` (already checked out).

## Testing the entrance locally (the passcode is unreachable)

The real passcode hash can't be reversed, so the passcode-success path can't be fired in a test browser. To exercise the entrance in Playwright:
1. Mint a `dev_session` JWT and set it as a cookie via Playwright `context.addCookies()` (see `reference-dev-test-session`; note `document.cookie` writes are blocked in the MCP browser — use `context.addCookies`).
2. Before navigating to `/dev`, set the entrance signal manually: `sessionStorage.setItem('hq-entrance', '1')`, and (for the home crossfade) the page falls back gracefully if no home snapshot is cached.
3. Navigate to `/dev` and capture frames.
Playwright **can** screenshot this entrance (it is plain DOM, unlike the WebGL exit).

## File Structure

- `src/components/dev/transition/entranceSignal.ts` *(new)* — one-shot cross-navigation signal (`markEntrance` / `consumeEntrance`).
- `src/components/dev/transition/homeSnapshot.ts` *(new)* — capture/get the homepage `[data-home-root]` snapshot for the crossfade (mirrors `boardSnapshot.ts`).
- `src/components/dev/entrance/useEntranceReveal.ts` *(new)* — the entrance phase-timeline hook (returns phase progress 0..1 per phase from a start timestamp + rAF).
- `src/components/dev/entrance/TypeIn.tsx` *(new)* — leaf component that reveals text character-by-character when active (used for wordmark, lane labels, card titles).
- `src/components/dev/entrance/HomeFadeOverlay.tsx` *(new)* — fixed overlay that shows the home snapshot and fades it out over the workpad on mount.
- `src/styles/globals.css` *(modify)* — entrance keyframes/classes (banner edge-to-edge wipe, Cere jump, caret).
- `src/components/dev/harlequin/usePasscodeAuth.ts` *(modify)* — on success: capture home snapshot + `markEntrance()` before navigating.
- `src/app/dev/page.tsx` *(modify)* — detect entrance on mount, drive the timeline, render `HomeFadeOverlay`, apply header/Cere classes, suppress the normal loader during entrance, pass entrance context to `IssueList`.
- `src/components/dev/IssueList.tsx` *(modify)* — accept an `entrance` prop; reveal lane headers (type label + count-up) and cards (box-in then `TypeIn` title), staggered in reading order.
- `src/components/dev/HarlequinTitle.tsx` *(modify)* — optionally type the wordmark via `TypeIn` when entrance is active.

---

### Task 1: Entrance one-shot signal

**Files:**
- Create: `src/components/dev/transition/entranceSignal.ts`
- Modify: `src/components/dev/harlequin/usePasscodeAuth.ts` (around line 41–46)
- Modify: `src/app/dev/page.tsx` (add a mount effect near the existing effects ~line 110–127)

**Interfaces:**
- Produces: `markEntrance(): void`, `consumeEntrance(): boolean` (reads the flag and clears it so it fires once).

- [ ] **Step 1: Create the signal module**

```ts
// src/components/dev/transition/entranceSignal.ts
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
```

- [ ] **Step 2: Set the signal on passcode success**

In `usePasscodeAuth.ts`, import and call `markEntrance()` immediately before the existing `requestHarlequinTransition('enter')` (line ~45):

```ts
import { markEntrance } from '@/components/dev/transition/entranceSignal';
// ...
        if (res.ok) {
          // Arm the sequential board reveal, then navigate to /dev.
          markEntrance();
          requestHarlequinTransition('enter');
          return;
        }
```

- [ ] **Step 3: Consume the signal on the /dev page**

In `src/app/dev/page.tsx`, add state + a mount effect (place the effect with the other mount effects). Import `consumeEntrance`.

```tsx
import { consumeEntrance } from '@/components/dev/transition/entranceSignal';
// inside the component, with the other useState calls:
const [entrance, setEntrance] = useState(false);
// with the other mount effects:
useEffect(() => {
  // Read-once: did we just unlock? If so, play the reveal.
  if (consumeEntrance()) setEntrance(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

- [ ] **Step 4: Verify types + lint**

Run: `npx tsc --noEmit && npx eslint src/components/dev/transition/entranceSignal.ts src/components/dev/harlequin/usePasscodeAuth.ts src/app/dev/page.tsx`
Expected: tsc exits 0; eslint reports 0 errors.

- [ ] **Step 5: Verify the one-shot behavior in Playwright**

Set a session cookie via `context.addCookies`. Then: `sessionStorage.setItem('hq-entrance','1')`, navigate to `/dev`, and `evaluate(() => sessionStorage.getItem('hq-entrance'))` → expect `null` (consumed). Reload `/dev` → the flag stays `null` (no entrance on refresh).

- [ ] **Step 6: Commit**

```bash
git add src/components/dev/transition/entranceSignal.ts src/components/dev/harlequin/usePasscodeAuth.ts src/app/dev/page.tsx
git commit -m "feat(dev): one-shot entrance signal from passcode unlock into /dev"
```

---

### Task 2: Homepage snapshot + home→workpad crossfade overlay

**Files:**
- Create: `src/components/dev/transition/homeSnapshot.ts`
- Create: `src/components/dev/entrance/HomeFadeOverlay.tsx`
- Modify: `src/components/dev/harlequin/usePasscodeAuth.ts` (capture before nav)
- Modify: `src/app/dev/page.tsx` (render the overlay when `entrance`)

**Interfaces:**
- Consumes: nothing.
- Produces: `captureHomeSnapshot(): Promise<void>`, `getHomeSnapshot(): HTMLCanvasElement | null`, `clearHomeSnapshot(): void`; `<HomeFadeOverlay onDone={() => void} />`.

- [ ] **Step 1: Create the homepage snapshot module** (mirror `boardSnapshot.ts`, different selector)

```ts
// src/components/dev/transition/homeSnapshot.ts
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
```

- [ ] **Step 2: Capture the homepage on passcode success (before nav)**

In `usePasscodeAuth.ts`, capture just before `markEntrance()`. `await` it briefly but cap it so a slow capture never blocks the unlock — fire-and-forget is fine because the overlay degrades gracefully:

```ts
import { captureHomeSnapshot } from '@/components/dev/transition/homeSnapshot';
// ... on success, before markEntrance():
          void captureHomeSnapshot(); // best-effort; overlay no-ops if absent
          markEntrance();
          requestHarlequinTransition('enter');
```

- [ ] **Step 3: Create the crossfade overlay**

```tsx
// src/components/dev/entrance/HomeFadeOverlay.tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { getHomeSnapshot, clearHomeSnapshot } from '@/components/dev/transition/homeSnapshot';

/**
 * Shows the captured homepage over the freshly-mounted board, then fades it out
 * to reveal the workpad backdrop. No snapshot (or reduced motion) → renders
 * nothing and reports done immediately.
 */
export function HomeFadeOverlay({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const snap = getHomeSnapshot();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!snap || reduced) { clearHomeSnapshot(); onDoneRef.current(); return; }
    setUrl(snap.toDataURL('image/png'));
    clearHomeSnapshot();
  }, []);

  useEffect(() => {
    if (!url) return;
    const el = ref.current;
    if (!el) return;
    // start opaque, fade to 0 on the next frame
    const r1 = requestAnimationFrame(() => { el.style.opacity = '0'; });
    const t = setTimeout(() => onDoneRef.current(), 320);
    return () => { cancelAnimationFrame(r1); clearTimeout(t); };
  }, [url]);

  if (!url) return null;
  return (
    <img
      ref={ref as unknown as React.RefObject<HTMLImageElement>}
      src={url}
      alt=""
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[120] h-full w-full object-cover"
      style={{ opacity: 1, transition: 'opacity 300ms ease' }}
    />
  );
}
```

> Note: the ref is typed for `HTMLImageElement`; adjust the `useRef<HTMLImageElement>(null)` declaration to match (drop the canvas cast). Keep it an `<img>`.

- [ ] **Step 4: Render the overlay during entrance**

In `page.tsx`, inside the `[data-board-root]` container (so it sits over the board), render when `entrance` and not yet faded. Add `const [homeFaded, setHomeFaded] = useState(false);` and:

```tsx
{entrance && !homeFaded && <HomeFadeOverlay onDone={() => setHomeFaded(true)} />}
```

- [ ] **Step 5: Verify types + lint**

Run: `npx tsc --noEmit && npx eslint src/components/dev/transition/homeSnapshot.ts src/components/dev/entrance/HomeFadeOverlay.tsx src/app/dev/page.tsx`
Expected: 0 errors.

- [ ] **Step 6: Visual verify in Playwright**

With the session cookie set and `hq-entrance` armed, first load `/` and run a manual capture (`evaluate` importing `captureHomeSnapshot` is not possible across modules — instead verify the graceful no-snapshot path: the overlay should be absent and the board should still reveal). Then confirm: when a snapshot IS present (test by navigating `/` → trigger capture via a temporary `window.__cap` hook you add then remove, OR accept that the crossfade is verified by Mike on the real unlock). Capture an entrance frame; expect the board visible (no error), overlay fading.

- [ ] **Step 7: Commit**

```bash
git add src/components/dev/transition/homeSnapshot.ts src/components/dev/entrance/HomeFadeOverlay.tsx src/components/dev/harlequin/usePasscodeAuth.ts src/app/dev/page.tsx
git commit -m "feat(dev): homepage→workpad crossfade at the start of the board entrance"
```

---

### Task 3: Entrance timeline hook + banner edge-to-edge wipe + Cere jump

**Files:**
- Create: `src/components/dev/entrance/useEntranceReveal.ts`
- Modify: `src/styles/globals.css` (keyframes/classes)
- Modify: `src/app/dev/page.tsx` (apply classes to `<header>` and the Cere wrapper)

**Interfaces:**
- Consumes: `entrance: boolean` from Task 1.
- Produces: `useEntranceReveal(active: boolean): { t: number }` — `t` is elapsed-normalized 0..1 over the whole reveal (drives CSS via a CSS variable and/or phase booleans). Also exports phase windows `ENTRANCE_PHASES`.

- [ ] **Step 1: Create the timeline hook**

```ts
// src/components/dev/entrance/useEntranceReveal.ts
'use client';
import { useEffect, useState } from 'react';

// Normalized phase windows over the reveal (t in 0..1). Mirrors the approved
// prototype overnight/portal-lockups/entry/entry-reveal.html.
export const ENTRANCE_PHASES = {
  home:   [0.00, 0.16] as const, // homepage crossfade (handled by HomeFadeOverlay timing)
  banner: [0.14, 0.42] as const, // bar wipes FULL WIDTH left→right (slow, deliberate)
  cere:   [0.34, 0.52] as const, // Cere jumps in
  heads:  [0.40, 0.60] as const, // lane headers + counts type
  cards:  [0.56, 1.00] as const, // cards box→type (also gated on data being present)
};

export const ENTRANCE_DURATION_MS = 4400;

/** Drives a normalized clock while `active`. Reduced motion jumps to t=1. */
export function useEntranceReveal(active: boolean): { t: number } {
  const [t, setT] = useState(active ? 0 : 1);
  useEffect(() => {
    if (!active) { setT(1); return; }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setT(1); return; }
    let raf = 0; let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const nt = Math.min((now - start) / ENTRANCE_DURATION_MS, 1);
      setT(nt);
      if (nt < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return { t };
}

export const sub = (t: number, a: number, b: number) =>
  Math.max(0, Math.min(1, (t - a) / (b - a)));
```

- [ ] **Step 2: Add entrance CSS** (append to `globals.css`)

```css
/* ── HARLEQUIN board entrance reveal ───────────────────────────────────── */
/* The banner wipes in from the FAR LEFT all the way to the RIGHT edge — a
   deliberate full-width sweep (driven by --hq-wipe: 0→1). A thin champagne
   leading edge rides the wipe front so the sweep reads clearly. */
.hq-banner-enter {
  clip-path: inset(0 calc((1 - var(--hq-wipe, 1)) * 100%) 0 0);
  position: relative;
}
.hq-banner-enter::after {
  content: "";
  position: absolute; top: 0; bottom: 0;
  left: calc(var(--hq-wipe, 1) * 100%);
  width: 2px; transform: translateX(-2px);
  background: linear-gradient(180deg, transparent, rgba(231,226,212,0.85), transparent);
  opacity: calc((1 - var(--hq-wipe, 1)) * var(--hq-wipe, 1) * 4); /* 0 at ends, bright mid-sweep */
  pointer-events: none;
}
/* Cere jumps into place: drop + scale with a slight overshoot. */
@keyframes hq-cere-jump {
  0%   { opacity: 0; transform: translateY(-22px) scale(0.3); }
  70%  { opacity: 1; transform: translateY(3px) scale(1.06); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
.hq-cere-jump { animation: hq-cere-jump 460ms cubic-bezier(0.22, 1, 0.36, 1) both; }
/* typing caret */
.hq-caret { display:inline-block; width:0.5ch; margin-left:1px; color:#27b06f; }
@media (prefers-reduced-motion: reduce) {
  .hq-banner-enter { clip-path: none; }
  .hq-banner-enter::after { display: none; }
  .hq-cere-jump { animation: none; }
}
```

- [ ] **Step 3: Drive the banner + Cere from the timeline in `page.tsx`**

Call the hook: `const { t } = useEntranceReveal(entrance);`. On the `<header>` (line ~220), when `entrance` add the class and set the CSS var:

```tsx
<header
  data-suppress-reveal
  data-has-contained-glow="true"
  className={`sticky top-0 z-40 border-b border-[#e7e2d4]/15 bg-[#0e0c12]/70 backdrop-blur-md ${entrance ? 'hq-banner-enter' : ''}`}
  style={entrance ? ({ ['--hq-wipe' as string]: easeWipe(sub(t, 0.14, 0.42)) } as React.CSSProperties) : undefined}
>
```

Add a local `const easeWipe = (x: number) => 1 - Math.pow(1 - x, 3);` (ease-out) and import `sub` + `useEntranceReveal`. The wipe spans `[0.14, 0.42]` of a 4.4s reveal ≈ **1.2s edge-to-edge** — slow and deliberate (Mike's tweak: full width, beginning to right).

For Cere, gate the jump class on the timeline crossing the cere phase. Wrap `CerePortal` (line ~275) so the class applies once `t` enters the cere window:

```tsx
<div className={entrance && t >= 0.34 ? 'hq-cere-jump' : undefined} style={entrance && t < 0.34 ? { opacity: 0 } : undefined}>
  <CerePortal ... />
</div>
```

- [ ] **Step 4: Verify types + lint**

Run: `npx tsc --noEmit && npx eslint src/components/dev/entrance/useEntranceReveal.ts src/app/dev/page.tsx`
Expected: 0 errors.

- [ ] **Step 5: Visual verify the wipe is FULL-WIDTH and Cere jumps**

Arm entrance + cookie, navigate `/dev`. Capture frames at the banner phase: drive nothing (it auto-plays) but sample fast — take 3–4 screenshots ~150ms apart right after load, OR temporarily expose the clock so you can scrub. Confirm: the banner is clipped to a partial width early (e.g. only the left portion visible) and sweeps to full width — **the right edge is the LAST thing revealed**. Confirm Cere drops/scales in after. Compare to the prototype `entry-reveal.html` (the bar wipe there is now slow/edge-to-edge).

- [ ] **Step 6: Commit**

```bash
git add src/components/dev/entrance/useEntranceReveal.ts src/styles/globals.css src/app/dev/page.tsx
git commit -m "feat(dev): entrance timeline + full-width banner wipe + Cere jump-in"
```

---

### Task 4: TypeIn component + wordmark + lane headers/counts

**Files:**
- Create: `src/components/dev/entrance/TypeIn.tsx`
- Modify: `src/components/dev/HarlequinTitle.tsx` (type the wordmark when entrance)
- Modify: `src/components/dev/IssueList.tsx` (lane header label types + count-up) — `LaneHeader` lines ~709–717

**Interfaces:**
- Produces: `<TypeIn text={string} active={boolean} durationMs={number} startDelayMs={number} caret={boolean} />` — renders `text` fully when `!active` or reduced motion; otherwise reveals it char-by-char. Self-contained leaf (only it re-renders).

- [ ] **Step 1: Create `TypeIn`**

```tsx
// src/components/dev/entrance/TypeIn.tsx
'use client';
import { useEffect, useRef, useState } from 'react';

export function TypeIn({
  text, active, durationMs = 600, startDelayMs = 0, caret = true,
}: { text: string; active: boolean; durationMs?: number; startDelayMs?: number; caret?: boolean; }) {
  const [n, setN] = useState(active ? 0 : text.length);
  const raf = useRef(0);
  useEffect(() => {
    if (!active) { setN(text.length); return; }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setN(text.length); return; }
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now + startDelayMs;
      const e = Math.max(0, now - start);
      setN(Math.min(text.length, Math.round((e / durationMs) * text.length)));
      if (e < durationMs) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [active, text, durationMs, startDelayMs]);
  const done = n >= text.length;
  return <>{text.slice(0, n)}{active && !done && caret ? <span className="hq-caret">▍</span> : null}</>;
}
```

- [ ] **Step 2: Type the wordmark** in `HarlequinTitle.tsx`

Add an optional `entrance?: boolean` prop; wrap the wordmark text. Keep the existing static render when not in entrance.

```tsx
export function HarlequinTitle({ onBack, onBackHover, entrance = false }:
  { onBack?: () => void; onBackHover?: () => void; entrance?: boolean }) {
  // ...
  <span className={`${marquee.className} text-3xl tracking-[0.18em] text-[#E7E2D4]`}>
    {entrance ? <TypeIn text="THE HARLEQUIN" active durationMs={520} startDelayMs={260} caret={false} /> : 'THE HARLEQUIN'}
  </span>
```

Pass `entrance` from `page.tsx`: `<HarlequinTitle entrance={entrance} ... />`.

- [ ] **Step 3: Type lane headers + count-up** in `IssueList.tsx`

`LaneHeader` currently renders `{label}` and `· {count}`. Thread an `entrance` prop (and the timeline `t`) from `page.tsx` → `IssueList` → `LaneHeader`. Replace the static label/count:

```tsx
function LaneHeader({ color, label, count, entrance, headT }:
  { color: string; label: string; count: number; entrance?: boolean; headT?: number }) {
  const reveal = entrance && (headT ?? 1) > 0;
  return (
    <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.15em] text-[#e7e2d4]/70">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color, opacity: reveal ? Math.min(1, (headT ?? 1) * 1.5) : 1 }} />
      {entrance ? <TypeIn text={label} active durationMs={360} caret={false} /> : label}
      <span className="text-[#e7e2d4]/40">· {entrance ? Math.round((headT ?? 1) * count) : count}</span>
    </div>
  );
}
```

`headT` is `sub(t, 0.40, 0.60)` computed in `page.tsx` and passed into `IssueList` as part of an `entrance` object.

- [ ] **Step 4: Verify types + lint**

Run: `npx tsc --noEmit && npx eslint src/components/dev/entrance/TypeIn.tsx src/components/dev/HarlequinTitle.tsx src/components/dev/IssueList.tsx src/app/dev/page.tsx`
Expected: 0 errors.

- [ ] **Step 5: Visual verify** the wordmark + lane labels type and counts tick up (frames mid-entrance; compare to prototype).

- [ ] **Step 6: Commit**

```bash
git add src/components/dev/entrance/TypeIn.tsx src/components/dev/HarlequinTitle.tsx src/components/dev/IssueList.tsx src/app/dev/page.tsx
git commit -m "feat(dev): TypeIn reveal for wordmark, lane labels, and count-up"
```

---

### Task 5: Card box→type reveal (the core)

**Files:**
- Modify: `src/components/dev/IssueList.tsx` — the card slot (`ref={slotRef}` line ~555), the inline card `motion.div` (line ~580), and the title `<p>` (line ~338)
- Modify: `src/app/dev/page.tsx` — pass the `entrance` object into `IssueList`

**Interfaces:**
- Consumes: `entrance?: { active: boolean; t: number }` on `IssueList`.
- Produces: per-card box-in (chrome) + title `TypeIn`, staggered in reading order (Awaiting Review → To Do → In Progress → Done, top-to-bottom), gated so it only starts once that card's issue is present (handles async load — "box→type").

- [ ] **Step 1: Assign each rendered card an entrance index** in reading order

In `IssueList.tsx`, where lanes/cards are built (status view ~844–872), compute a running index as cards are emitted so the stagger follows reading order. Pass `entranceIndex` into each `IssueCard`.

- [ ] **Step 2: Box-in the card chrome**

On the inline card `motion.div` (line ~580), when `entrance.active`, start it hidden + offset and animate in by index. Reuse Framer (already imported). Example: add `initial`/`animate` driven by a per-card delay `0.56 * DURATION + index * 90ms`:

```tsx
// when entrance.active:
initial={{ opacity: 0, x: 24, scale: 0.98 }}
animate={ entranceArrived ? { opacity: 1, x: 0, scale: 1 } : { opacity: 0, x: 24, scale: 0.98 } }
transition={ reduced ? { duration: 0.2 } : { type: 'spring', stiffness: 320, damping: 30, delay: index * 0.07 } }
```

`entranceArrived` = `entrance.active ? entrance.t >= cardStart(index) : true`, where `cardStart(index) = 0.56 + Math.min(index * 0.03, 0.4)`.

- [ ] **Step 3: Type the title once the box is in**

Wrap the title text (line ~338 `<p>`):

```tsx
{entrance?.active
  ? <TypeIn text={issue.title} active={entranceArrived} durationMs={Math.min(700, 200 + issue.title.length * 12)} startDelayMs={120} caret />
  : issue.title}
```

(The box-in starts at `cardStart`; the title typing has a small `startDelayMs` so the box visibly arrives first — the "box → type" order Mike chose.)

- [ ] **Step 4: Pass the entrance object from `page.tsx`**

```tsx
<IssueList ... entrance={entrance ? { active: true, t } : undefined} />
```

- [ ] **Step 5: Verify types + lint**

Run: `npx tsc --noEmit && npx eslint src/components/dev/IssueList.tsx src/app/dev/page.tsx`
Expected: 0 errors.

- [ ] **Step 6: Visual verify box→type** — frames at cards phase: empty boxes appear first, then titles type into them, staggered top-to-bottom. Compare to prototype `order = box → type`. Confirm the final board is pristine and identical to a normal mount.

- [ ] **Step 7: Commit**

```bash
git add src/components/dev/IssueList.tsx src/app/dev/page.tsx
git commit -m "feat(dev): card box→type entrance reveal, staggered in reading order"
```

---

### Task 6: Suppress the normal loader during entrance + reduced-motion + full pass

**Files:**
- Modify: `src/app/dev/page.tsx` (loader gating ~298–320; reduced-motion guard)

**Interfaces:**
- Consumes: `entrance`, the timeline `t`, the existing `loading`/`showLoader`.

- [ ] **Step 1: Suppress `CereGameLoader` during entrance**

The entrance IS the loading visual. When `entrance`, do not render `CereGameLoader`; the banner/headers animate while data loads, and cards reveal as issues arrive (Task 5 gates on presence). Guard the loader render (line ~312):

```tsx
{showLoader && !entrance && ( /* CereGameLoader ... */ )}
```

Also: when `entrance`, the board container should NOT use the `opacity-0→100` fade (the entrance replaces it) — render the board immediately so banner/headers can animate. Gate the `transition-opacity` wrapper (line ~299) so it's `opacity-100` immediately under entrance.

- [ ] **Step 2: Reduced-motion end-state**

Confirm every piece (HomeFadeOverlay, useEntranceReveal, TypeIn, Cere class, card box-in) short-circuits to the final state under `prefers-reduced-motion: reduce`. With reduced motion, `t` is 1 immediately, `TypeIn` shows full text, Cere class is inert, cards animate with the reduced tween — net effect: the board appears fully, no motion. Verify by toggling reduced motion in Playwright (`context.newPage` with `reducedMotion: 'reduce'`), arming entrance, and confirming the board renders complete with no partial/typing state.

- [ ] **Step 3: Full entrance pass — visual**

Arm entrance + cookie, navigate `/dev`, and capture a timeline of frames (sample every ~250ms for ~4.5s, or expose the clock to scrub). Verify the full sequence end-to-end: home crossfade → banner full-width wipe → Cere jump → headers/counts type → cards box→type → pristine board. Side-by-side against `entry-reveal.html`. Fix timing constants (`ENTRANCE_PHASES`, `ENTRANCE_DURATION_MS`, per-card stagger) until it matches.

- [ ] **Step 4: Regression — non-entrance mount unchanged**

Navigate `/dev` WITHOUT arming `hq-entrance`. Confirm the board loads exactly as before (CereGameLoader → fade-in), no entrance artifacts, `consumeEntrance()` returns false.

- [ ] **Step 5: Verify types + lint (whole feature)**

Run: `npx tsc --noEmit && npm run lint`
Expected: tsc 0; lint 0 errors (pre-existing warnings on `page.tsx` data-fetch effects are acceptable — do not introduce new errors).

- [ ] **Step 6: Commit**

```bash
git add src/app/dev/page.tsx
git commit -m "feat(dev): entrance replaces the loader; reduced-motion + non-entrance regression-safe"
```

---

### Task 7: KB update + design-doc note

**Files:**
- Modify: `src/data/iris/kb/projects.json` (the `proj_portfolio` entry `specifics[]`)
- Modify: `docs/superpowers/specs/2026-06-21-portal-transitions-design.md`

**Interfaces:** none.

- [ ] **Step 1: Update the portfolio KB entry**

Per the project rule (`feedback_keep_kb_updated`), add a specific to `proj_portfolio` noting the `/dev` entrance reveal (sequential board build: home→workpad fade, banner wipe, Cere jump, typed headers, box→type cards) and the diamond-disintegration de-rez exit, so Iris knows about the feature.

- [ ] **Step 2: Validate KB**

Run: `npm run verify:kb && npm run kb:rebuild`
Expected: passes.

- [ ] **Step 3: Note the shipped approach** in the design doc (entrance section: "implemented as a DOM reveal of the real board; box→type; full-width banner wipe").

- [ ] **Step 4: Commit**

```bash
git add src/data/iris/kb/projects.json docs/superpowers/specs/2026-06-21-portal-transitions-design.md
git commit -m "docs(dev): record /dev entrance reveal in KB + design doc"
```

---

## Self-Review

**Spec coverage:**
- Home→workpad fade → Task 2. ✓
- Banner full-width left→right wipe (Mike's tweak) → Task 3 (`hq-banner-enter`, `[0.14,0.42]` ≈ 1.2s edge-to-edge, leading-edge highlight). ✓
- Wordmark "increases in text" → Task 4 (TypeIn). ✓
- Cere jumps into place → Task 3. ✓
- Lane headers + counts type / count-up → Task 4. ✓
- Cards box→type (Mike's chosen order, async-robust) → Task 5. ✓
- Entrance trigger from unlock → Task 1. ✓
- Reduced motion + non-entrance regression → Task 6. ✓
- KB/docs rule → Task 7. ✓

**Placeholder scan:** All steps carry real code or concrete commands. Visual-tuning steps name the reference (the prototype) and the exact frames to compare — not "make it look good."

**Type consistency:** `markEntrance`/`consumeEntrance` (Task 1) used in Tasks 1; `getHomeSnapshot`/`captureHomeSnapshot`/`clearHomeSnapshot` (Task 2) used in Task 2; `useEntranceReveal`/`ENTRANCE_PHASES`/`sub` (Task 3) used in Tasks 3–6; `<TypeIn>` (Task 4) used in Tasks 4–5; the `entrance` object shape `{ active: boolean; t: number }` is consistent from `page.tsx` (Task 3) through `IssueList`/`LaneHeader` (Tasks 4–5). Consistent.

**Risk notes:**
- `TypeIn` re-renders per frame but is a leaf (only its own text node reconciles) — IssueCard's heavy Framer subtree does not re-render. Stagger limits concurrent typers. If jank appears on low-end devices, switch `TypeIn` to write `textContent` via a ref instead of `setState` (same interface).
- The home crossfade depends on a snapshot captured at passcode time; if it's slow/absent the overlay no-ops and the board still reveals (graceful).
- Testing the entrance needs a manually-armed `hq-entrance` flag (the passcode is unreachable in test) — documented above.
