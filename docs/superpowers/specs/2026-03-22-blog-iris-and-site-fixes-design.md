# Blog Iris Interaction System + Site Fixes

**Date:** 2026-03-22
**Status:** Approved
**Origin:** Conversation with Nico Bers (March 20, 2026) + sidebar overflow discovery

---

## Overview

Three features in one spec:

1. **Blog Iris Interaction System** — highlight text on blog posts, converse with Iris, leave comments or message Mike
2. **Sidebar Overflow Fix** — prevent Spotify bubble from pushing social icons off screen on short viewports
3. **Spotify Panel Glassmorphic Redesign** — Studio Green glassmorphic background replacing the current flat `#1a1a2e`

---

## Feature 1: Blog Iris Interaction System

### Core Loop

1. **Reader highlights text** on a `/the-web/[slug]` blog post
2. **Iris bubble popup** appears to the right of the highlighted text (desktop) or slides up as a bottom sheet (mobile)
3. **Reader types first** — placeholder says "Questions or comments...", no Iris greeting
4. **Iris responds** using: (a) the blog post content, (b) per-post context document if one exists, (c) curated vault notes
5. **After conversation**, Iris surfaces two quick action pills:
   - "Leave a comment" (MessageSquare icon, `from-blue-500 to-indigo-600` gradient)
   - "Message Mike" (Send icon, `from-sky-500 to-indigo-600` gradient)
6. **Both paths**: Iris drafts with fun rotating loading messages → editable draft appears
7. Reader edits draft and submits

### Highlight + Bubble UX

**Trigger:** Listen to `document` `selectionchange` event. On each fire, call `document.getSelection()` and check whether the selection's `anchorNode` is contained within the post body element (identified by a `data-post-body` attribute or a React ref). Only show the bubble if: (a) selection is non-empty, (b) anchor is within the post body container, (c) no bubble is already open with an active conversation.

**Bubble position (desktop):** Floating popup to the right of the highlighted text.
- Use `Selection.getRangeAt(0).getBoundingClientRect()` for viewport-relative coords, then add `window.scrollY` for page-relative positioning
- Position the bubble relative to the post body container (which is the `offsetParent`)
- If the bubble would overflow the right edge of the viewport, position it to the left of the selection instead
- Width: 280-300px fixed
- `border-radius: 16px` (bubbly, not rectangular)
- Glassmorphic: `background: rgba(15,23,42,0.9)`, `backdrop-filter: blur(40px)`, `border: 1px solid rgba(255,255,255,0.12)`
- Box shadow: `0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)`

**Bubble close behavior:**
- Click outside the bubble: closes if no conversation has started; if conversation is in progress, show a subtle "discard?" confirmation
- Escape key: always closes (discards conversation)
- Selection cleared (by clicking elsewhere): same as click outside
- Navigate away: conversation state is lost (no persistence)
- On close, blog content opacity returns to 100%

**Bubble position (mobile):** Bottom sheet sliding up from the bottom of the viewport. Same glassmorphic styling.
- Drag handle at top (8px wide, 4px tall, rounded, `bg-white/20`)
- Dismiss threshold: drag down >100px or swipe velocity >500px/s
- Use `touch-action: none` on the sheet and manually handle touch events to avoid conflict with browser pull-to-refresh
- On dismiss while conversation is active: same discard confirmation as desktop

**Bubble contents:**
- Collapsed passage reference (italic, truncated with ellipsis if long, max 2 lines)
- Input field: "Questions or comments..." placeholder
- Return button: circular, Iris gradient (`from-blue-500 to-emerald-500`), centered SVG return arrow icon (properly centered using flexbox, not text alignment)

**When user submits:** User message appears right-aligned with `background: rgba(255,255,255,0.07)`, `border-radius: 12px 12px 4px 12px`. Iris responds below in plain text matching cmd+K Iris response styling. Blog content behind the bubble fades to ~35% opacity.

### Quick Action Pills

Appear after Iris responds, horizontally laid out. These are **new components specific to the blog Iris bubble**, not rendered through the existing `QuickActions.tsx` (which has different action types and cancel behavior). They follow the same visual design language:

- `rounded-xl`, `px-3 py-1.5`, `text-xs sm:text-sm font-medium`, gradient backgrounds, white text
- "Leave a comment": MessageSquare icon (Lucide), `bg-gradient-to-r from-blue-500 to-indigo-600`
- "Message Mike": Send icon (Lucide), `bg-gradient-to-r from-sky-500 to-indigo-600`
- Hover: `scale-105` transition
- Below the pills: reply input remains available for continued conversation
- **No X/cancel on either pill** — this is intentional for the blog context (both paths lead to editable drafts the user controls, so cancel at the draft stage is sufficient via not posting)

### "Leave a Comment" Path

**On click:** Pill stays visible but dimmed (`opacity: 0.7`). No X/cancel button — committed.

**Loading state:**
- Fun rotating loading messages from a **curated blog-specific pool** (new file: `src/app/the-web/lib/loadingMessages.ts`). Messages should be lowercase sentence fragments matching the WebLoader tone ("weaving thoughts together...", "spinning up the web...", "pulling threads..."). Do NOT mix in the Iris messages verbatim (different tone/casing).
- Messages rotate every 3 seconds with fade animation (matching WebLoader pattern: `AnimatePresence mode="wait"`, `opacity` + `y` transitions)
- Three-dot pulsing indicator in Iris green (`#10b981`)

**Draft generation:**
- A second call to `POST /api/the-web/[slug]/iris` with a `mode: "draft_comment"` field
- The system prompt instructs: "Based on the conversation, draft a concise public comment (1-3 sentences) that captures the reader's main point. Write in the reader's voice, not yours."
- Response is a plain text string (not streamed), returned as JSON `{ "draft": "..." }`
- If the draft is shorter than 10 characters, pad with the reader's original message instead

**Draft appears:**
- Passage reference: italic text with `border-left: 2px solid rgba(59,130,246,0.3)`, prefixed "Re: "
- Editable textarea: `background: rgba(0,0,0,0.3)`, `border: 1px solid rgba(255,255,255,0.08)`, `border-radius: 10px`
- Name field: optional, `font-size: 10px`. If empty, defaults to "Anonymous" on submit.
- Email field: optional, `font-size: 10px`
- "or post anonymous" note in muted text
- **Post button:** no icon, just "Post" text. `background: linear-gradient(135deg, #3b82f6, #10b981)`, `border-radius: 10px`, `padding: 6px 14px`

**On submit:** Comment saved via `/api/the-web/[slug]/comments` endpoint (requires schema changes, see DB Changes section). Comment appears at bottom of post with italic passage reference above it.

**Error handling:** If the draft generation call fails (429, 500, network), show "Couldn't generate a draft — you can write your own below" and present the empty comment form with the reader's original message pre-filled as a starting point.

### "Message Mike" Path

**On click:** Pill stays visible but dimmed. No X/cancel button — committed.

**Loading + draft:** Same glassmorphic Iris bubble. Same loading messages pattern.

**Draft generation:**
- Same endpoint `POST /api/the-web/[slug]/iris` with `mode: "draft_message"`
- System prompt: "Draft a direct message to Mike about this conversation. Include context about which post and passage sparked the discussion. Write in the reader's voice, conversational tone."
- Returns JSON `{ "draft": "..." }`

**Draft contents:**
- Passage reference: italic text with `border-left: 2px solid rgba(96,165,250,0.3)`
- Editable textarea with drafted message (more personal/direct tone than comment)
- Single contact field: "Email or phone (optional)" — auto-detects format and validates accordingly
- "Leave contact info to get a response" note in muted text
- **Send to Mike button:** no icon, just "Send to Mike" text. `background: linear-gradient(90deg, #6B4EFF, #00A8FF)`, right-aligned, `border-radius: 10px`, `padding: 6px 14px`

**On submit:** Message sent via `/api/inbox` endpoint (requires schema changes, see DB Changes section).

**Error handling:** If draft generation fails, show "Couldn't generate a draft — you can write your own below" with empty textarea. If inbox submission fails, show inline error with retry option.

### Text Limits and Validation

| Field | Min | Max | Required |
|-------|-----|-----|----------|
| Conversation input | 1 char | 500 chars | Yes (to send) |
| Comment draft | 10 chars | 1000 chars | Yes (to post) |
| Message draft | 3 chars | 500 chars | Yes (to send) |
| Name | 0 (defaults to "Anonymous") | 50 chars | No |
| Email | Valid email format | 254 chars (RFC 5321) | No |
| Phone | Valid phone (libphonenumber-js) | 15 digits (E.164) | No |
| Contact field (Message Mike) | 0 (anonymous) | 254 chars | No |

**Contact field auto-detection logic:**
- If input contains `@` → validate as email
- If input starts with `+` or is all digits/spaces/dashes → validate as phone
- Empty → anonymous (valid)
- Invalid → show inline error

### Per-Post Context Documents

Authors can attach a context document per blog post. Stored in Supabase alongside the post:

**New column on `blog_posts` table:** `iris_context TEXT` — markdown content with behind-the-scenes notes, pre-written pushback answers, misconceptions, deeper vault context.

**How Iris uses it:** When responding to a reader's question/comment about a passage, the Iris prompt includes:
1. The blog post body (truncated to first 3000 tokens if long, prioritizing the section around the highlighted passage)
2. The `iris_context` document (if present, truncated to 2000 tokens)
3. The highlighted passage (always included in full)
4. The reader's message and conversation history

**Context budget:** Total context sent to `gpt-4o-mini` should not exceed 8000 tokens (input). If post body + iris_context + history exceeds this, truncate post body first (keeping passage neighborhood), then iris_context, never truncate the passage or reader message.

**Publishing context:** Extend the existing POST/PUT API to accept an `iris_context` field. Authors write context docs alongside posts.

### Iris API for Blog

**New endpoint:** `POST /api/the-web/[slug]/iris`

Request:
```json
{
  "message": "I think this is a false binary...",
  "passage": "What matters is whether we're building...",
  "mode": "conversation",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Mode values:**
- `"conversation"` — standard Iris response, returns SSE stream
- `"draft_comment"` — generates a comment draft from conversation, returns JSON `{ "draft": "..." }`
- `"draft_message"` — generates a message draft from conversation, returns JSON `{ "draft": "..." }`

**System prompt for conversation mode:** Iris responds as Mike's advocate — informed by the post content and context doc. Can clarify, expand, push back on misreadings. Anti-hallucination rules: if the context doc doesn't cover a question, Iris acknowledges the gap and suggests messaging Mike directly. Does NOT make up Mike's opinions. Does NOT answer questions unrelated to the post or Mike's work — politely redirects ("This post is about X — if you want to ask Mike about Y, you can message him directly").

**System prompt for draft modes:** See "Draft generation" sections above.

**Rate limiting:** Same IP-based rate limiting as existing Iris endpoint. Max 20 blog Iris requests per IP per hour (across all modes).

### Comment Display

Comments at the bottom of the post. Comments with a `passage_ref` show it as an italic quote above the comment body:

```
┌─────────────────────────────────────┐
│ Re: "What matters is whether we're  │  ← italic, border-left blue
│ building tools that help people..." │
│                                     │
│ Nico B. · 2 hours ago              │
│ I think this sets up a false        │
│ binary. Tools like Instagram can... │
└─────────────────────────────────────┘
```

Comments without a passage_ref display normally (no quote block). Anonymous comments show "Anonymous" as the author name.

### Database and Schema Changes

**Migration: `blog_comments` table — add `passage_ref`:**
```sql
ALTER TABLE blog_comments ADD COLUMN passage_ref TEXT;
-- No NOT NULL constraint — passage_ref is optional (comments without highlights)
```

**Migration: `blog_posts` table — add `iris_context`:**
```sql
ALTER TABLE blog_posts ADD COLUMN iris_context TEXT;
```

**Migration: `blog_comments` — allow anonymous (update CHECK constraint):**
```sql
ALTER TABLE blog_comments DROP CONSTRAINT IF EXISTS author_name_length;
ALTER TABLE blog_comments ALTER COLUMN author_name SET DEFAULT 'Anonymous';
ALTER TABLE blog_comments ADD CONSTRAINT author_name_length CHECK (char_length(author_name) >= 1);
```
(The constraint stays at min 1 char, but the default ensures empty submissions get "Anonymous".)

**Code changes for comments (`src/lib/comments.ts`):**
- Add `passage_ref?: string` to `CreateCommentInput` and `BlogComment`
- Add `passage_ref` to `COMMENT_COLUMNS` select string
- Update `CreateCommentSchema` to accept optional `passage_ref` (string, max 500 chars)
- Default `author_name` to "Anonymous" when empty/undefined

**Code changes for inbox (`src/lib/types.ts`):**
- Add new `source` enum value: `'blog-iris'`
- Add optional fields to `InboxPayload`: `passage_ref?: string`, `post_slug?: string`, `post_title?: string`, `iris_conversation?: Array<{role: string, content: string}>`
- Update the Resend email template to include passage and post context when source is `'blog-iris'`

**Code changes for blog API (`src/lib/blog.ts`):**
- Add `iris_context?: string` to `CreateBlogPostInput` and `BlogPost`
- Include `iris_context` in `getPostBySlug()` query
- Accept `iris_context` in create/update functions

### MessageComposer Consistency Refactor

Update the existing `MessageComposer.tsx` in the Iris cmd+K palette to use the same single smart contact field pattern:
- Replace Email/Phone/Anonymous toggle with one input: "Email or phone (optional)"
- Same auto-detect validation logic
- "Leave contact info to get a response" note
- Anonymous by default
- This is a separate task but should ship alongside or shortly after the blog feature

---

## Feature 2: Sidebar Overflow Fix

### Problem

On viewports shorter than ~700px (13" laptops, iPads), the sidebar's `flex justify-between` layout causes:
- Spotify bubble overlaps with nav items above it
- Social icons (GitHub, LinkedIn, email, Calendly) pushed off screen below

### Solution: Shrink Middle, Protect Edges

**Layout strategy:** Four sections with fixed top/bottom and flexible middle.

```
┌──────────────────┐
│  Profile + Nav   │  ← flex-shrink: 0 (never shrinks)
│                  │
├──────────────────┤
│  Spotify Bubble  │  ← flex: 1, min-height: 0, overflow: hidden
│  (flexible)      │
├──────────────────┤
│ PlaygroundButton │  ← flex-shrink: 0 (never shrinks)
│  Social Icons    │
└──────────────────┘
```

Note: `PlaygroundButton` currently sits between the Spotify bubble and social icons in `sidebar_content.tsx`. It must be grouped with social icons in the bottom fixed section (both get `flex-shrink: 0`).

**Spotify adaptation:**
- When container height < collapsed bubble height: show only header bar ("Mike's Music" + expand button), hide the 3 preview songs
- Use `ResizeObserver` on the Spotify container to detect available height and conditionally render songs
- The expanded overlay (absolute positioned) is unaffected — it already floats above the layout

### Files to Modify

- `src/app/sidebar_content.tsx` — flex layout changes, group PlaygroundButton with social icons
- `src/components/spotify/SpotifyBubble.tsx` — responsive collapsed state based on container height

---

## Feature 3: Spotify Panel Glassmorphic Redesign

### Current State

Background: flat `#1a1a2e` (dark navy). Low contrast against site background. Doesn't stand out.

### New Design: Studio Green Glassmorphic

**Background:** Semi-transparent for glassmorphic effect:
- Collapsed: `background: rgba(15,31,26,0.85)` with `backdrop-filter: blur(20px)`
- Expanded overlay: `background: rgba(15,31,26,0.92)` with `backdrop-filter: blur(30px)`
- `border: 1px solid rgba(29, 185, 84, 0.2)` (subtle Spotify-adjacent green border)
- `box-shadow: 0 8px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)`

**Text colors adjusted for contrast:**
- Song titles: `#bbf7d0` (light green)
- Artist/secondary: `#86efac` (medium green)
- Muted text: `#4d8a65`
- Header "Mike's Music": `#86efac`

**Apply to both collapsed and expanded states.** Also update the sticky month label background in the expanded scroll view (currently hardcoded `#1a1a2e` at line 190 of SpotifyBubble.tsx) to match the new background.

### Files to Modify

- `src/components/spotify/SpotifyBubble.tsx` — background colors (3 locations: collapsed container line 100, expanded overlay line 164, sticky month labels line 190), border, shadow styles
- `src/components/spotify/SpotifyCard.tsx` — text colors if needed

---

## Implementation Priority

1. **Sidebar overflow fix** — smallest scope, fixes a real bug visitors hit
2. **Spotify glassmorphic redesign** — small scope, visual improvement
3. **Blog Iris interaction system** — largest scope, builds on existing comment + Iris infrastructure
4. **MessageComposer refactor** — consistency cleanup, can ship alongside or after

---

## Out of Scope

- Reader notifications / engagement analytics (Layer 2, after traffic exists)
- Music context on posts (future, depends on vault integration)
- Iris leaving its own comments autonomously
- Full Talmudic hypertext threading (may revisit if engagement warrants it)
- Mobile deep mode access for Spotify panel
