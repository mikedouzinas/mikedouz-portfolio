# Ticket #74 — Internship "Moments" — Design Directions

**Status:** exploration / overnight draft. No code written.
**Ticket (L):** Homepage section surfacing short, edit-style "moments" from each
experience — a small visual/audio window into what each one *felt* like. Should
read like a reel or a memory, not a portfolio slide.

> **Source-material note (updated):** real source material exists. A survey of
> Mike's private notes confirms there is genuine per-experience narrative and
> emotional texture to draw on, and — crucially — an existing, sizable
> *song-per-moment* record: a living timeline that already associates specific
> tracks with specific life-moments going back several years. So the **audio half
> of every moment is well-sourced**: most experiences already have an authentic,
> Mike-chosen song with a real memory attached (one experience even has an
> explicit "this was the song I drove to work to that summer"). The shape of the
> material, at a high level: rich written context, strong music associations,
> distinct moods per experience, and a couple of natural through-lines (a
> maritime thread across the shipping-adjacent roles; a recurring "prove it fast"
> instinct; an introspective founder/mission register that contrasts the rest).
>
> The **photo/video half is the gap**: there are essentially no curated personal
> stills or clips per experience in the source material yet, so Mike will need to
> supply one image (or a short clip) per experience. This makes the realistic
> content budget "one good image + one real track per experience," which the
> recommended direction is built around.
>
> (Specifics, song titles, and file paths live only in the external private file
> `_overnight_private/vault-notes/moments-material.md`, outside this repo. Nothing
> private appears in this committed doc.)

---

## Design goals (what makes a "moment" not a "slide")

1. **Felt, not summarized.** A moment leads with image/mood, not bullet points.
   The résumé facts already live elsewhere on the site.
2. **Quiet by default, rich on intent.** Nothing autoplays. Audio and motion are
   opt-in. The section should be calm at rest and only "open up" when invited.
3. **One per experience.** A tight set (5–6) of distinct vignettes, each with its
   own accent and mood, beats one busy carousel.
4. **Consistent with the existing system.** Reuse the mouse-glow + accent-color
   language already used for project/blog/experience cards
   (`ContainedMouseGlow`, accent as `"R, G, B"`).

---

## Direction A — "Hover-to-breathe" tiles (subtle, in-place)

A horizontal row of one tile per experience. At rest each tile is a single
evocative still + the company name, dimmed and calm. On hover (desktop) the tile
"breathes": the still cross-dissolves through 2–4 frames, the accent glow warms,
and a small speaker chip appears offering opt-in ambient audio. On touch, tap to
expand in place instead of hover.

```
  MOMENTS
  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
  │ [still]│ │ [still]│ │ [still]│ │ [still]│ │ [still]│
  │        │ │        │ │        │ │        │ │        │
  │ exp 1  │ │ exp 2  │ │ exp 3  │ │ exp 4  │ │ exp 5  │
  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
        hover ▲
  ┌──────────────────┐
  │  [frame 2/4]   ♪ │   ← glow warms, ♪ = opt-in audio chip
  │  one-line mood   │
  └──────────────────┘
```

- **Pros:** lowest-risk, smallest footprint, reuses the card+glow system almost
  as-is. Degrades gracefully with zero media (just stills). Fast.
- **Cons:** "reel/memory" feeling is muted — it's still card-shaped. Limited room
  for a real montage.
- **Best when:** media is sparse (one good still per experience) and Mike wants
  the section to stay understated.

---

## Direction B — "Reel strip" (dedicated section, scroll-driven)

A dedicated full-width band below the hero. Each experience is a tall panel you
scroll through; as a panel enters the viewport its short looping montage plays
(muted), the accent gradient fills behind it, and a one-line caption rises. A
single global, persistent audio toggle (off by default) in the section corner;
when on, each panel fades its own track in/out as it becomes the focused panel.
Reduced-motion users get a static hero still per panel.

```
 ╔═══════════════════════════════════════════════╗  ◄ dedicated section
 ║  M O M E N T S                      [ ♪ off ]  ║   global opt-in audio
 ╠═══════════════════════════════════════════════╣
 ║   ┌─────────────────────────────┐             ║
 ║   │  ▷ looping montage (muted)  │   exp 1     ║  ← in view → plays
 ║   │     accent gradient bg      │   "mood"    ║
 ║   └─────────────────────────────┘             ║
 ║   · · · · · scroll · · · · · ↓                ║
 ║   ┌─────────────────────────────┐             ║
 ║   │  ◌ paused until in view      │   exp 2     ║
 ║   └─────────────────────────────┘             ║
 ╚═══════════════════════════════════════════════╝
```

- **Pros:** strongest "reel/memory" feel; gives montage + track room to breathe;
  scroll-into-view is a natural, non-intrusive autoplay-of-motion trigger (still
  silent until the user opts into audio).
- **Cons:** most build + most media-hungry (needs a real montage per experience);
  bigger perf/accessibility surface (IntersectionObserver, reduced-motion, video
  decoding); risks competing with the hero for attention.
- **Best when:** Mike has genuine montage material per experience and wants
  moments to be a headline part of the page.

---

## Direction C — "One image, one track" memory cards (the middle path) — RECOMMENDED

Each experience = a single deliberately-chosen still + a single short associated
track. At rest: still + company name + accent glow. Click/tap (one clear
affordance, not hover) expands the card into a focused "memory" overlay: the
still with a soft Ken-Burns drift, a one-line mood caption, and a small play
control for that one track. Audio is strictly opt-in (the overlay opens silent;
press play to hear it). Closing returns you to the row. No looping video required.

```
  MOMENTS                              (row, calm at rest)
  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
  │ exp1 │ │ exp2 │ │ exp3 │ │ exp4 │ │ exp5 │
  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘
            click ▼
   ╔════════════════════════════════════╗
   ║   [ still, slow drift ]            ║  ← focused "memory"
   ║                                    ║
   ║   "one-line mood"                  ║
   ║   ▶ play  ──○────────  0:00   ✕    ║  ← opt-in single track
   ╚════════════════════════════════════╝
```

- **Pros:** captures the memory feeling with the *least* media (one image + one
  song per experience is realistically obtainable); clean opt-in audio with no
  autoplay; reuses accent/glow; degrades to plain expandable cards if a track or
  image is missing for some experience. Good accessibility story (motion is the
  gentle drift only; respect `prefers-reduced-motion`).
- **Cons:** less kinetic than B; one still can't tell as layered a story as a
  montage.
- **Why recommended:** it matches the realistic content budget. The audio side is
  already there (each experience has a real, Mike-chosen track with a memory
  behind it), but curated per-experience photos/clips don't exist yet — so
  anything requiring full montages would block the feature on media Mike still has
  to gather. "One evocative image + one real track" is exactly the option the
  ticket calls out, ships now on the material that exists, and is the safest fit
  with the existing design system. Direction B is the upgrade path once real
  montage footage per experience exists.

---

## Cross-cutting decisions (apply to whichever direction)

### Audio UX (non-negotiables)
- **Never autoplay sound.** Motion may start on view/hover; sound only after an
  explicit user gesture.
- One obvious, persistent **mute/stop** affordance whenever audio can play.
- Only one track audible at a time; switching focus fades the previous out.
- Honor `prefers-reduced-motion` (disable drift/montage, keep stills) and provide
  a visible caption so the moment still "reads" with audio off.
- Keep clips short (a few seconds) and lazy-loaded so the homepage stays light.

### Media storage
- Treat the portfolio repo as public: **do not commit personal photos/audio into
  git.** Store media in the existing managed backends instead — images/audio in a
  bucket (Supabase Storage, mirroring how blog/Spotify media is already handled)
  and reference by URL, the same pattern the blog uses for per-post media.
- A small manifest (one entry per experience: image URL, optional track URL,
  one-line mood, accent `"R,G,B"`) can live alongside the existing KB so Iris and
  the homepage stay in sync — consistent with the "keep `proj_portfolio` / KB
  updated when shipping a feature" rule.
- Provide graceful fallbacks: missing track → card without audio; missing image →
  accent-gradient placeholder. The section must never look broken because one
  experience lacks media.

### Prominence
- Start subtle (Direction A/C, a row that lives between hero and the project
  grid). Promote to a dedicated band (Direction B) only once the content earns
  the real estate.

---

## Recommendation summary

Ship **Direction C** first (one image + one optional track per experience,
click-to-expand memory card, opt-in audio, bucket-stored media, KB-synced
manifest). It's the best ratio of "feels like a memory" to build cost and content
cost, and it cleanly upgrades into **Direction B** later if montage material
becomes available. Direction A is the minimal fallback if even single stills are
scarce.

---

## About-me idea directions (high-level, for Mike to consider)

Inspired by surveying how the site presents Mike today (very capability- and
project-forward) versus the much more personal, reflective register that exists
in his own notes (a self-knowledge / Olympus voice, and a striking habit of
remembering his life through *music* — specific songs tied to specific seasons).
None of these require disclosing any private detail; they're framing directions.

1. **Music as the spine of the personal story.** The single most authentic and
   already-existing thread is song-per-moment: Mike genuinely experiences his own
   life as a soundtrack, with a real track attached to each season. That's a
   distinctive, ownable organizing idea for "about me" — far more him than a bio
   paragraph. #74 is the first beat; the homepage could lean into music as the
   connective tissue of the whole personal layer.

2. **A thin "story" spine, not just a grid.** The site is strong at *what* Mike
   built; it's lighter on *the through-line* — the maritime/shipping thread across
   the early roles, the "prove it fast" instinct, the pull toward helping people
   flourish. A short, honestly-written narrative alongside the work would make the
   portfolio feel authored rather than catalogued.

3. **Let the mission voice show, carefully.** The introspective Olympus framing is
   the most distinctive thing about Mike and currently lives mostly inside Iris
   and his essays. A small, tasteful "why I build" surface on the homepage — one
   or two sentences in his own voice — would differentiate the site from a
   standard SWE portfolio without turning it into a manifesto.

4. **Consistent personal motifs as connective tissue.** Reuse one or two recurring
   visual motifs (the accent-glow language already in the system; a water/horizon
   motif tied to the maritime years) so the personal sections feel of-a-piece with
   the rest of the site rather than bolted on.

5. **Make Iris the guided-tour host of the personal side.** Iris already answers
   "tell me about Mike," and a music→moment data pipeline already feeds the site.
   A gentle prompt ("ask about a moment", "what was X like?", "what was on repeat
   that summer?") that ties moments + music into Iris would let visitors explore
   the personal material conversationally — playing to the site's strongest,
   most unique component.

6. **Time + place as a quiet organizing idea.** The experiences naturally form a
   timeline across cities/years. A light chronological framing (without dates
   dominating) gives visitors a sense of trajectory — where Mike has been
   heading — which is exactly the register an "about me" wants, versus a flat list.

_These are directions, not commitments — each can be adopted independently and at
whatever level of personal disclosure Mike is comfortable with._
