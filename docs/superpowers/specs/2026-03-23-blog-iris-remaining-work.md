# Blog Iris — Remaining Work

**Date:** 2026-03-23
**Status:** In Progress
**Parent spec:** `docs/superpowers/specs/2026-03-22-blog-iris-and-site-fixes-design.md`

This spec covers bugs and unfinished items discovered during implementation and testing.

---

## Bug Fixes

### 1. Selection text is one step behind

**Problem:** When dragging to highlight text, the passage preview in the bubble shows text from the *previous* selection state, not the current one. For example, highlighting one line shows nothing, then extending to a second line shows only the first line's text.

**Root cause:** The `selectionchange` event fires mid-drag but `document.getSelection().toString()` may return the previous selection state on some browsers. The `useTextSelection` hook reads text immediately on `selectionchange`, which can be stale during active dragging.

**Fix:** Add a small debounce (~50ms) to `selectionchange` handling, or use `mouseup` as the definitive selection event (only capture final selection, not mid-drag intermediate states). The `mouseup` approach is simpler and avoids the one-behind problem entirely. Keep `selectionchange` only for detecting when selection is cleared.

### 2. Green highlight line for selected passage

**Problem:** When the user clicks into the Iris textbox, the browser's native text highlight disappears. There's no visual indicator showing which passage the conversation is about.

**Design:** Add a vertical green line (2-3px wide, Iris green `#10b981`) to the left of the highlighted passage in the blog text. This line:
- Appears when the Iris bubble opens
- Spans from the top of the first selected line to the bottom of the last selected line
- Stays visible while the bubble is open (even after native selection clears)
- Removed when the bubble closes
- On mobile: same behavior, line appears in the left margin of the text

**Implementation approach:**
- On bubble open, wrap the selected text range in a `<mark>` element with a custom class (or use `CSS.highlights` API if browser support is sufficient)
- Simpler approach: use absolute-positioned div overlay based on the selection rect coordinates
  - Place inside the `PostBodyWithIris` container
  - `position: absolute`, `left: -8px` (in the margin), `width: 3px`, `background: #10b981`, `border-radius: 2px`
  - `top` and `height` calculated from the selection's bounding rect relative to the container
- Remove the overlay when bubble closes

**Alternative (custom highlight):** Instead of a line, highlight the selected text with a subtle green background (`rgba(16,185,129,0.12)`) and a left border. This could be done by wrapping the range in a `<mark>` with custom styling, but this is more complex (splitting text nodes, handling cleanup). The line approach is simpler.

**Mobile:** Same vertical line, but position it at `left: 0` or `left: -4px` since margins are smaller.

### 3. Click-in-textbox clears native highlight

**Already handled:** The two-phase selection lifecycle (Phase 1: adjusting, Phase 2: locked) prevents the bubble from closing when the textbox is clicked. The visual highlight disappearing is expected browser behavior — the green line (item 2 above) replaces it.

---

## Unfinished Features

### 4. Draft submit — wire up Post and Send to Mike

**Current state:** `handleDraftSubmit` in BlogIrisBubble.tsx is a `console.log` TODO.

**Comment path ("Post"):**
- POST to `/api/the-web/${slug}/comments` with:
  - `author_name`: from the name field (or "Anonymous")
  - `author_email`: from the email field (if provided)
  - `body`: the edited draft text
  - `passage_ref`: the highlighted passage text
- On success: close the bubble, optionally show a brief toast/confirmation
- On error: show inline error in the draft view

**Message path ("Send to Mike"):**
- POST to `/api/inbox` with:
  - `source`: `'blog-iris'`
  - `message`: the edited draft text
  - `contact`: auto-detected from the contact field (email/phone/anon)
  - `passage_ref`: the highlighted passage text
  - `post_slug`: current post slug
  - `post_title`: current post title
  - `iris_conversation`: the full message history
  - `nonce`: generated nonce
  - `honeypot`: empty string
- On success: close the bubble, show confirmation
- On error: show inline error

### 5. Resend email template for blog-iris source

**File:** `src/app/api/inbox/route.ts`

When `source === 'blog-iris'`, the notification email to Mike should include:
- The post title and link
- The highlighted passage
- The conversation history (formatted)
- The reader's message

### 6. Per-post Iris context document

**Current state:** The `iris_context` column exists in the database and the data layer supports it. The API endpoint reads it. But there's no way to publish context alongside posts yet, and no existing posts have context.

**What's needed:**
- Update the blog publish API (`POST /api/the-web`) and update API (`PUT /api/the-web/[slug]`) to accept `iris_context` in the request body — **this is already done in the data layer** (`createBlogPost` and `updateBlogPost` both handle `iris_context`). Just need to verify the API routes pass it through.
- Write context documents for existing posts (manual, done by Mike via API or future admin UI)
- Test that Iris uses the context when responding to reader questions

### 7. Draft < 10 chars fallback

**Spec requirement:** If Iris generates a comment draft shorter than 10 characters, use the reader's original message instead.

**Fix:** In `useBlogIris.requestDraft()`, after receiving the draft, check length:
```typescript
const finalDraft = data.draft && data.draft.length >= 10 ? data.draft : lastUserMsg;
```

---

## Polish Items

### 8. Discard confirmation auto-dismiss

**Spec:** "Auto-dismiss after 3 seconds if no action."

**Fix:** Add a `useEffect` in BlogIrisBubble that sets a 3-second timer when `showDiscard` becomes true, calling `setShowDiscard(false)` on timeout.

### 9. Loading message fade animation

**Spec:** `AnimatePresence mode="wait"` with `opacity` + `y` transitions for loading messages.

**Current:** Simple CSS opacity transition.

**Fix:** Import `AnimatePresence` and `motion` from framer-motion in BlogIrisConversation and BlogIrisDraft, wrap loading messages in `<AnimatePresence mode="wait"><motion.span key={loadingMsg} ...>`.

### 10. Mobile bottom sheet drag-to-dismiss

**Spec:** Drag threshold 100px or velocity 500px/s, touch-action handling.

**Current:** Bottom sheet renders but has no drag gesture handling.

**Fix:** Add touch event tracking to the drag handle: `onTouchStart` records startY, `onTouchMove` calculates delta and applies `transform: translateY()`, `onTouchEnd` checks threshold and either dismisses or snaps back.

---

## Implementation Priority

1. **Selection text one-behind bug** (Bug #1) — affects core UX, blocks testing
2. **Green highlight line** (Bug #2) — important visual feedback
3. **Draft submit wiring** (Feature #4) — makes the feature actually functional
4. **Draft < 10 chars fallback** (Feature #7) — quick fix
5. **Discard auto-dismiss** (Polish #8) — quick fix
6. **Loading fade animation** (Polish #9) — visual polish
7. **Resend email template** (Feature #5) — important for Mike to receive messages
8. **Per-post context docs** (Feature #6) — verification + content authoring
9. **Mobile drag-to-dismiss** (Polish #10) — mobile-only polish
