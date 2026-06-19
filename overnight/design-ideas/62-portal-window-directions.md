# Ticket #62 — Dev Portal + Password Interface: Design Directions

**Author:** design lead (overnight pass)
**Status:** directions only — not final design, not code
**Scope:** the *entrance* to THE HARLEQUIN (homepage trigger → password → cross into `/dev`). Read-only study of existing components; no `src/` edits.

---

## What exists today (the thing we're replacing)

- **Trigger:** an almost-invisible `·` dot (`text-white/10`) centered under the homepage footer. Hover (desktop), long-press / 5-taps (touch), or `⌘⇧K` opens it. Source: `src/components/dev/DevPortal.tsx`.
- **Current "portal":** a Framer-Motion modal — `bg-black/60 backdrop-blur-sm` scrim, a `rounded-2xl bg-slate-900/90` card that springs in (`scale 0.6 → 1`, `rotate -8 → 0`), one password `<input>`, and a single red error line. That's it. No window, no glimpse of the board, no attempts UI, no stop-motion. It reads as a generic glassmorphism login on a champagne board — **off-theme and feedback-blind.**
- **Autofill suppression already present and correct:** `autoComplete="off"`, `data-1p-ignore`, `data-lpignore`, `data-bwignore`, `data-form-type="other"`. Keep all of these in every direction; add a non-`password` masking approach (see "Autofill" note) so 1Password/iCloud don't offer to fill or save.

### The established visual vocabulary (must stay coherent with this)

These are the materials of THE HARLEQUIN's world — every direction below is built from them, not from generic login parts.

| Token | Value | Source |
|---|---|---|
| Board base (theatre floor) | `#0d0b11` | `.dev-workpad` |
| Champagne (primary ink/text) | `#E7E2D4` / `#EDE6D6` | title, tile stroke |
| Harlequin red (diamonds) | `#B3122B` | `HarlequinReveal` tile |
| Warm sanctum glow | `rgba(140,20,40,0.06)` top vignette | `.dev-workpad` |
| Google flicker accent | `#4285F4 #EA4335 #FBBC05 #34A853` | `GOOGLE_COLORS`, used **only as a brief flicker** |
| Display face | **Limelight** (1930s marquee) — wordmark only | `HarlequinTitle` |
| Argyle motif | 56px red diamond, champagne 1px stroke, **revealed only in a 130px radial bloom under the cursor** | `HarlequinReveal` |
| Grain | `feTurbulence baseFrequency .85`, `mix-blend overlay`, `opacity .3` | `.dev-workpad::after` |
| Stop-motion precedent | `steps(1, end)` diamond flicker; `cere-portal` spinning-ring + pulsing conic core | globals.css |

**Hard constraints (non-negotiable):** champagne duotone; Google rainbow = *flicker only, never dominant*; keep Limelight; keep the grid; **no Marcellus anywhere.**

### The signal we actually have for attempts/lockout (drives the error UI)

From `src/lib/dev/rateLimit.ts` + `auth/route.ts` — design to the *real* backend, not an invented one:

- Per-IP: **`MAX_ATTEMPTS = 5`** in a **15-min window**. On the 6th, server returns **429** with a **`Retry-After`** header (seconds).
- Global: 20 total failures → 15-min cooldown → also 429 + `Retry-After`.
- Wrong password = **401** (body `{error:'invalid credentials'}` — *no remaining-count in the body*).
- Success = `{ ok:true }` + cookie, then client navigates to `/dev`.

**Design implication:** the client must **count attempts locally** (start at 5, decrement on each 401) for the "attempts remaining" indicator, and read **`Retry-After`** from the 429 response to drive the lockout countdown. The local counter is a *display aid* (the server is the real gate); reset it on a fresh open. This is the same in all three directions — only the *visual treatment* of the count differs.

---

## North star: "the little window"

> mikeveson.com is a window into Mike's life. THE HARLEQUIN is the inner sanctum only Mike crosses into. The entrance should feel like **peering through a small window at the board beyond** — you can see it, lit and alive, but you can't reach it. Entering the password isn't "unlocking a form," it's **stepping through the window into the room.**

Every direction must deliver three beats:

1. **PEER** — a small framed aperture shows a *real glimpse of the board behind it* (blurred/dim argyle + grid + warm glow), unreachable.
2. **KNOCK** — typing the password; wrong = the window rejects you (it doesn't just turn a label red — the *glass reacts*).
3. **CROSS** — correct password = the frame opens/breaks/swings and the camera travels *through* it into `/dev`. Navigation (`window.location.href = '/dev'`) is hidden behind the transition so the page swap is invisible.

---

# Direction A — "THE PEEPHOLE" (the little window, literal)

### Core metaphor
A brass-and-ink **stage door peephole / proscenium window** cut into the dark. You're a visitor outside the theatre, leaning in to look through a small lit opening at the Harlequin's floor. The password is the knock; a correct knock swings the window open and the camera dollies through.

### What the "little window" looks/behaves like
- A **small aperture (~320×320, max ~38vw)** floating in the center of a near-black, grainy scrim. Not a card — a *hole punched through the dark* with a thick hand-inked frame (irregular, offset double-stroke in champagne, like a comic panel border drawn by hand, not a CSS border).
- **Through the glass:** a live, *parallaxed* miniature of the board — the 56px argyle tile + the 16/80px grid + the warm top vignette — rendered at low opacity and **blurred (`blur(3px)`)**, slowly drifting (so it reads as a room with depth, not wallpaper). On pointer move, the inner board layer shifts ~6px against the frame (parallax) → "I'm looking *into* a space."
- A faint **Limelight ghost** of `THE HARLEQUIN` floats deep in the blur, half-legible — the thing you're trying to reach.
- The password field is **etched into the lower frame sill** ("KNOCK ····"), not a boxed input. Caret is a champagne diamond `◆`.

### Entrance transition (CROSS)
On success: the **two halves of the window swing open** (left/right panels rotateY outward on `steps()` — 4 stutter frames, not smooth), the blur on the inner board snaps to 0 over those same frames, and the **camera scales *into* the aperture** (`scale 1 → 6`, the frame flying off-screen past the viewer) while an **ink-splash wipe** (SVG splat, champagne) covers the last 120ms — under which `/dev` has already loaded. You arrive standing *on* the board you were peering at. Total ~700ms.

### Error / attempts / lockout
- **Wrong (401):** the window **rattles in its frame** — a hard horizontal `steps(5)` shake (sprite-stutter, ~8px, no easing), the inner glass flashes a **red ink bloom** (`#B3122B` radial, 180ms), and a hairline crack SVG draws across one corner via `stroke-dashoffset` in `steps()`. Sill message in the interface's voice: *"Wrong knock."*
- **Attempts:** **five small champagne diamonds** along the frame sill (the proscenium's footlights). Each wrong knock **snuffs one out** — it flickers Google-red once (the flicker accent, earned) then goes dark `#3a3530`. "◆◆◆◆◆ → ◆◆◆◆◇". No number needed; the row *is* the count.
- **Lockout (429):** all diamonds dark; the window **fogs over** (champagne frost gradient creeps in from the frame), the sill reads *"Locked. Knock again in 14:32"* with a live `Retry-After` countdown. Frame stops reacting to pointer (peer-only). Cracks remain. Auto-clears at zero.

### Stop-motion / halftone techniques
- **Shake:** `animation: peephole-rattle 0.4s steps(5, jump-none)` — discrete jumps, the signature stutter.
- **Door swing & camera-in:** keyframed with `steps(4)` per panel so the open *clacks* open frame-by-frame.
- **Halftone:** the inner board gets a **CSS radial-gradient dot mask** (halftone screen) layered over the existing grain; denser dots toward the frame edges (vignette as ink density).
- **Crack:** inline SVG path, `stroke-dasharray` + `steps(3)` reveal.
- **Grain:** reuse `.dev-workpad::after` feTurbulence, bumped to `opacity .4` inside the frame so the glimpse looks *filmed*.
- **Parallax:** 2 layers (frame fixed, board translateXY on pointer), `transition: transform 80ms steps(2)` — even the parallax stutters, staying in-aesthetic.

### Motion timing
PEER idle: board drift 12s linear loop. Open intro: window irises in over 320ms `steps(6)`. Shake: 400ms. Cross: 700ms. Reduced-motion: no shake/drift/camera; window cross-fades, error = static red frame + message.

### Wireframes
```
PEER (idle)                          KNOCK (typing)
┌───────────────────────────┐        ┌───────────────────────────┐
│        (dark + grain)      │        │        (dark + grain)      │
│   ╔═══════════════════╗    │        │   ╔═══════════════════╗    │
│   ║░░ argyle · grid ░░║    │        │   ║░░ argyle · grid ░░║    │
│   ║░░ ~THE HARLEQUIN~ ░║   │        │   ║░ (board sharpens) ░║   │
│   ║░░░ (blurred) ░░░░░║    │        │   ║░░░░░░░░░░░░░░░░░░░║    │
│   ╠═══════════════════╣    │        │   ╠═══════════════════╣    │
│   ║ KNOCK  · · · · ·  ║    │        │   ║ KNOCK  ◆◆◆◆◇      ║    │
│   ║ ◆ ◆ ◆ ◆ ◆         ║    │        │   ║ ◆ ◆ ◆ ◆ ◆         ║    │
│   ╚═══════════════════╝    │        │   ╚═══════════════════╝    │
└───────────────────────────┘        └───────────────────────────┘

ERROR (wrong knock — rattling)        LOCKOUT (429 — fogged)
┌───────────────────────────┐        ┌───────────────────────────┐
│   ╔═══════════════════╗◄►  │        │   ╔═══════════════════╗    │
│   ║░░░╲ red ink bloom ░║    │        │   ║▓▓▓ frost / fog ▓▓▓║    │
│   ║░░░░╲ (crack) ░░░░░║    │        │   ║▓▓ (board hidden) ▓║    │
│   ╠═══════════════════╣    │        │   ╠═══════════════════╣    │
│   ║ Wrong knock.       ║    │        │   ║ Locked. 14:32      ║   │
│   ║ ◆ ◆ ◆ ◆ ◇  (1 out) ║    │        │   ║ ◇ ◇ ◇ ◇ ◇          ║   │
│   ╚═══════════════════╝    │        │   ╚═══════════════════╝    │
└───────────────────────────┘        └───────────────────────────┘
```

### Theme honoring
Duotone champagne-on-dark throughout; argyle + grid + grain are the *content* of the glimpse (reuses existing tokens verbatim); Limelight ghost in the blur is the only display type; Google color appears **only** as the single-flicker snuff of each footlight diamond and nothing else. No Marcellus. The window literally *is* the brief.

---

# Direction B — "THE FLIP-BOOK DOOR" (Spider-Verse comic panel)

### Core metaphor
The entrance is a **single comic panel** in a larger, mostly-empty gutter. Inside the panel: a hand-drawn door to the Harlequin, the board faintly visible through a cracked-open seam. Authentication is **redrawn frame-by-frame** like a flip-book — every state is a different "cell" of the same comic, and transitions are *page turns / panel slides*, not fades. Heaviest stop-motion commitment.

### What the "little window" looks/behaves like
- The aperture is the **door's vertical seam** — a thin lit slit (the board glows through the gap between two ink-drawn door slabs). You're peering through the *crack of a door left ajar*, the most literal "visible but unreachable."
- Through the seam: a bright champagne strip of board (argyle + grid), with the Limelight wordmark sliced by the seam so you only ever see a *fragment* of "HARLEQUIN."
- Everything is rendered with **bold ink outlines + halftone fills** (Ben-Day dots). The panel border is a thick uneven black stroke with a champagne drop-offset (classic comic double-border).
- Password entry: a **speech-balloon input** ("◆ enter the word…") that points at the door. Typed chars appear as comic block-letters.

### Entrance transition (CROSS)
On success the **door slabs slam apart** in 5 discrete flip-book cells (each a held SVG frame swapped via `steps(5)`): slit → ajar → half → wide → white-out. The board light floods the panel; an **"action" ink-splash** (jagged champagne starburst, the comic SFX shape) fills the screen; the panel border zooms past the camera. `/dev` is revealed underneath. ~640ms. The whole thing should look like flipping 5 drawn pages, not a CSS animate.

### Error / attempts / lockout
- **Wrong (401):** a **red "SFX" balloon** punches in over the door — a jagged comic burst reading e.g. *"NOPE!"* / *"DENIED!"* in champagne-on-red, drawn with `steps()` so it *pops* (scale in 3 frames, hold, pop out). The door **judders shut** by one cell. Inline sill text stays calm/utilitarian beneath the splash: *"That's not the word."*
- **Attempts:** a **filmstrip of 5 panel-tabs** down the side (like comic page corners). Each failure **tears one off** (a torn-paper SVG edge, `steps()` rip) — the remaining tabs *are* the count. Optional tiny "3 of 5" caption for a11y/screen-readers.
- **Lockout (429):** the panel is overdrawn with a giant inked **"X" / "CLOSED" stamp** (rotated, halftone, distressed), the seam goes dark, balloon reads *"Door's barred. Try again in 14:32."* Countdown from `Retry-After`. Stamp lifts (steps out) when the timer hits zero.

### Stop-motion / halftone techniques
- **Sprite frames:** pre-author the door as 5 SVG cells; swap with a `background-position` sprite or conditional render driven by an index, advanced via `steps()` — the *defining* technique here.
- **Halftone:** SVG `<pattern>` of dots, or a tiled radial-gradient dot screen, as the fill for shadows on the door/balloons (true Ben-Day, denser than Direction A).
- **Wobble/boil:** `feTurbulence` + `feDisplacementMap` on the panel outline, with the turbulence `seed` swapped between 2–3 values on an interval → the line "boils" (the Spider-Verse hand-drawn shimmer). This is the marquee texture move.
- **SFX bursts:** inline SVG starburst paths, animated in/out with `steps(3)`.
- **Grain:** existing feTurbulence overlay, kept.

### Motion timing
Line-boil: 2-frame swap @ ~90ms (≈11fps, the hand-animated cadence). Door cells: 5 × ~110ms. SFX pop: 90ms in / hold / 90ms out. Reduced-motion: freeze the boil to one static seed, no door cells (cross-fade), SFX shown as a static stamp, all countdowns intact.

### Wireframes
```
PEER (door ajar)                     KNOCK (typing into balloon)
┌───────────────────────────┐        ┌───────────────────────────┐
│ ┃                       ┃ │        │ ┃                       ┃ │
│ ┃   ▛▀▀▀▀┃▀▀▀▀▜  ◖tab1  ┃ │        │ ┃   ▛▀▀▀▀┃▀▀▀▀▜  ◖tab1  ┃ │
│ ┃   ▌ door┃ ░██░ ◖tab2  ┃ │        │ ┃   ▌ door┃ ░██░ ◖tab2  ┃ │
│ ┃   ▌ slab┃ HARL ◖tab3  ┃ │        │ ┃   ▌    ┃ ░██░ ◖tab4  ┃ │
│ ┃   ▙▄▄▄▄┃▄▄▄▄▟  ◖tab5  ┃ │        │ ┃  (╭─ enter the word…)  ┃ │
│ ┃        ↑seam=board     ┃ │        │ ┃   ◆ █ █ █              ┃ │
└───────────────────────────┘        └───────────────────────────┘

ERROR (SFX punch)                     LOCKOUT (CLOSED stamp)
┌───────────────────────────┐        ┌───────────────────────────┐
│ ┃     ╱╲ N O P E ! ╱╲    ┃ │        │ ┃     ╲╲ C L O S E D //  ┃ │
│ ┃    ╱  (red burst)  ╲   ┃ │        │ ┃   ▛▀▀▀╲▀▀▀▀▜  (barred) ┃ │
│ ┃   ▌ door juddered  ▐   ┃ │        │ ┃   ▌  ╲╲ X ╱╱        ▐   ┃ │
│ ┃   That's not the word. ┃ │        │ ┃   Door's barred. 14:32 ┃ │
│ ┃   ◖◖◖◖  (1 tab torn)   ┃ │        │ ┃   ◖ (all tabs torn)    ┃ │
└───────────────────────────┘        └───────────────────────────┘
```

### Theme honoring
Champagne + ink + harlequin-red is the whole comic; Google rainbow is restricted to a **single flicker on the SFX burst's outline** the instant it pops (one cycle, like the wordmark diamond) — nowhere else. Limelight used for the sliced wordmark fragment and the SFX block-letters (its marquee weight suits comic lettering). Grid lives in the board strip through the seam. No Marcellus.

### Risk note
Highest craft cost (authoring 5 door cells + boil + halftone). Biggest payoff and most on-brief for "comic-y / stop-motion," but the line-boil must be tuned or it reads as jitter, not animation.

---

# Direction C — "THE MAGIC-LANTERN SLIDE" (theatre projection, restrained)

### Core metaphor
THE HARLEQUIN is a stage; the entrance is the **projectionist's lantern / a single lit slide** thrown onto the dark theatre wall before the show. You watch the board *projected small and flickering* on the far wall (the window), and the password **brings up the houselights and dollies you onto the stage.** Quietest, most "elegant theatre" reading — leans Limelight/marquee harder, uses stop-motion sparingly and precisely (Chanel's "remove one accessory").

### What the "little window" looks/behaves like
- A **projected rectangle of light** on a dark wall — soft-edged, slightly keystoned (trapezoid, like a real projection), gently **flickering** in brightness (lantern flicker via `steps()` opacity). Inside it: the board, argyle + grid, *small and far*, with the **Limelight `THE HARLEQUIN` marquee** as the visible centerpiece (this is the most type-forward direction — the wordmark *is* the glimpse).
- A faint **dust-in-the-beam** layer (slow champagne motes) sells the projection volume.
- Password lives on a small **marquee "NOW SHOWING" plate** below the projection ("ADMIT ONE · ····"). The aesthetic is 1930s cinema lobby, which is exactly where Limelight comes from.

### Entrance transition (CROSS)
On success the **projection flares to full brightness** (1 hard flicker-up), the keystone **un-skews to fill the viewport** as the camera dollies forward, and the houselights fade the surrounding dark to the live `#0d0b11` board. A brief **shutter wipe** (two champagne bars closing then opening, `steps(2)`) hides the `/dev` swap — like a film cut between reels. ~620ms, smoother than A/B but punctuated by the shutter's hard cut.

### Error / attempts / lockout
- **Wrong (401):** the **lamp stutters** — projection brightness drops and flickers in `steps(4)` (a bulb struggling), a **red gel** washes the slide for 200ms, and the marquee plate flips one letter-cell to read *"NO ADMITTANCE"* (split-flap style). Reserved, theatrical — no shake.
- **Attempts:** **five marquee bulbs** above the plate (the classic theatre-sign border lights). Each failure **burns one out** (it flickers Google-amber once, then goes to dark filament). "Five tries, then the lamp's out."
- **Lockout (429):** the projection **goes dark to a single dim ember**; the plate reads *"House closed. Doors at 14:32"* (countdown from `Retry-After`). A thin "intermission" hairline rule under it. Re-illuminates at zero.

### Stop-motion / halftone techniques
- **Lantern flicker:** `steps()` opacity/brightness keyframes on the projection layer (continuous subtle flicker = the only ambient motion). Directly extends the existing `harlequin-diamond-flicker` `steps(1,end)` precedent.
- **Split-flap / burned bulbs:** small `steps()` flip animations; bulb = radial-gradient that swaps to a dark filament keyframe.
- **Shutter:** two absolutely-positioned bars, `transform: scaleY` driven by `steps(2)`.
- **Halftone:** light — a faint dot screen *only* on the projected slide to suggest a printed lantern plate; restraint is the point.
- **Keystone:** CSS `transform: perspective() rotateX/Y` for the trapezoid; un-skews on success.
- **Dust motes:** a few absolutely-positioned champagne dots drifting on long linear loops (can be `transition`-based, low cost).

### Motion timing
Ambient flicker: irregular `steps()` loop ~6s (subtle). Error stutter: 350ms. Cross: 620ms incl. 140ms shutter. Reduced-motion: kill flicker/dust/dolly; projection is static, error = static red gel + "NO ADMITTANCE", shutter becomes a fast cross-fade.

### Wireframes
```
PEER (projected slide)                KNOCK (typing on the plate)
┌───────────────────────────┐        ┌───────────────────────────┐
│      · dust in beam ·      │        │      · dust in beam ·      │
│     ╱▔▔▔▔▔▔▔▔▔▔▔▔╲       │        │     ╱▔▔▔▔▔▔▔▔▔▔▔▔╲       │
│    ╱  ░ THE        ░ ╲     │        │    ╱  ░ THE        ░ ╲     │
│   ╱   ░ HARLEQUIN  ░  ╲    │        │   ╱   ░ HARLEQUIN  ░  ╲    │
│   ╲   ░ (grid·argyle)░ ╱   │        │   ╲   ░░░░░░░░░░░░░░ ╱   │
│    ╲▁▁▁▁▁▁▁▁▁▁▁▁▁▁╱     │        │    ╲▁▁▁▁▁▁▁▁▁▁▁▁▁▁╱     │
│   ○ ○ ○ ○ ○  (5 bulbs)    │        │   ○ ○ ○ ○ ○               │
│  [ ADMIT ONE · · · · · ]  │        │  [ ADMIT ONE · ◆ ◆ ◆     ]│
└───────────────────────────┘        └───────────────────────────┘

ERROR (lamp stutter + red gel)        LOCKOUT (house closed)
┌───────────────────────────┐        ┌───────────────────────────┐
│     ╱▔▔▔ (red wash) ▔╲    │        │          · · ·             │
│    ╱  ░ stuttering   ░ ╲   │        │        (single ember)      │
│   ╱   ░ N O ADMIT.  ░  ╲   │        │     · dim / dark slide ·   │
│    ╲▁▁▁▁▁▁▁▁▁▁▁▁▁▁╱     │        │   ● ● ● ● ●  (all out)     │
│   ○ ○ ○ ○ ◌  (1 burnt)    │        │  ─────────────────────    │
│  [ NO ADMITTANCE ]        │        │  [ House closed. 14:32 ]  │
└───────────────────────────┘        └───────────────────────────┘
```

### Theme honoring
Most Limelight-forward (the wordmark is the hero of the glimpse — perfect for the 1930s-marquee face); pure champagne duotone with the dark theatre; Google color confined to the **single amber flicker of a burning-out bulb** and nowhere else; grid + argyle present in the slide; grain reused. No Marcellus. Lowest motion budget — wins on elegance/restraint, risks being *less* "comic-y / stop-motion" than the ticket explicitly asks for.

---

## Cross-cutting requirements (apply to whichever direction ships)

- **Autofill suppression:** keep all existing `data-*ignore` attrs. Additionally, prefer a **non-`type=password` masked input** (e.g. a text input that renders dots via a custom mask, or `inputMode` + obscuring) so password managers don't recognize a login at all — they key off `type=password`. Never pre-fill on open (today's `setPassword('')` on open is correct — keep it).
- **Local attempts counter:** initialize to 5 on each open; decrement on 401; the indicator (footlights / torn tabs / bulbs) reflects it. Treat as advisory — the server 429 is the real gate.
- **Lockout countdown:** read `Retry-After` (seconds) from the 429 response; render a live `mm:ss` countdown; re-enable input at zero. Handle the case where the header is absent (fall back to a generic "Try again later").
- **Copy voice:** errors are direct and in the interface's voice, never apologetic, never vague — "Wrong knock." / "That's not the word." / "House closed." plus the concrete countdown. (Per frontend-design writing guidance.)
- **Accessibility / quality floor:** every state respects `prefers-reduced-motion` (specified per direction); error state announced via `aria-live="polite"`; visible keyboard focus on the input; the diamonds/tabs/bulbs carry an SR-only text count ("2 of 5 tries left"); `Esc` and scrim-click still close (preserve current behavior); responsive down to mobile (the modal already opens centered on touch).
- **Trigger entry:** keep the existing `·` dot + `⌘⇧K` + long-press/5-tap triggers exactly. The redesign is everything *after* the portal opens.

---

## Tradeoffs

| Axis | A — Peephole | B — Flip-Book Door | C — Magic-Lantern |
|---|---|---|---|
| "Little window" fidelity | **High** (literal aperture into the board) | **Highest** (peering through a door crack) | Medium (projected *image* of the board, one remove) |
| "Comic-y / stop-motion" (ticket's explicit ask) | High | **Highest** | Medium (theatrical, less comic) |
| Spider-Verse texture | Strong (halftone + crack + rattle) | **Strongest** (line-boil, Ben-Day, sprite cells) | Light (flicker + faint dots) |
| Theme fit (champagne/grid/argyle/Limelight) | Strong | Strong | **Strongest** (Limelight hero) |
| Restraint / "remove one accessory" | Medium | Low (maximalist) | **High** |
| Error/attempts clarity | **High** (footlights snuff) | High (tabs tear) | High (bulbs burn out) |
| Implementation cost | **Medium** | High (author 5 cells + boil + halftone) | Low–Medium |
| Reduced-motion fallback quality | Good | Fair (loses the most) | **Best** (already mostly static) |
| Risk of reading as "AI-default login" | Low | **Lowest** | Low |
| "Crossing through" payoff | **Strong** (camera flies through aperture) | Strong (door slam + splash) | Strong (dolly + shutter cut) |

---

## Recommendation

**Ship Direction A — "THE PEEPHOLE."** It is the most faithful literal embodiment of the north-star "little window" (an actual lit aperture you peer through at the real board, then the camera flies *through* it), it delivers the ticket's required comic-y/stop-motion energy (steps() rattle, red ink bloom, hairline crack, halftone screen) **without** the high authoring cost and reduced-motion fragility of B, and its footlight-diamond attempts row is the cleanest mapping of the real 5-attempt / lockout backend onto the theme. It honors every constraint cleanly (duotone, grid + argyle as the glimpse content, Limelight ghost, Google color earned only as the single-flicker snuff).

**Borrow from B and C:** pull B's **`feDisplacementMap` line-boil** onto Direction A's hand-inked frame (cheap way to buy the Spider-Verse shimmer on just the border), and adopt C's **`Retry-After` countdown + houselights/shutter idea** for the lockout-clear and the final cut into `/dev`.

**For the separate lockup-builder agent to prototype: Direction A — "THE PEEPHOLE."** Specifically prototype the lockup of the three resting states (PEER / KNOCK / ERROR) plus the footlight attempts row, since those carry the brand and the feedback the ticket is fundamentally about; the CROSS camera-through transition and the 429 fog/countdown can follow once the lockup reads right.
