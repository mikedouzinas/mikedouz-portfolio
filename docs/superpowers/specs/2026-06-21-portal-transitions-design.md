# THE HARLEQUIN portal transitions (#19) — design

**Date:** 2026-06-21
**Branch:** `feat/portal-transitions`
**Status:** EXIT wired + verified-in-prototype; ENTRY (Mark-42) prototype in progress.

Two effects for the hidden `/dev` board:

- **EXIT** — the board's own pixels disintegrate into harlequin **diamond ash**, revealing the live homepage beneath. Seamless: no delay, no dimmed board under the animation, no flip.
- **ENTRY** — a **Mark-42 Iron Man** assemble: the board's real UI pieces fly in from scattered positions and snap together to form the board.

This document records the design we settled on after the previous approach was rejected twice, and what was built.

---

## Why the previous attempts failed

The prior approach (root-layout WebGL host that client-navigates mid-animation) was **architecturally correct** — navigate under a cover, then reveal — but lost on execution. Mike's three "this is wrong" signals mapped to three separate, fixable causes:

| Symptom | Root cause | Fix |
|---|---|---|
| ~2s of nothing, then it starts | `html2canvas` ran **at click time** | **Eager snapshot** — capture the board *before* the click |
| dimmed board sitting *under* the animation | the cover wasn't the sole opaque layer at t=0 | cover = opaque board chips at progress 0, on the **first frame** |
| a "flip" to the homepage at the end | the dissolve revealed an intermediate, then swapped to live home | dissolve reveals the **live home directly** — nothing to swap |

**Key insight:** the bug was never the high-level approach. It was (1) the click-time capture delay and (2) compositing discipline. The architecture stays; the execution changes.

---

## EXIT architecture — "navigate under, disintegrate over"

One persistent overlay canvas lives in the **root layout** (`HarlequinTransitionHost`) so it survives the `/dev → /` route change. Timeline:

1. **Eager capture.** While on `/dev`, the board is html2canvas-snapshotted into an opaque canvas and cached (`boardSnapshot.ts`). Triggered when the board settles and again on **back-diamond hover** (freshest frame before a likely click). So at click, the cover is ready — **zero delay**.
2. **Click → instant cover.** `HarlequinExit` mounts, reads the cached snapshot, and on the **first frame** draws it as a grid of opaque chips (progress 0) that perfectly reconstruct the board. Fires `onSnapshotReady`.
3. **Navigate under.** The host `router.push('/')`. Invisible — the opaque cover covers the whole viewport while `/dev` unmounts and `/` mounts + paints behind it.
4. **Armed → disintegrate.** Host waits for `[data-home-root]` to paint (+1 frame), then sets `armed`. Chips ignite along a diagonal sweep, peel into harlequin **diamonds**, and fade to **transparent** — revealing the **live** homepage through the gaps. (No home texture; the real DOM is behind a transparent canvas.)
5. **Done.** Last chip gone → overlay unmounts. Nothing visually changes because home was already fully revealed. **No flip.**

### The diamond look (verified in prototype)
- Instanced quads (WebGL2), one per ~14px cell. At rest they tile the board opaquely (chips overlap ~8% so the cover has no seams).
- On ignition each chip snaps to a 45°, slightly-elongated rhombus (true harlequin diamond), tumbles, drifts up + outward with sway + slight gravity, and fades.
- Palette: green burn front `#27b06f` → navy `#143a6b` as the chip ages; blue `#5aa6e6` and red `#B3122B` flecks; a hot white-green leading edge reads as magic fire.
- **Mode A (see-through, default):** home revealed through the gaps as chips fall. **Mode B (curtain, fallback):** denser field briefly fills the screen, then clears — easier to tune. Both share identical plumbing; switching is a shader-constant change.

### Files
- `src/components/dev/transition/boardSnapshot.ts` — eager capture cache (new).
- `src/components/dev/HarlequinExit.tsx` — raw WebGL2 instanced-diamond disintegration (rewritten; no three.js).
- `src/components/dev/HarlequinTitle.tsx` — back button captures on hover/focus.
- `src/app/dev/page.tsx` — baseline eager capture once the board settles; passes `onBackHover`.
- `src/components/dev/transition/HarlequinTransitionHost.tsx` — **unchanged**; its navigate-under interface already fit.

### Prototype
`overnight/portal-lockups/exit/exit-disintegrate.html` — self-contained, uses the **real** board + homepage screenshots. Scrub `progress`, tune `duration`/`band`, toggle mode A/B. This is the thing to judge the look on. Rebuild with `node overnight/portal-lockups/exit/build-exit.mjs`.

---

## ENTRY direction — Mark-42 assemble

The board's real UI pieces (header/wordmark, columns, cards) fly in from scattered offscreen positions and snap together to form the board. Mechanical/metallic, precise easing with slight overshoot/settle, staggered arrival order, champagne glint as each piece locks. **Real board pieces, not abstract confetti.** Same persistent-host plumbing as the exit (build over the homepage, navigate to `/dev` under the cover, reveal). Prototype: `overnight/portal-lockups/entry/entry-assemble.html` (in progress).

### Shipped implementation

The entrance shipped as a **DOM reveal of the real board** — no WebGL, no texture-based effect. A one-shot unlock signal (produced when the passcode succeeds) arms a sequential reveal: the homepage crossfades into the workpad backdrop, then the banner wipes in full-width left-to-right, Cere jumps into place, lane headers and open-counts type in, and each ticket card animates box-first then title-types in (`box→type`), staggered in reading order as GitHub issues load. No cover canvas or persistent host is involved on the way in — the board renders normally and the reveal is driven entirely by CSS/JS animation phases triggered from the unlock event.

---

## Verification

- **Look:** judged on the standalone prototypes with real assets (Playwright frame-scrubbing during dev; ultimately Mike's eyes).
- **In-app:** confirm no console errors, the exit ends on `/` with home painted, and the cover appears immediately (no dead delay). Playwright cannot catch sub-2s animation perception — the standalone prototype is the visual source of truth, and the in-app version uses the identical shader.

## Durable gotchas (kept)
- `/dev` is middleware-gated: client `router.push('/dev')` without a session → hard 404. Test with a minted `dev_session` cookie (see `reference-dev-test-session`).
- html2canvas must `ignoreElements` canvases or it poisons live WebGL with a 2D context.
- `usePathname` flips ~0.5s before the new route paints — gate the reveal on the DOM marker, not the URL.
- three.js + html2canvas stay lazy-imported (off the homepage bundle).
