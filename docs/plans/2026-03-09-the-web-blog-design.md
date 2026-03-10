# The Web — Blog System Design

**Date:** 2026-03-09
**Status:** Approved

## Concept

"The Web" is a blog/thinking stream on mikeveson.com where Mike publishes research, philosophical analysis, personal reactions, and ideas. One chronological stream. Everything lives together, tagged and searchable. The aesthetic is "raw Iron Man" — sophisticated tech, informal energy, unmistakably Mike Veson.

The name plays on the double meaning: a web of connected thinking that lives on the web.

## Content Examples (First Posts)

- CRP on dirty data / NuHire bias + how Rice contradicts its own teaching
- De Botton full interview analysis on love as skill
- De Botton first date questions analysis + personal reactions
- Tree of Human Flourishing research documents

## Architecture

### Data Layer

**Supabase `posts` table:**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key, auto-generated |
| slug | text | URL-friendly, unique |
| title | text | Required |
| subtitle | text | Optional |
| body | text | Markdown content |
| tags | text[] | Array of tag strings |
| published_at | timestamptz | When published |
| updated_at | timestamptz | Auto-updated |
| status | text | 'draft' or 'published' |
| reading_time | int | Minutes, calculated on publish |
| cover_image | text | Optional URL |
| images | jsonb | Array of image URLs/metadata used in body |

### Pages

**`/blog`** — The Stream
- All published posts, newest first
- Tag filter bar (click to filter, click again to remove)
- Search bar (text search across title + body)
- Post cards: title, subtitle, date, tags, reading time, preview text
- Purple/blue glow cards matching site aesthetic
- Framer Motion transitions on filter/navigation

**`/blog/[slug]`** — Post Page
- Full markdown rendered (headers, code blocks, quotes, links, images)
- Tags linked (click to go to /blog filtered by that tag)
- Reading time displayed
- Share/copy link button
- Next/Previous post navigation
- Clean reading experience with subtle site-native glow accents

### API Endpoints

**`POST /api/blog/publish`** (protected)
- Accepts: title, subtitle, body (markdown), tags, slug, cover_image, images
- Calculates reading time
- Stores in Supabase
- Returns published post data
- Protected by admin API key (same pattern as inbox)

**`GET /api/blog/posts`** (public)
- Query params: tag, search, limit, offset
- Returns published posts (newest first)
- Supports pagination

**`GET /api/blog/posts/[slug]`** (public)
- Returns single post by slug

**`PUT /api/blog/posts/[slug]`** (protected)
- Update existing post

### Image Handling

Images referenced in markdown posts. Two approaches:
1. External URLs (already hosted images, e.g., vault images uploaded to Supabase Storage or similar)
2. Supabase Storage bucket for blog images, uploaded via publish API

Markdown image syntax renders in post pages with proper sizing and alt text.

## Publishing Workflow

### Custom Claude Code Skill: `/publish`

1. Mike says "/publish" or "publish this" and points to a vault file
2. Iris reads the vault markdown file
3. Iris adapts content for public audience (strips overly personal context, formats for web)
4. Iris presents the public version for Mike to review
5. Mike approves, adds/confirms tags and title
6. Iris generates slug from title
7. Iris calls the protected publish API endpoint
8. Post is live immediately (SSR from Supabase, no rebuild needed)
9. Iris updates the site's knowledge base (blogs.json + embeddings) for Iris chat integration

### Update Flow

Same skill handles updates. Mike says "update [post name]" and Iris fetches current version, applies changes, pushes update.

## Visual Design Direction

- Card glows: purple/blue, matching existing Media section
- Post page: generous whitespace, clean typography, subtle glow accents
- Tag chips: small, muted color coding, interactive
- Header area: informal, no corporate "BLOG" branding. "The Web" with personality.
- Responsive: mobile-first, clean reading on any device
- Framer Motion: smooth filter transitions, page transitions, card hover effects
- Images: full-width or inline, with subtle border/shadow treatment

## Essential Features

- [x] Tag filtering
- [x] Text search
- [x] Reading time (calculated on publish)
- [x] Full markdown rendering (including images)
- [x] Share/copy link
- [x] Responsive design
- [x] Iris KB integration (posts searchable via site Iris)

## Intentionally Excluded (For Now)

- Comments (use inbox/contact instead)
- RSS feed (add later if wanted)
- Per-post analytics (Vercel handles page views)
- Newsletter/subscribe (planned for later)

## Tech Stack Integration

- Next.js 15 App Router (new route group)
- Supabase (already configured, add posts table + storage bucket)
- Framer Motion (already installed)
- Tailwind CSS (already installed)
- react-markdown or next-mdx-remote for rendering
- Admin API key auth (same pattern as existing inbox API)
