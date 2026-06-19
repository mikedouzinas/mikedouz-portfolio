# #62 — The Little Window · portal-entrance lockups

Three standalone HTML lockups prototyping the "little window" portal entrance to THE
HARLEQUIN board. Each file is self-contained (inline CSS + vanilla JS, fonts via Google
Fonts CDN) and opens by double-clicking — nothing is wired into the app, and no file
references local build assets. Mock/placeholder ticket cards stand in for the real board.

Open `index.html` for the gallery, or any `variant-*.html` directly.

## Demoing the states
Each variant has a **DEMO STATES** control cluster (bottom-left): `Type`, `Wrong`,
`Lockout`, `Correct → enter`, `Reset`. You can also click the window/peephole and type the
password manually — it is **OPEN5** in all three. Five glyphs auto-submit. The state arc is:
**idle (peering in) → typing → WRONG (shake + ink/halftone flash + "N attempts left") →
LOCKOUT (3 fails, ~6s cooldown bar) → CORRECT (step through the window → mock board view)**.

## Fidelity to the existing aesthetic
Pulled directly from `src/styles/globals.css`, `HarlequinReveal.tsx`, `HarlequinTitle.tsx`,
and `uiMeta.ts`:
- **Champagne duotone** — ink `#0d0b11`, champagne `#e7e2d4`/`#EDE6D6`, harlequin red
  `#b3122b` / `#ea4335`.
- **Grid background** — the same layered champagne lines at low opacity (80–88px major +
  16px minor) over a warm top glow, plus the SVG `feTurbulence` film-grain overlay copied
  from `.dev-workpad::after`.
- **Harlequin argyle** — the exact red-diamond/champagne-stroke SVG tile from
  `HarlequinReveal`, used as the distant board texture behind the glass.
- **Limelight** display face (CDN) for the THE HARLEQUIN wordmark with `letter-spacing:0.18em`,
  matching `HarlequinTitle`. **No Marcellus anywhere.**
- **Google rainbow as flicker only** — the four hues appear as small ticket pips, one wordmark
  diamond, and (variant B) the SFX text; never floods. Body/utility type is Space Grotesk +
  Space Mono (variant B adds Bungee for comic onomatopoeia).

---

## Variant A — The Framed Window
**Metaphor:** literally peering through a small, distant, mullioned window from outside.
**Explores:** physical depth and glazing realism — the most grounded reading of "little window."

Techniques:
- CSS `perspective` + `translateZ` parallax: the board sits on a far Z-plane behind the
  glass; "stepping through" dollies the whole `.window` forward (`scale(2.6) translateZ`)
  while the board plane comes toward you and de-blurs.
- Window cues: padded champagne frame, muntin cross-bars (`::before`/`::after`), inner shadow,
  a screen-blend reflection **sheen** top-left, and a vignette to pull the eye in.
- Stop-motion: grain overlay jitters on `steps(4)` whole frames; wrong shake uses
  `steps(2)`. Wrong also fires a red **halftone burst** (radial-dot background, screen blend)
  and an **ink splatter** SVG that pops and clears.
- Diamond passcode pins; a champagne radial **white-wipe** crossfade marks the moment of crossing.

Evaluate: does the depth read as a real window? Is the dolly-through legible or disorienting?

## Variant B — The Comic-Panel Iris
**Metaphor:** a comic page where the middle panel is a camera iris you look through.
**Explores:** the Spider-Verse / print-comic direction hardest — benday dots, ink borders,
onomatopoeia, speech-bubble UI.

Techniques:
- Three stacked panels with thick champagne borders + hard offset drop-shadows; top/bottom
  are **narration caption boxes** (paper-on-ink, comic register copy).
- The "window" is a circular **camera iris** (`border-radius:50%` aperture + conic-gradient
  blade ring); CORRECT animates the aperture wide (`width:220%`) so it swallows the page —
  an iris-out wipe instead of a zoom.
- Password lives in a **speech bubble** with a CSS tail; cells use Bungee for a stamped feel.
- Wrong throws a rotating **SFX word** ("SKKT!/BZZT!/NOPE!") with text-stroke + red drop, a
  red halftone flash, and a `steps(2)` panel stutter. Lockout escalates to "CHAK-CHUNK".

Evaluate: is the comic framing charming or too loud for a login? Does the iris-out feel like
entering, vs. the panel just disappearing?

## Variant C — The Diamond Door (my pick to push furthest)
**Metaphor:** a champagne **diamond door** set into the grid wall, with a brass fisheye
**peephole** — you knock, say the word, and it swings open in stop-motion.
**Explores:** the harlequin diamond as architecture + the hardest stop-motion motion, and the
most on-brand object (the diamond is the board's core motif).

Techniques:
- The diamond casing/leaf/peephole are rotated 45° squares; the brass peephole counter-rotates
  so its **fisheye lens** (scaled argyle behind an inset radial shadow + glint) reads upright —
  a genuine "little window" you peer through.
- CORRECT swings the door leaf on `rotateY(-105deg)` with **`transition: ... steps(7)`** for a
  choppy hand-animated swing, then dollies the whole frame `scale(3.4)` on `steps(6)` into the
  board — the clearest "stepping through" of the three.
- Wrong **rattles** door + casing (`steps(2)`), bursts a red halftone ring from the peephole,
  and ink-splatters from the keyhole. Lockout greys the lens, reddens the leaf, drains a 6s bar.

Evaluate: is the diamond-door the strongest brand fit? Is the `steps()` stop-motion swing
satisfying or does it read as janky/dropped-frames (intentional, but tune the step count)?

---

## What to evaluate across all three
- **Metaphor that lands best** for "a small, gated glimpse": framed window (A), iris (B), or
  diamond door (C).
- **Motion feel** — `steps()` stop-motion is used everywhere; decide how choppy is "crafted"
  vs. "broken," and whether the transition-through is exciting or nauseating.
- **Failure drama** — ink/halftone/SFX intensity; the "N attempts left" + lockout messaging.
- **Restraint** — confirm the Google rainbow stays a flicker accent and never floods.
- **Real wiring later** — these are cosmetic. Real auth stays server-side (cookie + middleware),
  exactly like the current `DevPortal.tsx`; the chosen lockup would replace only its visuals.

## Quick verification
- No `<script src>`, `<img src="...local">`, or `url(./…)` references — all art is inline
  SVG data-URIs or CSS gradients; only the `<link>` to fonts.googleapis.com is external.
- All four files open standalone; `index.html` links the three with relative names.
- `prefers-reduced-motion` is honored in every variant (animations/transitions disabled).

---

## Session 2 — Mike's feedback, changes made (2026-06-19)

### A — THE SEAM (entry-flow/index.html) — two fixes applied

1. **Scrim removed.** The `.scrim` element (`position:fixed;inset:0; background: radial-gradient dark overlay`) was the source of the full-screen dimming. It's now `display:none` — the portal opens over the page without any darkening behind it. The page content stays fully visible when the window is open.

2. **Blue-focus artifact on outside click fixed.** Three-pronged fix:
   - The `.stage` element now carries `tabindex="-1" style="outline:none"` so it cannot receive a browser focus ring when clicked.
   - The global `:focus-visible` rule that was applying a blue outline to everything is replaced with targeted rules: only `.knock-input:focus-visible` gets a subtle champagne outline; demo buttons get the blue ring only.
   - A `mousedown` listener on the stage fires `e.preventDefault()` before `closePortal()`, suppressing the focus state before the browser can assign it.
   - The `mouseleave` close still works; Esc still works; clicking *inside* the window does not close it.

Everything else (the seam warm/tap-ramp, footlights, leaves splitting, the board drift, the splash wipe, all triggers) is unchanged.

---

### B — DIAMOND DOOR (variant-c2.html) — full redesign of the interaction arc

Kept the visual DNA of variant-c.html (champagne duotone, Limelight, harlequin argyle, stop-motion `steps()`) but rebuilt the *interaction choreography* to match Mike's description:

**Wall cover at rest.**
At rest, a second diamond-shaped element (`.wall-cover`) sits flush over the door at z-index 20 — same diamond silhouette, same grid lines, but slightly lighter fill with a barely-visible `◆` glyph. It *conceals* the leaf and board behind it.

**Hover → wall lifts.**
On `:hover` the wall cover transitions out (opacity → 0, translateY(-14px) scale(0.92), `steps(4)`) to reveal the diamond door. A "spin the mouse inside · unlock the door" hint appears.

**Mouse spin inside diamond → bloom.**
Mouse movement inside the diamond boundary is tracked by angle accumulation. A champagne glow orb (`.cursor-orb`) follows the cursor. Once the accumulated rotation crosses 360°, the diamond **blooms** — the casing, behind, and leaf all expand to a larger size (172px → 210px inner, 200px → 240px casing) via `steps(5)` transitions. The password sill fades in below.

**Password entry.** Same OPEN5 mechanic, footlights, rattle-on-wrong, lockout bar.

**Flush entry animation.**
On correct password: the door leaf swings open (`rotateY(-108deg)` on `steps(7)`), then the whole `.door-stage` scales to `scale(14)` on `steps(6)` — a stop-motion expansion that covers the viewport. The arrived board fades in behind it. This is the "flush expand": the diamond BECOMES the board rather than cutting away.

> **Still needs refinement:** The flush expand (`scale(14)`) works but is not a true seamless morph into the board because CSS `scale` on a diamond-shaped element still leaves a seam at the edges. The ideal version would clip-path-expand the diamond into a rectangle and cross-dissolve into the board. This would require either a Canvas approach or SVG clip-path animation (both are viable). The current version is a tasteful approximation — the scale is fast enough and the arrived board fades in simultaneously so it reads as an expansion. Worth revisiting when wiring into the real app.

---

### C — CONCEPTS CAPTURED

#### Two-style randomizable portal identity
Mike's idea: the site could randomly pick between two distinct portal styles on each visit, making the entrance feel alive and slightly unpredictable.

**Axis 1 — Password-interface style** (the comic-book look, variant B): a structured UI artifact — speech bubble, panel borders, stamped type, SFX onomatopoeia. The portal is a *form* dressed in a costume.

**Axis 2 — Portal-design style** (variant C / the circle): an *architectural object* — a door, a circle, a shape that exists in the world of the wall. The password entry is secondary to the object itself.

These two axes are genuinely different in feel. Randomizing between them (or between sub-variants like "diamond door" and "framed circle") would mean every visit has a slightly different character — consistent brand, different *mood*.

Implementation note: a single random coin-flip in `DevPortal.tsx` could toggle between two CSS theme classes or swap the component entirely. The password and auth logic are identical; only the visual wrapper changes.

#### Comic Iris / Portal with Tickets (portal-circle.html)
Separate concept demo exploring the "circle with pattern inside" look. A full-bleed circle filled with the harlequin argyle (drifting), with a ghost Limelight wordmark at center. On hover or click, **tickets spawn out of the portal edge** — each one is a small board card (issue number + pip) that ejects radially and floats away in stop-motion steps.

Mike's note: he does NOT love the current comic animations in variant B, but *does* love the circle-with-pattern and the idea of tickets coming out of a portal. This demo captures that look *without* the comic framing — it's a pure portal object that emits board artifacts. Could be its own entrance style or a decorative idle animation on the /dev page.

#### What to do with variant B
The Comic Iris structure (three panels, speech bubble) reads as too elaborate for a login. Consider stripping it down to *just* the iris aperture — the circular window with the argyle inside, no panels — which is essentially what `portal-circle.html` prototypes. The password entry could appear below the circle the same way it appears in C2.

---

## Files in this directory (updated)
- `index.html` — gallery (links variant-a through c)
- `variant-a.html` — The Framed Window (unchanged)
- `variant-b.html` — The Comic-Panel Iris (unchanged)
- `variant-c.html` — Diamond Door (original — peephole variant)
- `variant-c2.html` — Diamond Door v2 (wall cover + spin-to-bloom + flush entry) ← NEW
- `portal-circle.html` — Concept: circle-with-pattern + ticket spawning ← NEW
- `entry-flow/index.html` — THE SEAM standalone (scrim removed, focus-ring fixed)
