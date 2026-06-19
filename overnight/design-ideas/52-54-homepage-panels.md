# Homepage Panels — Design Directions (#52 Blog Iris panel, #54 Projects subsidiaries)

**Scope:** Visual / UX directions only. Ideas, not final code. Read-only study of the live site.
**Site aesthetic to honor:** glassy panels, accent-by-area (green/teal = blogs, indigo = projects, blue = experience), cursor-following contained glow, dark-mode-first, Framer Motion fade-ups. Do **not** import the `/dev` "champagne Harlequin" theme.

---

## 0. Ground truth — what "Seer" actually is, and how its glass + glow are built

There is no component literally named `Seer` in the repo. The component everyone points to as "the good glass panel" is the shared **Iris bubble shell**, `src/components/iris/IrisBubble.tsx` — the floating assistant card used by both the blog assistant and Cere (the `/dev` filer). That is the "Seer" referenced in #52. Its glass recipe is worth porting precisely:

**The glass (from `IrisBubble.tsx`):**
```
teal tone:  bg-teal-500/[0.08]  border border-teal-400/[0.12]  backdrop-blur-xl
rounded-2xl
expanded:   shadow-[0_0_80px_40px_rgba(0,0,0,0.35), 0_4px_24px_rgba(0,0,0,0.25)]
```
Three things make it read as "glass" and not just a tinted box:
1. **Ultra-low tint + `backdrop-blur-xl`.** The fill is 8% teal over a blur of whatever's behind it. The panel borrows color from the page rather than painting its own — that's the whole trick.
2. **Hairline luminous border** at 12% teal — a 1px rim that catches light, not a hard divider.
3. **A huge soft drop-shadow** (80px spread) that lifts it off the page like frosted glass on a dark surface.

**The contained glow (from `ContainedMouseGlow.tsx`, wired in `IrisBubble`):**
- A `radial-gradient` circle, `filter: blur(40px)`, clipped to the panel via `absolute inset-0 overflow-hidden rounded-[inherit]`.
- It tracks the cursor in real time (even during scroll), fades in over 300ms on enter, auto-disabled on touch (`pointer: fine` check).
- In the bubble it's tuned soft: `color="45, 212, 191"` (teal), `intensity={0.15}`, `size={320}` — a large, faint wash, *not* the punchier `intensity 0.3 / size 200` used on the content cards.
- Every glow host sets `data-has-contained-glow="true"` so the **global** `MouseGlow` suppresses itself while you're over the panel (no double-glow). Any new panel must keep this attribute.

**Current state of the two homepage targets:**
- **Blog "Iris" panel = `the_web_card.tsx` (`TheWebCard`).** Today it's a `rounded-xl overflow-hidden` card (NOT the IrisBubble glass) with a teal `ContainedMouseGlow` (intensity 0.22, size 180) **plus** a `ContainedWebPattern` spider-web reveal. Content: image thumbnail, title, umbrella description, a hairline divider, and a flat plaintext list of the 3 most recent post titles with a "more posts →" link. It's competent but it's a *link card*, not an Iris surface — there's nothing "Iris" about it despite the ticket name.
- **Projects card = `project_card.tsx` over `base_card.tsx`.** Indigo glow (`99,102,241` @ 0.35). Image left, title + Ask-Iris + GitHub/external links top-right, description, skill pills. One project = one card. `proj_portfolio` (mikeveson.com) currently dumps ~11 sub-features into one prose `specifics[]` array that the card never surfaces — exactly the "too limiting" problem in #54.

The shared visual language to reuse for both tickets: **a hairline `h-px bg-gray-200/80 dark:bg-gray-700/60` divider, `text-[10px] uppercase tracking-[0.18em]` eyebrows, `ChevronRight` that slides in on row hover, and per-area accent color.** These already exist in `TheWebCard` and should be the connective tissue.

---

# Ticket #52 — Blog Iris panel: glass + contained glow + content rethink

### Content audit (what's there now, what should be there)
`TheWebCard` answers exactly one question: "what is The Web and what are the latest posts?" It ignores the two things that actually make this section *Iris*-flavored and unique to the site:
- Per-post **soundtracks** (Spotify tracks curated per post) and **AI voice reading** exist but are invisible here.
- **Blog Iris** (highlight-to-ask, draft-a-comment) is a headline feature with zero presence on the homepage.

**Proposed content model — "The Web as a living reading surface," three tiers:**
1. **Identity** (always visible): logo/thumbnail, "The Web" title, one-line description, post count + last-updated ("12 posts · updated 2d ago" — `text-[10px]` eyebrow, encodes freshness which is *true* info, not decoration).
2. **Latest posts** (always visible, 3 rows): each row = title + tiny accent dot using that post's `theme.accent_color`, + a `ChevronRight`. On hover, surface a one-line "why read this." Optionally a 🔊 glyph if the post has voice.
3. **Iris affordance** (the rethink): a single quiet pill/row — "Ask Iris about the writing" — that mirrors the AskIris pattern already on the card actions. This is what earns the panel the name "Blog Iris panel."

---

### Direction A — "Frosted reading pane" (recommended)
Port the IrisBubble glass wholesale to the blog card: swap `rounded-xl` + hover-gradient for `bg-teal-500/[0.06] border border-teal-400/[0.12] backdrop-blur-xl rounded-2xl`, keep the existing teal `ContainedMouseGlow` but retune to the bubble's soft wash (`intensity 0.15, size 320`), and keep the `ContainedWebPattern` *under* the glass (it already layers via z-index). The spider-web reveal through frosted glass is the signature — no other card on the site has it, and it's literally the brand (the planet-between-two-webs logo).

```
COLLAPSED (default)
┌───────────────────────────────────────────────────────────┐  ← teal frosted glass,
│ ░░ THE WEB · 12 posts · updated 2d ago        [Ask Iris ▸] │    hairline teal rim,
│ ░░░░░░░  Essays on flourishing, tech & ethics.            │    web reveals under cursor
│ [img]    ─────────────────────────────────────────────── │
│          ● Why I Stopped Optimizing My Mornings      🔊 › │  ← accent dot = post theme
│          ● The Tree of Human Flourishing                › │
│          ● On Reactions and Proportion              🔊 › │
│          more posts →                                     │
└───────────────────────────────────────────────────────────┘
```
- **Tradeoffs:** lowest-risk, highest cohesion — it just makes the existing card *be* glass. The only real change is the Iris pill. Doesn't fully exploit the "Iris" name (no inline chat), but keeps the homepage scannable and fast.

### Direction B — "Latest post hero + glass shelf"
Promote the single newest post to a small hero inside the glass (its `theme.accent_color` tints the glow for that one card — a nice touch since the glow can take any RGB), with the rest as a compact shelf below. Makes "there's something new to read" the thesis.

```
┌───────────────────────────────────────────────────────────┐
│ ░░ THE WEB                                    [Ask Iris ▸] │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  ● NEWEST · 2 days ago                          🔊  │  │ ← glow tints to THIS
│  │  Why I Stopped Optimizing My Mornings              │  │   post's accent_color
│  │  A short argument against the productivity-trap…   │  │
│  └─────────────────────────────────────────────────────┘  │
│  ─────────────────────────────────────────────────────── │
│  ● Tree of Human Flourishing ›   ● On Reactions ›  more → │
└───────────────────────────────────────────────────────────┘
```
- **Tradeoffs:** more editorial and alive; the per-post glow tint is a genuinely distinctive micro-interaction. Costs vertical space and adds a second visual hierarchy inside one card — risk of feeling busy next to the flat experience/project cards above it.

### Direction C — "Inline Iris prompt" (boldest)
Put a real, single-line Iris affordance *inside* the glass — a faux composer ("Ask about the writing…") that, on focus/click, expands the card into a mini IrisBubble in place (reuse `IrisChat`/`IrisBubble` machinery already imported by CerePanel). The panel literally becomes Iris.

```
COLLAPSED                          →  EXPANDED (on click of the prompt)
┌──────────────────────────────┐     ┌──────────────────────────────────┐
│ ░░ THE WEB · 12 posts        │     │ ░░ THE WEB                    [×] │
│ [img]  ● Mornings        🔊› │     │  ┌────────────────────────────┐  │
│        ● Flourishing       › │     │  │ Iris: ask me about any post │  │
│        ● Reactions       🔊› │     │  │ ────────────────────────── │  │
│  ┌────────────────────────┐ │     │  │ ● Mornings  ● Flourishing  │  │
│  │ Ask Iris about the web…│ │     │  │ …answer streams here…      │  │
│  └────────────────────────┘ │     │  └────────────────────────────┘  │
└──────────────────────────────┘     │  [ type a question…        ▸ ]   │
                                      └──────────────────────────────────┘
```
- **Tradeoffs:** the only direction that truly delivers on the panel's name and showcases the Iris/voice/soundtrack story. Highest build + scope cost, and an inline chat on the homepage competes with the global ⌘K Iris — needs care so it doesn't feel redundant. Best as a phase-2 after A.

**Recommendation for #52: ship Direction A now**, fold in B's per-post accent-tinted glow as a small enhancement (it's cheap and unique), and hold C as the aspirational follow-up. A gets the glass+glow port done with minimal risk while finally giving the panel an Iris affordance, which is the actual content gap.

---

# Ticket #54 — Projects card: surface mikeveson.com subsidiaries

### The data-model question (visual recommendation)
Mike's open question: nested sub-items **vs** separate project items linked by tags/reference-ids. **Visual recommendation: nested, presented inline — but make each nested item *promotable* to its own clickable destination.** Reasoning from a UX lens:
- Subsidiaries (Blog, Iris, THE HARLEQUIN, Spotify timeline, Deep Mode, Voice) are *features of one product*, not peer projects. Listing them as 6 top-level project cards would bury the actual portfolio (HiLiTe, Euros, Apollo) and make the Projects section read like a changelog.
- But several subsidiaries *do* have real destinations (Blog → `/the-web`, Iris → ⌘K, HARLEQUIN → `/dev` portal). So model them as **nested entries that each carry an optional `link`/`ref`** — rendered in-card, but a click navigates or deep-links. Best of both: organized under the parent, still individually reachable. This maps cleanly onto the existing `proj_portfolio.specifics[]` data if it's restructured into `{name, blurb, link?}` objects (the data agent owns that; the UI just needs name + blurb + optional link).

### Direction A — "Expandable subsidiaries drawer" (recommended)
Below the description/skills, add a collapsed strip: `┌ Inside mikeveson.com · 6 features ────── Show ▾`. Clicking expands a 2-col grid of compact subsidiary tiles *inside the same indigo glass card*, animated with a Framer Motion height/opacity reveal (the site already uses `ExpandableSection`). Each tile = name + one-line blurb + `ChevronRight` if it links. Keeps the Projects section tidy by default; power-users open it.

```
COLLAPSED                                   EXPANDED
┌────────────────────────────────────────┐ ┌────────────────────────────────────────┐
│ [img]  mikeveson.com         ⌘K  ⌾  ↗ │ │ [img]  mikeveson.com         ⌘K  ⌾  ↗ │
│        A living personal site…         │ │        A living personal site…         │
│        [next.js][react][ai]…           │ │        [next.js][react][ai]…           │
│ ┌────────────────────────────────────┐ │ │ ── INSIDE MIKEVESON.COM ─────── Hide ▴ │
│ │ Inside mikeveson.com · 6   Show ▾ │ │ │ ┌──────────────┐ ┌──────────────┐     │
│ └────────────────────────────────────┘ │ │ │ Iris         ›│ │ The Web      ›│     │
└────────────────────────────────────────┘ │ │ AI assistant │ │ blog + voice │     │
                                            │ └──────────────┘ └──────────────┘     │
                                            │ ┌──────────────┐ ┌──────────────┐     │
                                            │ │ Spotify line │ │ Deep Mode    │     │
                                            │ │ 4yr bursts   │ │ hidden layer │     │
                                            │ └──────────────┘ └──────────────┘     │
                                            └────────────────────────────────────────┘
```
- **Tradeoffs:** no extra height when collapsed (solves "cramped"), reuses `ExpandableSection`, and the indigo glow already on the card extends naturally over the tiles. Subsidiaries that link (Iris/Web/HARLEQUIN) get a chevron; the rest are just informative. Only downside: one extra click to discover the depth — mitigate with the count ("· 6 features") so the value is advertised even when collapsed.

### Direction B — "Horizontal subsidiary rail"
Keep subsidiaries always-visible as a single horizontally-scrollable row of chips/mini-cards under the skills, with a fade-mask on the right edge to signal more. No expand needed.

```
┌──────────────────────────────────────────────────────────┐
│ [img]  mikeveson.com                          ⌘K  ⌾  ↗  │
│        A living personal site…    [next.js][react][ai]   │
│  ── BUILT FROM ──────────────────────────────────────    │
│  ◀ [Iris ›][The Web ›][HARLEQUIN ›][Spotify][Voice][Deep ▒│ ← scroll, right-fade
└──────────────────────────────────────────────────────────┘
```
- **Tradeoffs:** zero-click discovery, feels modern, but horizontal scroll inside a clickable card is fiddly (the card itself is a link — must `stopPropagation` and the rail competes with vertical page scroll on trackpads). Works better on desktop than touch. Good if Mike wants subsidiaries *seen*, not hidden.

### Direction C — "Linked sibling cards via reference tags"
Render subsidiaries as the nested drawer (Dir. A) for *display*, but each tile is a `ref-id` link that smooth-scrolls/filters to a real sibling entry. This is the "separate items linked by reference-ids" model made visual: the parent card is the index, the children are real anchored destinations.
- **Tradeoffs:** most flexible long-term and great for Iris (each subsidiary becomes a first-class KB item it can deep-link), but it's the heaviest data/routing change and risks the changelog-bloat problem if those siblings ever render as full cards. Recommend only if subsidiaries grow beyond ~8 and start deserving their own pages.

**Recommendation for #54: Direction A (expandable nested drawer).** It directly fixes "too limiting / cramped," reuses `ExpandableSection` + the card's existing indigo glow, keeps the Projects section scannable, and the optional-link-per-tile satisfies Mike's "clickable" instinct without the bloat of promoting six features to top-level cards. Model subsidiaries as **nested objects with an optional link**, not separate project entries — revisit C only if the list outgrows the drawer.

---

## Responsive notes (both tickets)
- **Glow:** `ContainedMouseGlow` already returns `null` on touch — no mobile glow work needed; the frosted glass + web pattern carry the look on phones.
- **#52:** on mobile (`md:hidden` path) the panel renders in `ExpandableSection` with `initialCount={2}`; keep the glass but drop the per-post hover-reveal blurbs (no hover on touch) — show the 🔊/accent-dot statically instead. IrisBubble already has a mobile bottom-sheet variant if Direction C is pursued.
- **#54:** Direction A's 2-col tile grid collapses to 1-col under `md`. Direction B's rail is acceptable on touch (native momentum scroll) but Direction A is safer. The card is itself a link, so every interactive child (expand toggle, subsidiary tiles) must `e.stopPropagation()` — the existing card already does this for its GitHub/Iris buttons; follow that pattern.
- **Motion/a11y:** reuse the existing `iris-hud-enter` / Framer fade-up; respect reduced-motion (the expand should still work, just without the height tween). Keep visible keyboard focus on the new expand toggle and subsidiary links — the cards are already `tabIndex={0}` role=link, so nested interactive elements need their own focus rings.

## Files referenced (absolute)
- `src/components/iris/IrisBubble.tsx` — the "Seer" glass shell (port source)
- `src/components/ContainedMouseGlow.tsx` — contained glow technique
- `src/components/base_card.tsx` — Projects card wrapper (glow + glass-hover)
- `src/app/projects/project_card.tsx` — #54 target
- `src/app/blogs/the_web_card.tsx` — #52 target ("Blog Iris panel")
- `src/app/blogs/blog_card.tsx` — sibling pattern (divider, eyebrow, chevron)
- `src/components/ExpandableSection.tsx` — reuse for #54 drawer / #52 mobile
- `src/components/ContainedWebPattern.tsx` — spider-web reveal (keep under glass for #52)
- `src/data/iris/kb/projects.json` — `proj_portfolio.specifics[]` = subsidiary source data
- `src/app/page.tsx` — home composition (accent-by-section, deep-mode wiring)
