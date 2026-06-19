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
