# CLAUDE.md

**Project**: mikeveson.com — portfolio, Iris AI assistant, and "the web" blog
**Stack**: Next.js 16 (App Router), React 19, TypeScript, Anthropic Claude Sonnet 4.6, Upstash Redis, Supabase, Resend
**Last updated**: 2026-06-19

> Lint: `next lint` was removed in Next 16. `npm run lint` runs ESLint directly (`eslint .`) against the flat `eslint.config.mjs` (native `eslint-config-next` flat configs). `next build` does NOT run ESLint — run `npm run lint` separately.

---

## Scripts

```bash
npm run dev              # Dev server (⌘K opens Iris)
npm run build            # Production build
npm run kb:rebuild       # verify:kb + build:typeahead + build:rankings (no embeddings step)
npm run verify:kb        # Zod-validate KB files
npm run test:iris        # 80+ case interactive test suite
npm run lint
```

No embeddings pipeline exists. Iris loads the full KB into a prompt-cached system prompt per request.

---

## Commit conventions

**Keep commits feature-scoped — one logical change per commit.** Each commit should capture exactly one thing (a single feature, fix, or refactor) so the history reads as a clear list of what was done. Don't bundle unrelated changes into one commit; split them. When a task produces several distinct changes, make several commits. Subject line states the one thing the commit does.

---

## Directory map

```
src/
├── app/
│   ├── api/iris/{answer,suggest,health}/   # Iris endpoints
│   ├── api/inbox/                          # "Ask Mike" contact API
│   ├── api/the-web/                        # Blog list + [slug]
│   ├── admin/inbox/                        # Admin dashboard
│   └── the-web/                            # Blog stream + post pages
├── components/iris/                        # MessageComposer, QuickActions, useUiDirectives
├── lib/iris/
│   ├── config.ts                           # Models, toggles, budgets
│   ├── schema.ts                           # Zod schemas + KB types
│   ├── load.ts                             # KB loaders (full KB → Claude context)
│   ├── answer-utils/filters.ts             # applyFilters() for filter_query intent
│   ├── quickActions_v2.ts + actionConfig.ts + rankings.ts
│   └── cache.ts                            # Redis response cache (1h TTL)
└── data/iris/kb/                           # profile, projects, experience, classes,
                                            # skills (851 entries), blogs, contact
```

---

## Iris architecture (important)

Single streaming Claude Sonnet 4.6 call. No separate intent step, no retrieval, no embeddings.

```
Query → full-KB system prompt (cached) → Claude
         ├── classify_query tool → intent + filter params
         └── streamed answer
       → SSE
```

Main endpoint: `src/app/api/iris/answer/route.ts` (~820 lines).

**Intents**: `contact` (static fast-path), `filter_query` (uses `applyFilters`), `specific_item`, `personal`, `general`, `github_activity`.

**Removed in Claude migration** (don't look for these): `retrieval.ts`, `embedding.ts`, `intents.ts`, `planning.ts`, `aliases.ts`.

### Link policy
Quick actions render all links (GitHub, demo, LinkedIn, company). The system prompt forbids Iris from emitting raw URLs in response text — reference resources by name only ("the code is on GitHub"). Don't weaken this.

### UI directives
Iris emits `<ui:contact reason="..." draft="..." />` mid-stream. Parser: `src/components/iris/useUiDirectives.ts`.

---

## KB conventions (non-negotiable)

- **Use skill IDs, never display names.** `react` not `React`, `machine_learning` not `Machine Learning`. `formatSkillId()` handles display.
- **After KB edits**: `npm run verify:kb && npm run kb:rebuild`. No embeddings rebuild.
- **When shipping a new site feature**, update the `proj_portfolio` entry in `projects.json` specifics so Iris knows about it. This is the rule Mike has reiterated — `feedback_keep_kb_updated.md`.
- KB items carry `skills[]`, `dates`, `specifics[]`. Schema in `src/lib/iris/schema.ts`.

---

## Quick Actions v2

Config-driven follow-ups after every Iris answer. Templates per KB type live in `actionConfig.ts`; importance scores (0–100) in `rankings.ts` control ordering and which skills/items surface.

Five action types: `link`, `dropdown`, `query`, `message_mike`, `custom_input`.

Depth limiting: specific drill-downs stop at depth 2; generic "Ask a follow up…" continues to depth 4; contact actions always available.

---

## The Web (blog)

Supabase-backed, not git-backed. Posts in `blog_posts` table with weighted tsvector search and per-post `theme` JSONB (notably `accent_color` as `"R, G, B"` string driving card glow).

Admin writes require `x-admin-key: $ADMIN_API_KEY`.

```bash
# Publish
curl -X POST http://localhost:3000/api/the-web \
  -H "Content-Type: application/json" -H "x-admin-key: $ADMIN_API_KEY" \
  -d '{"title":"...","slug":"...","body":"...","tags":["..."],"status":"published","theme":{"accent_color":"168, 85, 247"}}'

# Update
curl -X PUT http://localhost:3000/api/the-web/<slug> \
  -H "Content-Type: application/json" -H "x-admin-key: $ADMIN_API_KEY" \
  -d '{"title":"...","body":"..."}'
```

Homepage blog cards read from `src/data/iris/kb/blogs.json` (separate from the Supabase posts table — keep in sync when promoting a post to the homepage).

Per-post Spotify: on publish, recent Spotify listening history is associated with the post and surfaced on `/the-web/[slug]`. ElevenLabs voice playback has Safari iOS background-audio support via MediaSession.

Common tags: `ethics`, `technology`, `philosophy`, `flourishing`, `relationships`, `rice`, `research`, `reactions`, `tree-of-human-flourishing`.

---

## Mouse glow

```tsx
<div className="relative overflow-hidden" data-has-contained-glow="true">
  <ContainedMouseGlow color="147, 197, 253" intensity={0.4} />
</div>
```

Auto-disabled on touch.

**Accent-by-area (actual code mapping, RGB strings):**
- Projects = indigo `99, 102, 241` (`project_card.tsx`)
- Blogs / "the web" = teal `45, 212, 191` (`blog_card.tsx`, `the_web_card.tsx`, `WebBanner.tsx`)
- Experience = default light blue `147, 197, 253` (BaseCard default; experience cards pass no `glowColor`)
- In-progress card = green `34, 197, 94` (`InProgressCard.tsx`)
- Iris bubble tones = teal `45, 212, 191` / champagne `231, 226, 212` (`IrisBubble.tsx`); Iris composer/CTA = light blue `147, 197, 253`
- `/dev` (HARLEQUIN) = champagne `231, 226, 212`

`ContainedMouseGlow` default color is `147, 197, 253` (light blue).

> Note: an earlier version of this doc claimed purple/blue accents. The code uses the mapping above (teal/indigo/green/champagne). If purple/blue was the intended design, that's a separate design change for Mike — code colors were not modified.

---

## Environment

Required: `ANTHROPIC_API_KEY`.
Optional but assumed in prod: `UPSTASH_REDIS_REST_{URL,TOKEN}`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ADMIN_API_KEY`, `GITHUB_TOKEN`.
`OPENAI_API_KEY` is used *only* for blog-Iris draft generation — the main Iris assistant is Claude-only.

---

## Gotchas

- **Redis caches Iris responses for 1 hour keyed on normalized query.** If a KB change doesn't seem to land, either modify the query slightly or hit `POST /api/iris/cache/clear`.
- **Intent is a Claude tool call, not a separate step.** To add an intent, extend the `classify_query` enum in `answer/route.ts` and add a branch after the tool result.
- **System prompt's anti-hallucination rules are load-bearing.** Don't soften them.
- **TypeScript strict mode, no `any`.** Zod at all boundaries.

---

## Related projects (separate repos)

- **Apollo × freewrite** — fork of farzaa/freewrite with in-platform Claude Code chat and a "Process" button that files sessions into a vault via Claude Code. Repo: `github.com/mikedouzinas/apollo`.
- **Iris Mobile (Swift)** — native iOS fork of Claude Code, Swift port. Background audio for vault files. Lives at `~/Downloads/Dev/iris-mobile/`.

Ascent to Olympus game is archived; don't develop further.

---

## References

- `README.md` — public-facing docs
- `TESTING.md` — full test matrix
- `src/lib/iris/schema.ts` — authoritative types
- `src/app/api/iris/answer/route.ts` — where everything happens
