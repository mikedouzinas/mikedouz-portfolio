# THE HARLEQUIN — "Step Into the World" design directions

Covers three linked tickets as one cohesive exploration:

- **#76 (L)** — Spider-Verse layer: every repo / ticket / expanded view feels like its own world, not a UI panel.
- **#48 (L)** — Full-page rework: background, layout, item styling.
- **#50 (S)** — Bespoke board loader (stop reusing Cere's card-game `HarlequinThinking`).

Read-only study. No code written. Buildable on the current stack: **Next.js 15 / React 19 / Framer Motion (`layoutId` shared-layout already in use) / Tailwind / CSS in `globals.css`**.

---

## 0. What exists today (the constraints we design within)

The board already has a strong, specific identity. The rework must *deepen* it, not replace it.

| System | Where | Current behaviour |
|---|---|---|
| Backdrop | `.dev-workpad` in `globals.css` | `#0d0b11` theatre floor + champagne engineering grid (80px + 16px), top red glow, fixed `feTurbulence` film-grain (`::after`, z-30, `mix-blend-mode: overlay`). |
| Argyle | `HarlequinReveal.tsx` | Red/champagne diamond tile, masked to a 130px radial bloom under the cursor; suppressed over header + tickets (`[data-suppress-reveal]`). |
| Wordmark | `HarlequinTitle.tsx` | **Limelight** Art-Deco display; Google palette is a one-shot **flicker** on the trailing ◆, then settles to champagne `#E7E2D4`. Leading ◆ → red back-arrow on hover. |
| Per-repo identity | `github.ts` `accentFor()` | One RGB string hashed from slug out of a fixed palette of 8. Used only as a chip tint + repo-lane dot. **This is the whole of per-repo differentiation today — a single dot of colour.** |
| Card → panel | `IssueList.tsx` | Framer `layoutId` morph: inline card lifts out, portals to a centered ~800px panel. Tint keyed to **status** (todo=blue / in-progress=amber / done=green), not repo. Background never dims ("invisible click-catch"). |
| Loader | `CereGameLoader.tsx` | Picks Blackjack or War at random — **Cere's** thinking animation, borrowed. Not board-specific. The board fades in over it (#56). |

**Theme constraints (non-negotiable, honoured throughout):** champagne duotone palette; Google rainbow as brief **flicker accent only**; keep **Limelight**; keep the grid; **no Marcellus anywhere**.

**The core gap #76 names:** a repo is one coloured dot; a ticket is one panel; expanding is a same-tint morph. There is no sense of *place* — no feeling that ticket #44 lives in a different world than ticket #76, or that opening a ticket takes you *into* something. Differentiation is currently 1 of ~16M possible signals (hue) and it's barely used.

---

## 1. Three directions for the "world" feel

All three keep the dark champagne theatre + grid + Limelight wordmark. They differ in **what a "world" is made of** and **how far depth/texture is pushed**.

### Direction A — "The Lightbox Table" (recommended)

> The board is a dark drafting table under a single overhead lamp. Each repo is a **physical card-stock swatch** with its own paper grain and edge-light. Opening a ticket is the lamp **swinging down over that one swatch** — the rest of the table falls into shadow and the ticket rises to meet you.

The Spider-Verse "dimension" cue here is **light and depth, not chromatic chaos**. We already have a theatre floor and grain; we lean into *staging* (spotlight, shadow, lift) rather than inventing new palettes per repo. This is the most on-brand reading of "bat-cave energy": layered, hand-crafted, dimensional, but disciplined and champagne-quiet.

- **Per-repo identity** = an **accent hue + a paper-grain texture + an edge-light angle** (a small token bundle, §2), not just a dot. A repo's cards share a faint tint, a unique grain frequency, and a consistent light direction, so a column of cards reads as "one material."
- **Expand-into-a-world** = a **spotlight collapse**: on detach, the whole board dims to ~30% (we currently *don't* dim — this is the change), the chosen ticket's repo-grain blooms up to full opacity, and the panel lifts on a soft drop-shadow + 1–2deg `rotateX` so it reads as tilting toward you off the table.
- **Loader** = the lamp warming up over an empty table (§4, Loader 1).
- **Risk taken:** dimming the board on expand (reverses a deliberate prior decision in #56's notes) — justified because depth requires a foreground/background separation the current flat morph can't give.

```
RESTING                              EXPANDED (Lightbox)
┌──────────────────────────────┐    ┌──────────────────────────────┐
│  THE HARLEQUIN  ◆(flicker)    │    │  ······· dimmed board ······· │
│  [All][apollo][iris][portfo…] │    │  ·····························  │
│ ── grid · champagne · grain ──│    │  ······┌───────────────┐····· │
│ ┌─ todo ─┐ ┌─ in prog ┐ ┌done┐│    │  ······│ apollo · paper│ ↑lift│
│ │ █ card │ │ █ card   │ │ █  ││    │  ······│ grain blooms  │ tilt │
│ │ █ card │ │ █ card   │ │    ││ →  │  ······│  to full      │····· │
│ └────────┘ └──────────┘ └────┘│    │  ······└───────────────┘····· │
│   (cursor bloom = argyle)     │    │   spotlight = repo's edge-light│
└──────────────────────────────┘    └──────────────────────────────┘
```

### Direction B — "Ink Realms" (the literal Spider-Verse read)

> Each repo is a **comic-book dimension** with its own ink treatment: halftone density, line weight, and a one-hue duotone derived from its accent. Expanding a ticket is a **panel-gutter zoom** — the card is a comic panel that fills the page, gutters peeling back.

Most maximal, most overtly "Spider-Verse." Strong identity per repo but the highest risk of fighting the champagne-duotone rule (halftone wants saturated ink) and the highest execution cost (per-repo SVG textures, blend modes, possible Ben-Day dot noise that hurts text legibility on a dark board).

- **Per-repo identity** = halftone dot scale + ink-line weight + duotone hue. apollo = wide warm halftone; iris = tight cool linework; portfolio = champagne fine-grain (the "home" dimension, least inked).
- **Expand** = gutter-zoom: thin champagne "panel gutters" draw around the card, then the card scales to fill while gutters slide off-screen (`clip-path` inset animating to 0). Reads as falling *into the panel*.
- **Tradeoff:** gorgeous in screenshots, but halftone-on-dark + small ticket text is a legibility minefield; mobile perf of per-repo blend layers is a concern. Best as a **deep-mode toggle**, not the default.

```
PANEL-GUTTER ZOOM
┌────────────┐      ┌──┐ gutters      ███████████████
│ ░░ card ░░ │  →   │  │ peel    →    █  ticket fills █
│ halftone   │      │  │ outward      █  the "page"   █
└────────────┘      └──┘              ███████████████
```

### Direction C — "Strata" (parallax depth, quietest)

> The board has **physical depth in Z**. Background grid, mid-layer argyle, foreground cards, and an overhead vignette each sit on their own parallax plane that shifts subtly with the pointer. Expanding pushes the board back in space and brings the ticket forward through the layers.

Lowest risk, most "ambient." Differentiation per repo is gentler (accent + parallax *speed* — heavier repos drift slower, as if denser). The expand is a `translateZ`/scale dolly rather than a new texture. Closest to today's feel, so the smallest leap; the danger is it reads as "nice polish" rather than the "own world" #76 is asking for.

- **Per-repo identity** = accent + parallax depth coefficient + grid density behind that repo's lane.
- **Expand** = dolly-in: board planes recede (scale 1 → 0.96, blur 0 → 3px), ticket dollies forward (scale → 1.0 from a deeper plane). Uses `prefers-reduced-motion` to disable parallax cleanly.
- **Tradeoff:** safest and cheapest, but may under-deliver on the "stepping into a world" ambition.

---

## 2. Per-repo differentiation — a token model

Today differentiation = `accent: "R, G, B"`. Proposal: promote it to a small **world token bundle**, derived **deterministically** from the repo slug (so new repos auto-theme — preserving the "no hardcoded list" security model in `github.ts`) but **overridable** for marquee repos (apollo, iris, portfolio) so they get hand-tuned identities.

```ts
// derived in github.ts alongside accentFor(); shipped on DevRepo
export interface RepoWorld {
  accent: string;        // "R, G, B" — existing, kept
  hueShift: number;      // deg — small rotation applied to grid + glow for this repo
  grain: 'fine' | 'paper' | 'halftone';   // Direction A/B texture family
  grainScale: number;    // baseFrequency for feTurbulence / dot pitch
  lightAngle: number;    // deg — edge-light / shadow direction (consistency cue)
  depth: number;         // 0..1 — parallax speed (C) / shadow weight (A); "heaviness"
  motif: 'diamond' | 'gear' | 'star' | 'wave'; // tiny corner glyph stamped on cards
}

// Deterministic default from slug hash → stable, auto-themes any new repo:
//   accent  = ACCENTS[h % 8]            (unchanged)
//   hueShift= (h % 24) - 12             (±12deg, stays in champagne family)
//   grain   = ['fine','paper','halftone'][h % 3]
//   depth   = 0.4 + (h % 60)/100        (0.4–1.0)
//   motif   = ['diamond','gear','star','wave'][h % 4]

// Hand-tuned overrides for the repos that deserve a signature:
const WORLD_OVERRIDES: Record<string, Partial<RepoWorld>> = {
  'mikedouzinas/apollo':        { grain: 'paper',    motif: 'star',    depth: 0.9, lightAngle: 35 },
  'mikedouzinas/iris-mobile':   { grain: 'fine',     motif: 'wave',    depth: 0.6, lightAngle: 110 },
  'mikedouzinas/portfolio':     { grain: 'fine',     motif: 'diamond', depth: 0.3, lightAngle: 90 }, // "home" world
};
```

How each token is *used* (cheap, CSS-variable driven — no per-repo component branches):

- The repo lane / card wrapper sets `style={{ '--accent', '--hue', '--light', '--depth' }}`.
- **Grain**: one shared `feTurbulence` SVG whose `baseFrequency` reads `--grain-scale`; or three prebuilt data-URI tiles selected by `grain`. Applied as a faint card-background layer at ~0.06 opacity (same recipe as `.dev-workpad::after`).
- **Edge-light**: card border-image / box-shadow uses `--light` angle → a column of one repo's cards all catch light from the same side = "same material."
- **Motif**: a 10px corner glyph at ~25% opacity — a quiet wayfinding stamp, the only place a non-champagne hue lands on a resting card (and even then desaturated).
- **Status tint stays** (todo/in-prog/done) — repo identity is *texture + light + motif*; status is *hue tint*. The two axes don't collide: **repo = material, status = temperature.** This resolves the obvious objection ("won't repo-colour fight status-colour?").

**Recommendation:** ship the **deterministic bundle for all repos** + **3 hand-tuned overrides**. It scales to any repo for free and lets the flagship worlds feel authored.

---

## 3. Layout & background rework (#48)

The current single-`max-w-6xl` column with a sticky header is fine but flat. Proposed rework keeps the grid + grain + cursor-argyle and adds **staging and structure**.

### Background
- Keep `.dev-workpad` grid + grain + cursor-bloom argyle (all on-brief).
- Add a **fixed top-down lamp**: a soft champagne radial centered above the board (replaces/augments the existing top red glow), so the table reads as lit from one overhead source — sets up Direction A's spotlight and gives the dark real depth.
- Add a **bottom vignette** (subtle, fixed) so cards near the fold sit *in* the room rather than floating off a flat black.
- Optional per-repo: when a single repo is filtered (`selected`), rotate the grid hue by that repo's `--hue` and nudge the lamp toward its `--light` angle — **filtering to one repo literally tints the room to that world.** Cheap, high-impact, directly serves #76.

### Layout
- Keep the two views (Status Kanban / Repo sections) but restyle lanes as **labelled "drawers"** of the table, with the Limelight-adjacent uppercase tracking already in `LaneHeader`.
- **Card restyle** (item styling, #48): give resting cards the repo's grain + edge-light + corner motif (§2). Keep the fixed `h-32` slot (it's load-bearing for the morph + no-reflow). Add a thin left **spine** in the repo accent (replaces the lone status dot as the primary repo cue; the status dot stays inline).
- **Header**: keep wordmark + controls; consider moving `group by` / `sort` into a single quiet control cluster so the eye goes wordmark → repo chips → board.

```
PROPOSED BOARD (Status view, Direction A)
┌───────────────────────────────────────────────────────────────┐
│   THE HARLEQUIN ◆       group by [Status|Repo]   sort ▾   ⚙ ＋  │  ← lamp glow above
│   [All] [apollo★] [iris~] [portfolio◆]            12 open       │
│···············································(overhead champagne)│
│  ▌TODO · 4          ▌IN PROGRESS · 3        ▌DONE · 5           │
│  ┌─────────────┐    ┌─────────────┐        ┌─────────────┐     │
│  │▏apollo  ★   │    │▏iris    ~   │        │▏portfolio ◆ │     │
│  │  P1 ● todo S│    │  P2 ● prog M│        │  ✓ done     │     │
│  │  paper-grain│    │  fine-grain │        │  fine-grain │     │
│  └─────────────┘    └─────────────┘        └─────────────┘     │
│   spine=accent       light from L           light from top      │
│·····················(bottom vignette)··························· │
└───────────────────────────────────────────────────────────────┘
  ▌ = repo spine (accent)   ● = status dot   ★~◆ = repo motif
```

### Expand-into-a-world transition (the #76 centerpiece)
Builds on the existing `layoutId` morph — keep it, add staging around it:

1. **Detach** → board scrim animates 0 → ~0.7 opacity (Direction A) over 200ms; everything but the chosen card desaturates + blurs 0 → 3px.
2. The card's **repo grain + edge-light bloom to full** as it morphs (the world "comes up").
3. Panel lands with `rotateX(1.5deg)` + a deepened drop-shadow → tilted toward viewer, off the table.
4. The panel header carries the **repo motif at full size + a one-line "world tag"** (e.g. `apollo · vault`) so the open ticket announces which world you're in.
5. **Collapse** reverses; grain/scrim fade as the card flies home (existing `onLayoutAnimationComplete` placeholder logic untouched).

All of this is CSS variables + Framer `animate` on already-mounted elements + one scrim div — no architectural change to the morph.

---

## 4. Bespoke loader concepts (#50)

Replace `CereGameLoader` (Cere's borrowed card games) on `/dev` with a loader that *is the board's world warming up*. All respect `prefers-reduced-motion` (settle to a static frame) and reuse the existing palette/Limelight.

### Loader 1 — "Lamp warm-up" (recommended, pairs with Direction A)
The drafting lamp powers on over an empty table. A champagne radial glow swells from 0, the grid lines **draw in** (stroke-dashoffset sweep), three empty lane outlines fade up, then a card-shaped silhouette settles into each lane right as data arrives — so the loader's final frame *is* the board's first frame. No jarring winner-frame flash (the #56 problem) because the end state is the board itself.
```
   .             ·  ·  ·            ┌─┐ ┌─┐ ┌─┐
        →    · grid draws in  →     │ │ │ │ │ │   → board
 (dark)        ·  ·  ·              └─┘ └─┘ └─┘
 lamp swells   lanes fade up        cards settle
```

### Loader 2 — "Argyle stitch"
The harlequin argyle (already the board's signature tile) **stitches itself** across the screen: diamonds pop in along a diagonal wavefront in champagne, with the Google rainbow flickering *once* across the wavefront as it passes (the only rainbow, honouring the flicker-only rule), then the whole pattern fades back to the resting cursor-bloom state. Strong brand tie — it's literally `HarlequinReveal`'s tile, animated as an entrance.
```
◆ . . . .        ◆ ◆ ◆ . .        ◆ ◆ ◆ ◆ ◆   (rainbow flickers
◆ ◆ . . .   →    ◆ ◆ ◆ ◆ .   →    ◆ ◆ ◆ ◆ ◆    along the diagonal,
◆ ◆ ◆ . .        ◆ ◆ ◆ ◆ ◆        ◆ ◆ ◆ ◆ ◆    then settles champagne)
```

### Loader 3 — "Dealing the worlds"
A nod to the card-game heritage *without copying Cere*: a single dealer hand flicks **repo-coloured cards** out to the three lane positions (todo/in-prog/done), each card stamped with a repo motif, fanning into place. Keeps the playful card motif but reframes it as *the board dealing its own tickets* rather than Cere playing a game against you.

**Recommendation:** **Loader 1** as default (cleanest cutover, reinforces Direction A's lamp/stage language, dodges the #56 flash by ending on the real board). **Loader 2** as a delightful occasional variant.

---

## 5. Scope: how far does the world extend?

- **#76 / #48 / #50: Harlequin (`/dev`) only.** The "world" language (per-repo texture, spotlight expand, lamp loader) is specific to the board's content model (repos as worlds, tickets as rooms). Pushing it site-wide would dilute the main portfolio's calmer identity and is out of scope for these tickets.
- The **shared primitives** it leans on (`ContainedMouseGlow`, grain recipe, `feTurbulence`, Framer `layoutId`) already exist app-wide, so nothing new needs to be globalised.

---

## 6. Recommended path (buildable, incremental)

1. **Tokens first** — add `RepoWorld` to `github.ts` (deterministic + 3 overrides), expose as CSS vars on repo chips + card wrappers. *(Foundation for everything; ship-able alone as "richer repo colour.")*
2. **#48 background/layout** — lamp glow + vignette + per-repo grain/spine/motif on resting cards; room re-tints when one repo is filtered. *(Visible win, low risk.)*
3. **#76 expand-into-a-world** — add scrim + blur + grain-bloom + tilt around the existing `layoutId` morph; repo motif + world-tag in the panel header. *(The headline feature, contained change.)*
4. **#50 loader** — build Loader 1 ("Lamp warm-up"), retire `CereGameLoader` on `/dev`; keep `prefers-reduced-motion` static frame. *(Small, self-contained.)*

**Direction A (Lightbox Table)** is the recommended through-line: it delivers #76's "step into a world" via light/depth/material (fully inside the champagne-duotone + grid + Limelight + flicker-only constraints), is the cheapest of the three to execute on the current stack, and degrades gracefully under reduced motion. Direction B (Ink Realms) is the high-risk, high-reward deep-mode toggle to explore later; Direction C (Strata) is the fallback if the team wants the smallest possible change.

### Tradeoff summary
| | A · Lightbox | B · Ink Realms | C · Strata |
|---|---|---|---|
| "Own world" payoff | High | Highest | Medium |
| On-brief (champagne/flicker) | Strong | Strained (halftone wants ink) | Strong |
| Legibility risk | Low | High (dots on dark + small text) | Low |
| Build cost | Medium | High | Low |
| Reduced-motion story | Clean | Awkward | Clean |
| Mobile perf | Fine | Risky (blend layers) | Fine |
