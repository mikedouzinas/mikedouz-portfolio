# Cere Panel & Board Motion Directions — THE HARLEQUIN (/dev)

**Status:** design directions only (ideas + Framer Motion params + ASCII), not final code. No src edits.
**Stack:** Framer Motion + Tailwind. React 19 / Next 15.
**Tickets covered:** #45 (Cere open/close), #32 (board Done-card exit, shares #45's primitive), #63 (detached-panel expand), #64 (vacated-slot placeholder), #75 (Cere proposal preview cards).

---

## 0. Theme read & motion north star

THE HARLEQUIN is a dark theatre floor (`#0d0b11`), a faint champagne engineering grid, film grain, and a **duotone champagne** palette (`#E7E2D4` / `231,226,212`). The Google rainbow is allowed **only as a brief flicker accent** — exactly as the wordmark diamond does it (`harlequin-diamond-flicker`: cycle the four hues once over ~1.5s, settle to champagne). Limelight stays the display marquee; Cere's wordmark is Poiret One; **no Marcellus**.

Motion thesis: **the harlequin is a performer stepping in and out of a spotlight.** Things don't "poof" — they take the stage and bow off it. Champagne is the resting light; the rainbow is a single theatrical flourish (a flashbulb, a curtain shimmer) that fires once and is gone. Every motion below is transform/opacity/filter only (no layout thrash beyond Framer's shared-layout, which is GPU-composited), and every spec has a `prefers-reduced-motion` fallback that collapses to a ≤120ms opacity cross-fade.

### Hard constraint discovered in the code (must respect)
`Poof.tsx` documents it and `CerePanel` relies on it: **the resting/visible state must leave `transform: none; filter: none` on any ancestor of the glass panel.** A non-`none` `transform` or `filter` on an ancestor kills descendant `backdrop-filter`, which strips the frost off Cere's glass and the detached ticket. So all the open/close springs below **animate a child wrapper, not the glass element's own backdrop ancestor**, OR they only carry transform/filter *during* the motion and resolve to literal `none` at rest. Each direction notes where it lands.

---

## 1. Shared animation primitive — `<Curtain>` / `useStageSpring` (for #45 + #32)

The current shared primitive is `Poof` (scale + blur + particle ring). It was rejected for Cere open **and** close. Rather than tune the poof, replace the *primitive* with one spring-driven entrance/exit that both the Cere panel (#45) and the board Done-card exit (#32) consume. Two framings — pick one, build once.

### The one spring (shared token)

```ts
// stage.ts — the single source of truth both #45 and #32 import.
export const STAGE_SPRING = { type: 'spring', stiffness: 520, damping: 34, mass: 0.9 } as const;
// ≈ a crisp, barely-overshooting settle (~260ms perceived). Snappy, not bouncy.
// For the softer "panel" feel use the same family, lower stiffness:
export const STAGE_SPRING_SOFT = { type: 'spring', stiffness: 380, damping: 30, mass: 1 } as const;
export const STAGE_EXIT = { duration: 0.22, ease: [0.4, 0, 1, 1] } as const; // exit is a tween: faster, no overshoot on the way out
```

Rationale for spring-in / tween-out: an entrance that overshoots slightly feels alive (the performer arrives with momentum); an exit should feel *decisive and quick* — a spring on exit reads as hesitation. This asymmetry is the single most important fix vs. the symmetric poof.

### Option A — "Spotlight rise" (RECOMMENDED for the shared primitive)

The element rises a few px into place while a soft champagne glow blooms behind it and fades. No particles, no blur on the resting frame.

```tsx
const stageVariants = {
  hidden:  { opacity: 0, y: 10, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1 },   // resolves to transform that Framer will clear to none at rest if we set transformTemplate
  exit:    { opacity: 0, y: 6,  scale: 0.985 },
};
// transformOrigin: '50% 100%'  (rises from its own base, like standing up into light)
// enter -> STAGE_SPRING_SOFT ; exit -> STAGE_EXIT
```

The glow is a **sibling** (absolutely positioned, `pointer-events:none`) so it never touches the panel's backdrop-filter ancestor:

```tsx
<motion.div  // glow plate behind the panel
  initial={{ opacity: 0, scale: 0.6 }}
  animate={{ opacity: [0, 0.5, 0], scale: 1.4 }}
  transition={{ duration: 0.5, ease: 'easeOut' }}
  style={{ background: 'radial-gradient(circle, rgba(231,226,212,0.35), transparent 65%)' }}
/>
```

```
 OPEN (≈260ms)                      CLOSE (≈220ms)
                                    ┌──────────┐  ░ glow already gone
   · ·   soft champagne bloom        │  panel   │  lifts 6px, fades
  ┌──────────┐  ↑ rises 10px        └────·─────┘
  │  panel   │  scale .97→1            · ·       quick, decisive
  └──────────┘  settle (tiny over)
       ▔▔▔  base = transform origin
```

**Backdrop-filter safety:** at rest `y:0, scale:1` — set `transformTemplate={(_, gen) => (gen === 'translateY(0px) scale(1)' ? 'none' : gen)}` (or simply animate a non-backdrop child) so the glass stays frosted. Glow lives on a sibling, so it's always safe.

### Option B — "Curtain wipe + rainbow flick"

The panel is revealed under a `clip-path` inset wipe (top-down), and at the instant the wipe completes a 1px champagne hairline along the leading edge does a **single Google-rainbow flicker** (reuse the exact `harlequin-diamond-flicker` keyframe timing: 4 hues over ~0.4s, settle champagne). This is the theatrical signature — used sparingly, it ties Cere to the wordmark.

```tsx
// clip-path is GPU-cheap and doesn't break backdrop-filter on descendants.
initial={{ clipPath: 'inset(0 0 100% 0)', opacity: 0 }}
animate={{ clipPath: 'inset(0 0 0% 0)',  opacity: 1 }}
exit=   {{ clipPath: 'inset(100% 0 0 0)', opacity: 0 }} // wipes UP on close — reverse curtain
transition={STAGE_SPRING_SOFT}
// leading-edge hairline: a 1px sibling bar that runs the rainbow flicker once, only on enter.
```

```
 OPEN: curtain drops                CLOSE: curtain lifts up
 ┌══════════┐ ← rainbow hairline    ┌──────────┐
 ├──────────┤   flickers once       │██████████│ ← wipe rises
 │░░░░░░░░░░│   then champagne      ├══════════┤ ← champagne edge
 │ (hidden) │                       │ (hidden) │
 └──────────┘                       └──────────┘
```

### Option C — "Iris/aperture" (twin nod, lower priority)

Scale from a point with `transformOrigin` at the trigger (the ＋Cere button / portal), as if the panel is summoned *from* the portal. Cute conceptual tie to the portal login, but origin math is fiddly across mobile/desktop and the detached-ticket morph already owns "fly from origin," so this would muddy the vocabulary.

### Tradeoffs / recommendation (#45 + #32)

| | A Spotlight rise | B Curtain wipe + flick | C Aperture |
|---|---|---|---|
| Distinctiveness | medium-high | **high** (rainbow signature) | high but derivative of the morph |
| Backdrop-filter safe | yes (sibling glow) | **yes** (clip-path) | risky (scale on ancestor) |
| Reuse for #32 Done-card | trivial | trivial | awkward (origin per-card) |
| AI-generic risk | low | very low | medium |
| Perf | excellent | excellent | excellent |

**Recommend: ship Option A as the default `STAGE_SPRING` primitive, and layer Option B's single rainbow-hairline flicker on top for Cere specifically (#45).** That gives the board (#32) a clean, fast spotlight rise/exit it can share verbatim, while Cere — the marquee feature — earns the one theatrical flourish. Keep both behind one component:

```tsx
<Stage show={open} variant="rise" flourish="rainbow-edge">{children}</Stage>
// #32 board card: <Stage show={!removed} variant="rise" /> on exit only.
```

**#32 specifics (Done-card exit):** on "Done," the card should *take a bow then leave the lane*: a 60ms downward nudge (`y: 4`) and a single rainbow-edge flick (success beat), then exit up-and-out with `STAGE_EXIT` while neighbours close the gap via Framer layout. Reuses `STAGE_EXIT` + the rainbow-edge sibling. No green confetti — the champagne edge flick *is* the celebration, on-theme.

---

## 2. #45 — Cere open + close (the rejected poof's replacement)

Use the §1 primitive. Concrete Cere choreography, three options for the **panel-specific feel** on top of the shared spring.

### Option 45-A — "Rise + settle, breath of glow" (RECOMMENDED)
Shared Option A, tuned `STAGE_SPRING_SOFT` (stiffness 380 / damping 30), `transformOrigin: 50% 100%`, plus:
- **Header staggers in:** CereMark wordmark + close-X fade/slide `y: 4 → 0` at `delay: 0.06`, `duration: 0.18`. Makes the panel feel composed top-down, not a single slab.
- **Rainbow-edge flick** once on open along the top 1px (the §1B hairline). This is the only rainbow in the panel.
- **Close:** `STAGE_EXIT` (220ms tween), glow already gone, no flicker on close (flourish is an *arrival* gesture).

```
OPEN                                CLOSE
   ✦ champagne bloom blinks         ┌─────────────┐
 ╔═════════════╗ ← rainbow flick    │ Cere      ✕ │  lifts 6px
 ║ Cere     ✕  ║ header staggers    │  …content   │  fade 220ms
 ║ ───────────  ║ in (y 4→0)        └──────·──────┘  decisive
 ║  Describe…  ║ panel rises 10px        · ·
 ╚═════════════╝ scale .97→1
```

### Option 45-B — "Card flip-down from the trigger"
Panel does a short 3D `rotateX(-8deg → 0)` from `transformOrigin: top` while fading — like a placard tipping down into view. Distinct and tactile.
- `rotateX: -8 → 0`, `y: -8 → 0`, `transition: STAGE_SPRING` (520/34).
- **Backdrop-filter risk:** `rotateX` is a 3D transform on the panel ancestor → **kills the frost.** Mitigation: apply the rotate to an inner content wrapper and keep the frosted glass shell static-opacity-only. Adds a node; doable but fussier than A.

### Option 45-C — "Quiet scale-fade" (the safe floor)
`opacity 0→1`, `scale 0.96→1`, `STAGE_SPRING_SOFT`; exit `scale 1→0.98`, 200ms tween. No glow, no flicker. This is what reduced-motion collapses to anyway. Lowest risk, lowest personality — keep as the `prefers-reduced-motion` and as fallback if the flourish ever feels noisy in use.

### Recommendation (#45)
**45-A.** It directly answers "smooth, polished, performant," reuses the shared primitive cleanly for #32, and spends the single allowed rainbow flicker on the marquee panel exactly where the theme wants it. Avoid 45-B's 3D rotate on the glass ancestor — not worth the backdrop-filter gymnastics.

---

## 3. #63 — Detached ticket expand: "press IN, then grow"

Today: shared-`layoutId` morph, `transition: { duration: 0.2, ease: 'easeOut' }` — linear-feeling and instant. The ask: the card **dips/presses down first** (physical press), **then springs up and out** to the detached panel. Collapse TBD.

Key technique: **a two-beat sequence on the same shared-layout element.** Beat 1 is a fast pre-press (scale down + tiny `y`), beat 2 is the layout morph on a *spring* (Framer's `layout` transition can be a spring). The press must happen on the *inline* card before/at the moment `open` flips, so the eye reads "I pushed it in" → "it expanded out."

### Option 63-A — "Press-and-launch" (RECOMMENDED)
On click: don't flip `open` immediately. Run a 90ms press on the inline card, then flip `open`; the shared-layout morph then springs the element to the centered panel.

```tsx
// inline card press, then detach
async function detach() {
  await controls.start({ scale: 0.94, y: 2, transition: { duration: 0.09, ease: 'easeIn' } }); // press IN
  setPlaceholderVisible(true);
  setOpen(true); // shared-layout morph fires next frame
}
// the morph spring on BOTH layoutId nodes:
const morphSpring = { type: 'spring', stiffness: 420, damping: 32, mass: 1.1 }; // grows with a little overshoot
// apply to the layout transition:  transition={morphSpring}  (replaces duration:0.2 easeOut)
```

The overshoot (damping 32 vs critical ~41 for these values) gives the "grow up/out past target then settle" pop — the springy/bouncy ask, kept tasteful (one small overshoot, not a wobble).

```
 click            press IN (90ms)      LAUNCH + GROW (spring, ~340ms)
 ┌───────┐        ┌─────┐  dips         ┌───────────────────────┐
 │ ticket│   →    │ticket│ scale .94    │      ticket (detached) │ overshoots
 │ card  │        └─────┘  y+2          │  full panel, centered  │ then settles
 └───────┘         ▼ pushed in          └───────────────────────┘
```

**Collapse (proposed):** mirror but inverted — a tiny "release" first, then a slightly *damped* return (no overshoot on the way home, so it doesn't bounce off-screen): pre-beat `scale: 1.02` for 70ms (the panel "lifts to leave"), then morph back with `{ stiffness: 480, damping: 40 }` (near-critical, calm landing). The existing `onLayoutAnimationComplete` placeholder handoff stays intact.

### Option 63-B — "Single spring with anticipation keyframes"
Skip the awaited press; bake anticipation into the morph via a keyframed scale on the detached node: `scale: [0.94, 1.04, 1]` over the spring. Simpler (no `controls.start` await, no timing coupling to `setOpen`), but the "press" reads as part of the growth rather than a distinct physical push — less of the "press INTO the card" feeling Mike described. Good fallback if the awaited sequence causes flicker with shared-layout.

### Option 63-C — "Weighted press, depth shadow"
63-A plus the shadow/glow deepening *during* the press to sell physical depth: on press, `boxShadow` inset deepens and `ContainedMouseGlow` intensity dips (light occluded as it presses in), then on launch the big detached `shadow-[0_0_80px...]` blooms. Most tactile; costs an animated boxShadow (cheap enough at one element). Pairs with 63-A, not exclusive.

### Tradeoffs / recommendation (#63)
- 63-A is the most faithful to "press IN then grow," and reuses the existing shared-layout architecture — only the transition changes from tween to spring plus a 90ms pre-press. Lowest structural risk.
- 63-B is simplest but softer on the "press" semantics.
- 63-C is the richest; fold its shadow/glow dip into 63-A if it reads well.

**Recommend 63-A, with 63-C's press-depth shadow as a stretch.** Spring numbers to start: morph `420/32/1.1` (expand, slight overshoot), collapse `480/40` (calm), press `90ms easeIn scale .94 y+2`, release `70ms scale 1.02`. Respect reduced-motion: skip press + use the current 200ms tween.

---

## 4. #64 — Vacated-slot placeholder ("Be right back." + bobbing dot)

Today: dashed champagne outline, italic "Be right back.", one pulsing dot, `repo #n`. Functional but generic. Replace with something that fits a *theatre/harlequin* board: the slot is a **stage the performer briefly left.**

### Option 64-A — "On stage" / spotlight pool (RECOMMENDED)
The slot reads as an empty lit stage waiting for the act to return. A soft champagne radial "spotlight pool" breathes at center; copy is a marquee aside.
- Visual: dashed champagne border stays (keeps "slot" legibility), but center gets a `radial-gradient(circle, rgba(231,226,212,0.10), transparent 70%)` pool that scales `0.9 → 1.05` over 2.4s ease-in-out (slower than today's 1.6s — calmer, more "ambient stage light").
- Copy options (pick one, sentence case, in Cere/HARLEQUIN voice):
  - **"Center stage."** (the ticket is the act currently performing — literally true: it's the detached/expanded one)
  - **"On stage."** / **"Taking a bow."**
  - **"In the spotlight."**
- Keep `repo #n` as the small caption — it's the ticket's "billing."

```
┌╌╌╌╌╌╌╌╌╌╌╌╌┐
╎    ·✦·     ╎   ← soft champagne spotlight pool, breathing
╎ Center stage╎   ← italic champagne
╎  repo #42   ╎   ← faint caption
└╌╌╌╌╌╌╌╌╌╌╌╌┘
```

### Option 64-B — "Diamond placeholder" (harlequin glyph)
Replace the dot with a single rotating/pulsing **harlequin diamond** (the wordmark motif) outline at center; copy "Out front." or "On the board.". The diamond does a *very* occasional single rainbow-edge flick (every ~6s) — keeps the rainbow rare. Strong theme tie, but a rotating diamond risks competing with the detached panel for attention; keep it small and slow (`rotate: 0→180` over 8s, near-still).

### Option 64-C — "Ghost of the card" / placard
Render a faint ghost of the *actual ticket's* header (title clamped to 1 line at 8% opacity) with a dashed border and a thin champagne shimmer sweeping across it every few seconds (like light catching an empty placard). Most informative (you see *which* ticket is out), but more build and risks reading as a broken/half-loaded card — the very thing the placeholder exists to avoid.

### Recommendation (#64)
**64-A with copy "Center stage."** — it's witty, literally accurate (the detached ticket *is* center stage), on-theme, and the spotlight pool is a one-line change to the existing pulsing element. Pull 64-B's diamond glyph in only if a pure pool feels too plain. Reduced-motion: static pool, no breathing.

---

## 5. #75 — Cere proposal preview cards (glanceable, scannable)

Today (`ActionRow` in `CerePanel.tsx`): create rows show New chip + priority/size/repo + title; update rows show an Update chip + repo#n + a `·`-joined change summary, and a `BodyDiff` is rendered **always-expanded inline** when the body changed. Problems for scanning: (1) update rows lead with the *change list*, not the **ticket title** — you can't tell *which* ticket at a glance; (2) diffs are always open, so a multi-action proposal becomes a wall; (3) create vs update vs close isn't visually loud enough to triage in one pass.

Design goal: **title-first, type-marked, collapsed-by-default with expand-to-diff.** A proposal list you can scan top-to-bottom and know what's about to happen without opening anything.

### Data available (from `CereAction`)
- create: `repo, title, priority, status, size, subtasks[]`
- update: `repo, number, priority?, status?, size?, state?('closed'⇒Done/'open'⇒reopen), body?, bodyBefore?`
- "close" is `update` with `state:'closed'`. Treat it as a **third visible type** ("Close/Done") even though it's an update under the hood — that's what makes the list scannable.

### Three action types, three accent treatments (left rail marker = type)

```
CREATE  → emerald left rail  (＋)   "New"
UPDATE  → sky left rail      (✎)   "Update"
CLOSE   → champagne rail     (✓)   "Done"   (state:'closed'; reopen = sky "Reopen")
```

A **2px colored left rail** + a small glyph is the type marker — louder than today's pill, and it lets the eye triage by color-down-the-edge. Type label sits as a tiny uppercase eyebrow so the *title* can be the dominant line.

### Collapsed row (default) — title-first

```
┌▏ ＋ NEW · P1 · S ───────────────── portfolio ┐   ← rail emerald, eyebrow tiny
┊▏ Header overlaps first card on mobile      ⌄ ┊   ← TITLE dominant (text-white/90)
└▏ 3 subtasks                                   ┘   ← only if present
   ^left rail (2px, type color)        expand chevron (only when there's a diff/detail)

┌▏ ✎ UPDATE ──────────────────── apollo #128 ┐
┊▏ Add Escape-to-close                       ⌄┊   ← for updates: show the TITLE from board ctx*
┊▏ P2 · In progress · edit description        ┊   ← change summary as the SECONDARY line
└▏                                             ┘

┌▏ ✓ DONE ───────────────────── iris-mobile #44┐
┊▏ Background audio for vault files            ┊   ← title, struck-through-on-confirm vibe
└▏ marking Done · completes 5 subtasks         ┘   ← no chevron (close needs no diff)
```

\*Update/close rows currently lack the ticket title (the action only carries `number`). **Recommendation: surface the title.** Either (a) the planner adds `title` to update actions (cheap — it's already in board context the model sees), or (b) the client looks it up from the loaded `issues[]` by `repo+number` (zero backend change). Prefer (b) for this design — pass the board `issues` into `CerePanel`/`ActionRow` and resolve `title` locally. **This is the single highest-value change in #75** — without the title, updates aren't scannable.

### Expanded row (chevron toggles; only create-with-body or update-with-body have one)

```
┌▏ ✎ UPDATE ──────────────────── apollo #128 ┐
┊▏ Add Escape-to-close                       ⌃┊  ← chevron up = open
┊▏ P2 · In progress · edit description        ┊
┊▏ ┌───────────────────────────────────────┐ ┊
┊▏ │  description diff                       │ ┊  ← BodyDiff, now INSIDE the disclosure
┊▏ │  - Modal stays open on Escape           │ ┊
┊▏ │  + Escape closes the modal; focus       │ ┊
┊▏ │  + returns to the trigger.              │ ┊
┊▏ └───────────────────────────────────────┘ ┊
└▏ + subtasks: Trap focus · Restore on close  ┘  ← create subtasks list also lives here
```

### Motion for the proposal list

- **Entrance (proposals arrive):** stagger the rows in — each row `opacity 0→1, y 6→0`, `transition: { duration: 0.22 }`, `staggerChildren: 0.05`. Reads as Cere "dealing out" the cards. Reuse the §1 spring family for cohesion.
- **Expand/collapse:** animate `height: auto` via Framer (`initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}}`) with `STAGE_SPRING_SOFT`; chevron `rotate: 0→180`, `duration: 0.2`. Content fades slightly after height so text doesn't squash.
- **On Confirm:** each row plays a quick success beat keyed to its type, then the whole block exits with `STAGE_EXIT`. For CLOSE rows, a single champagne rainbow-edge flick (ties to #32's Done celebration — same gesture, one vocabulary). Creates get a brief emerald rail pulse; updates a sky pulse. ~180ms, staggered 40ms, then exit.
- **Per-row hover:** rail widens 2px→3px and brightens 10% (`whileHover`), 120ms — cheap affordance that the row is interactive/expandable.

### Layout options for the container

- **75-A Stacked rows (RECOMMENDED):** vertical list exactly as above, title-first, collapsed, chevron-to-diff. Best for the 440px panel; scannable; minimal change from today's `<ul>`.
- **75-B Grouped by type:** sections "New (2) · Update (3) · Done (1)" with a count header each, rows within. Better when proposals are many and mixed; adds vertical chrome. Worth it only if proposals routinely exceed ~5.
- **75-C Summary bar + drawer:** a one-line summary chip row ("＋2 ✎3 ✓1") that expands to the full list. Most glanceable at the top level but hides detail behind an extra click — over-engineered for the typical 1–4 action proposal.

### Recommendation (#75)
**75-A stacked rows, title-first, type-railed, diff-on-expand**, plus the **client-side title lookup for update/close rows** (the load-bearing fix). Keep `BodyDiff` but move it inside a collapsed disclosure. Group-by-type (75-B) only if real usage shows large mixed proposals. Header stays "Proposed · N"; consider augmenting to "Proposed · ＋2 ✎3 ✓1" so the count itself is a triage glance.

---

## 6. Build order & shared-token summary

1. **`stage.ts`** — export `STAGE_SPRING`, `STAGE_SPRING_SOFT`, `STAGE_EXIT`, and a `<Stage>` wrapper (Option A rise + optional rainbow-edge flourish). Replaces `Poof` usage in `CerePanel` (#45) and powers the board Done exit (#32). Keep `Poof` only if something else still wants particles; otherwise retire it.
2. **#45** — wrap Cere in `<Stage variant="rise" flourish="rainbow-edge">`; header stagger. Delete the `enter={false}` poof.
3. **#32** — Done card uses `<Stage>` exit + the bow nudge + rainbow-edge flick.
4. **#63** — swap the two `layoutId` transitions from `{duration:0.2,easeOut}` to spring (`420/32` expand, `480/40` collapse) and add the 90ms pre-press in `detach()` / 70ms release in `collapse()`.
5. **#64** — replace the placeholder dot/copy: spotlight pool + "Center stage."
6. **#75** — `ActionRow` → title-first railed rows; pass `issues` for title lookup; `BodyDiff` inside a chevron disclosure; stagger-in + per-type confirm beat.

**Single rainbow rule across all of the above:** the Google flicker appears in exactly three approved spots, each *once* and brief — Cere open edge (#45), Done card exit (#32), Close-row confirm (#75). Everywhere else is champagne duotone. That keeps the accent rare enough to stay special, per the theme veto.

**Reduced-motion across all:** every spring/flicker collapses to ≤120ms opacity cross-fade; press/overshoot disabled; placeholder pool static. (`useReducedMotion()` is already imported in `Poof.tsx` — reuse the pattern.)
