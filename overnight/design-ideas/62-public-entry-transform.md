# Ticket #62 (addendum) — The Public Entry Transform: dot → portal-window → vault

**Author:** frontend engineer-designer (overnight pass)
**Status:** directions only — not final design, not code. Read-only study of `src/`; no edits, no git.
**Scope:** the **first two beats** the prior doc deferred — the *public, hidden resting affordance* and the *morph-to-window transition* that precedes the password vault. The vault itself (PEER / KNOCK / ERROR / LOCKOUT / CROSS) is already designed in `62-portal-window-directions.md` (recommended **Direction A — "THE PEEPHOLE"**) and prototyped in `overnight/portal-lockups/`. **This addendum does not re-design the vault. It designs how you *get into* it** so the whole sequence is one continuous portal opening, never a hard cut to a `bg-black/60` overlay.

> **The problem we're fixing.** Today `DevPortal.tsx` is a near-invisible `·` (`text-white/10`) at `page.tsx:219`. On hover / `⌘⇧K` / long-press / 5-tap it **instantly** slams up a full-screen `bg-black/60 backdrop-blur-sm` scrim with a spring-scaling card. There is no transformation, no "peering in" — the dot and the form are unrelated objects. The brief: the **dot should *become* the window** (shared-element morph), the window should let you *glimpse the board beyond* before you commit, and only then should it open into the vault. The dot is the seed; the window is the sprout; the vault is the door.

---

## Constraints carried forward (non-negotiable)

Champagne duotone (`#0d0b11` ink / `#E7E2D4`–`#EDE6D6` champagne / `#B3122B` harlequin red); Google rainbow (`#4285F4 #EA4335 #FBBC05 #34A853`) **as a brief flicker accent only**; keep **Limelight** (Google Fonts CDN) for the wordmark; keep the grid background (the `.dev-workpad` layered champagne lines + warm top vignette + `feTurbulence` grain); **no Marcellus anywhere.** Continuity with the lockups in `overnight/portal-lockups/` (champagne argyle tile, 56px diamond, `steps()` stop-motion vocabulary).

---

## The resting affordance: design goal

> Discoverable if you look, invisible if you don't.

Today's dot is invisible if you don't look **and** invisible if you do — it gives nothing back. We want the opposite of a button (no chrome, no label, no obvious target) but *some* reward for attention: a viewer who lingers near the footer should feel "there's something here" a beat before they understand what. The affordance must remain a single small mark in the footer's center, sit on top of the dark page, and not pull focus from the real footer content. It must keep all four real entrypoints (`DevPortal.tsx`): desktop **hover**, **⌘⇧K**, mobile **long-press ~600ms**, mobile **5 quick taps**.

---

# Take 1 — "THE SEAM" (recommended)

### Resting affordance
The `·` is replaced by a **single hairline champagne vertical seam**, ~1px × 14px, at `rgba(231,226,212,0.10)` — a barely-there *slit of light in the dark*, as if a door behind the page is shut but not flush. It reads as a typographic tick (like a thin `|` or a cursor) to anyone not looking, but its faint **warm bleed** (a 6px `box-shadow` in `rgba(179,18,43,0.0)` at rest) means it can *warm up* on approach. This is the literal seed of Direction A/B's "board glows through the gap" — the resting state is *already* a 1px peek at the room.

### Approach / hover-morph (the core move)
On `mouseenter` (or focus, or the keyboard/touch triggers), the seam **does not vanish into an overlay**. It performs a **shared-element morph in place**:

1. **WARM (0–120ms):** the seam brightens `0.10 → 0.55`, the red bleed fades up (`box-shadow` to `rgba(179,18,43,0.35)`), and it grows from 14px to ~28px tall. Three or four champagne footlight diamonds *haven't appeared yet* — just the warming slit. Easing: `steps(3)` on the height so it ratchets open, not glides (stop-motion vocabulary).
2. **SPLIT (120–320ms):** the seam **splits into two leaves** that part horizontally (`steps(4)`, ~110ms total of the window), revealing a growing lit rectangle between them — the aperture. Behind the gap, the **argyle + grid board** fades in already-blurred (`blur(4px)`), drifting. This is a `layoutId`/shared-element transform: the same DOM node that *was* the seam is now the **left frame edge** of the window; a sibling becomes the right edge. The footer/page behind dims via a *local* radial scrim that grows out of the seam's position (transform-origin = the seam's center), **not** a full-viewport `inset-0` cut.
3. **FRAME (320–520ms):** the aperture reaches its resting "little window" size (~min(86vw, 360px) square, but anchored *above* the footer so it grows upward from the dot, not centered on screen on first bloom — see "anchoring"). The hand-inked champagne double-stroke frame draws on via `stroke-dashoffset` in `steps(3)`. The Limelight `THE HARLEQUIN` ghost surfaces deep in the blur. We are now in Direction A's **PEER** state — handed off seamlessly. The morph *is* the establishing shot of the vault.

**Transform origin matters:** every step scales/grows from the seam's on-screen center. The user's eye never teleports. `layoutId="harlequin-portal"` (Framer Motion) shared between the resting seam node and the window frame node makes this automatic on the React side; in the lockup it's a single element whose `width/height/border/contents` animate from seam → window via class swap + `transition` with per-property `steps()`.

### Commit / click → vault
Click (or the input gaining a character) on the PEER window **does not** open a second modal. The window is *already* the vault frame — clicking just **focuses the etched sill input** ("KNOCK ····") and the board behind sharpens slightly (`blur 4px → 3px`). From here the existing Direction A vault behavior runs unchanged (footlights, wrong-knock rattle + red ink bloom, 429 fog, CROSS camera-through). There is no boundary between "entry" and "vault" — that is the whole point.

### Correct → through the window
Unchanged from Direction A's **CROSS**: leaves swing open on `steps(4)`, blur snaps to 0, camera scales *into* the aperture (`scale 1 → 6`), ink-splash wipe hides the `/dev` navigation. Because we entered *through* the morph, exiting *through* the same frame closes the loop: dot → window → through-the-window → board.

### ASCII state sketch
```
RESTING            WARM (0-120)       SPLIT (120-320)         FRAME / PEER (520)
                                                              ┌──────────────────┐
                                                              │   (local scrim)   │
                      .                  ╷  ╷                 │  ╔══════════════╗ │
   (dark footer)      |        →        ╷│  │╷       →        │  ║░ argyle·grid ░║│
        |             |                 ╷│░░│╷                │  ║░ ~HARLEQUIN~ ░║│
   1px champagne   brighter+red      leaves part,            │  ║░░ (blur 4px) ░║│
   seam @ .10      bleed, taller     board glows through      │  ╠══════════════╣ │
                                     the gap (blurred)        │  ║ KNOCK ····    ║│
                                                              │  ╚══════════════╝ │
                                                              └──────────────────┘
        the SAME node grows from seam → left frame edge (shared-element / layoutId)
```

### Why this wins
- **Most literal "seam of light → window."** The resting state is *already* a 1px peek at the board, so the morph is a continuous reveal of one object, not a swap between two. It is the cleanest reading of "the trigger transforms into a portal."
- **Cheapest faithful morph.** One element's box animates; no second modal mounts. Reduced-motion degrades to a static lit slit that cross-fades to the window.
- **Continuous with Direction A.** The FRAME state *is* PEER. Nothing is thrown away; this addendum slots in front of the recommended vault.

### Motion specifics (lockup + real)
- Seam height/brightness: `steps(3)` warm.
- Leaf split: `transform: translateX` per leaf, `transition: 180ms steps(4)`.
- Local scrim: `radial-gradient` mask whose radius animates `0 → 140vmax`, `transform-origin` = seam center; **not** `position:fixed inset-0` snapping to full opacity. (Framer: animate a `clip-path: circle()` from the dot's rect.)
- Frame ink: inline SVG path, `stroke-dasharray`/`stroke-dashoffset`, `steps(3)`.
- Board behind: `blur(4px)`, slow 12s linear drift loop; parallax `translate` on pointer with `transition: 80ms steps(2)`.
- Google flicker: **none here** — reserve it for the vault's footlight-snuff (earned), keeping the entry duotone.

---

# Take 2 — "THE PINHOLE IRIS"

### Resting affordance
Keep a **dot**, but make it a *tiny dim aperture* rather than a glyph: a 4px champagne ring (`border: 1px rgba(231,226,212,0.12)`) with a near-black center — a pinhole, not a period. Subtler than a seam at rest, but the round shape pre-announces "iris."

### Approach / hover-morph
The pinhole **irises open**: the ring's radius animates outward in **discrete `steps(6)`** (like a camera diaphragm clacking open), and the dark center becomes the lit board glimpse. A faint **conic-gradient blade ring** (reusing the `.cere-portal` core's conic champagne, *not* the Google one) rotates one quarter-turn during the open as the blades retract. By full open it's a **circular window** (~min(80vw, 320px)), board blurred behind it, Limelight ghost centered. This maps onto **lockup Variant B (the Comic-Panel Iris)** — its CORRECT animates the aperture wide; here we use the same iris geometry for the *entry*, then settle into a PEER-style circular peephole.

### Commit / correct
Click focuses the sill input (a speech-bubble in Variant B's idiom, or a plain etched sill if we keep it quiet). CORRECT continues the iris all the way open (`width → 220%`) as an **iris-out wipe** that swallows the page into `/dev` — the entry-iris and the exit-iris are the same mechanism, bookending the sequence symmetrically.

### ASCII
```
RESTING        IRIS OPENING (steps 6)        WINDOW / PEER
                                              ╭──────────────╮
                  ·  → ◌ → ○ → ◯ →          │░ argyle·grid ░│
   ◦ pinhole      blades clack back          │░ ~HARLEQUIN~ ░│
   (4px ring)     center fills with          │░  (blur 4px) ░│
                  the lit board              │  KNOCK ····   │
                                              ╰──────────────╯
```

### Why it's a strong alternative
- Round aperture is the most unambiguous "I am looking *through* something."
- The open/close iris is one reusable mechanism → entry and CROSS share code.
- Risk: a circular peephole is slightly more "camera/comic" and slightly less "stage door / theatre" than the brief's marquee theme; it leans on Variant B more than the recommended Direction A. Choose this if we pivot toward the comic-iris lockup.

---

# Take 3 — "THE STRUCK MATCH" (atmospheric)

### Resting affordance
A single **champagne diamond ◆ at ~3px**, `rgba(231,226,212,0.08)`, rotated 45° — the board's core motif, shrunk to a speck. The harlequin diamond *is* the brand; the resting state is one unlit diamond among the dark.

### Approach / hover-morph
The diamond **strikes alight and grows into the window frame.** On approach: one **Google-rainbow flicker** runs across the diamond (`steps()`, the *earned* flicker, reusing `harlequin-diamond-flicker` verbatim) — the only Google color in the whole entry — then it settles to champagne and **expands on the 45° axis** into a diamond-shaped aperture (a *diamond door*, mapping onto **lockup Variant C — The Diamond Door**). As it grows, a brass fisheye peephole at its center resolves the blurred board behind it; the diamond's points reach toward the corners and the frame squares up into the PEER window (or stays a diamond, if we commit to Variant C's geometry).

### ASCII
```
RESTING       FLICKER + GROW (45° axis)      DIAMOND WINDOW / PEER
                                                    ◆
   ◦ ◆ 3px  →  ◆ (rainbow flicker once) →        ◆   ◆
   unlit       champagne, expanding             ◆ (fisheye:  ◆
   diamond     on the diamond axis                argyle·grid)
                                                    ◆  KNOCK ····
```

### Why it's the bold/atmospheric option
- Most **on-brand object** (the diamond is THE HARLEQUIN's core motif) and the only take that spends the Google flicker *in the entry* — a single, justified rainbow strike as the secret "lights up."
- Most distinctive shape, hardest motion (45° growth + counter-rotating fisheye + `steps()` swing — see Variant C). Highest craft cost, biggest "wow."
- Risk: a 3px diamond is harder to discover than a seam (less obvious it's interactive); the diagonal growth can read as decorative rather than door-like if the step count is wrong. Choose this if we want the entry itself to be a showpiece and accept the authoring cost.

---

## Mapping onto the real `DevPortal.tsx` entrypoints

All four current triggers are preserved — they differ only in **what kicks off the morph**, not in the morph itself:

| Trigger (today) | Today's behavior | With the transform |
|---|---|---|
| Desktop **hover** (`onMouseEnter`) | instant overlay | starts **WARM → SPLIT → FRAME** morph in place; `onMouseLeave` on the window reverses the morph back to the seam (graceful, not a hard close) |
| **⌘⇧K** (`metaKey/ctrlKey + shift + KeyK`) | instant overlay | runs the **same morph**, but since there's no pointer anchor, it morphs from the seam's footer position then **auto-recenters** the window to viewport center over the FRAME step (or just plays it anchored — designer's call; anchored is more continuous) |
| Mobile **long-press ~600ms** | instant overlay | the seam **warms during the 600ms hold** (progress made visible — the hold *is* the warm beat), then fires SPLIT→FRAME on completion. The hold timer now has a visual payoff instead of being invisible. |
| Mobile **5 quick taps** | instant overlay | each tap **brightens the seam one notch** (`0.10 → 0.20 → … → full`), the 5th tap fires SPLIT→FRAME. The tap count becomes the warm ramp — discoverable feedback for the otherwise-hidden gesture. |

Notes for the eventual `src/` implementation (not done here): keep `setPassword('')` on open; keep all `data-*ignore` autofill attrs (and adopt the doc's non-`type=password` mask); the morph is **cosmetic** — real auth stays server-side (`POST /api/dev/auth`, 401 wrong, 429 + `Retry-After` lockout). Reverse-on-leave should cancel any in-flight `/dev` nav. `prefers-reduced-motion`: skip WARM/SPLIT, cross-fade the seam straight to the static PEER window.

---

## Recommendation

**Ship Take 1 — "THE SEAM."** It is the most literal and cheapest faithful reading of "the trigger *transforms into* a portal-window": the resting affordance is **already a 1px peek at the board**, so the hover-morph is one continuous reveal of a single shared element (seam → frame edge), never a swap to a separate overlay. It hands off seamlessly into the recommended vault (Direction A "THE PEEPHOLE" — its FRAME state *is* PEER), degrades cleanly under reduced motion, and turns the two invisible mobile gestures (long-press hold, 5-tap) into a **visible warm ramp**, fixing today's feedback-blindness. Keep Take 3's single Google-flicker idea in reserve only if the diamond-door vault (Variant C) is chosen instead; keep Take 2's iris only if the comic-iris vault (Variant B) wins. Either way the entry morph and the vault must come from the **same** geometric family — don't enter through a seam and land in an iris.

**For the lockup:** the `entry-flow/` prototype demonstrates Take 1 end-to-end — resting seam → warm → split → PEER window (mock board behind) → click → KNOCK → wrong-knock rattle → CORRECT camera-through into a mock board — with a DEMO controls cluster to step each state and `prefers-reduced-motion` honored.
