# Listen Feature — The Web Blog
**Date:** 2026-04-17  
**Status:** Approved  
**Stack:** Next.js 15, ElevenLabs API, Supabase Storage, Media Session API

---

## Overview

Every post on The Web gets a listen feature: a rich inline audio player that reads the post aloud using a cloned ElevenLabs voice (or the author's actual recorded voice). Audio syncs with the text in real time — the active paragraph highlights and the page auto-scrolls as playback progresses. Audio continues playing in the background when the user locks their phone or switches apps.

---

## Audio Sources

Two modes, unified and seamless — no UI distinction between them:

1. **TTS (default)** — ElevenLabs generates audio using a cloned voice (Mike's voice, set up once in the ElevenLabs dashboard). Triggered on first play.
2. **Recorded** — Author uploads a manually recorded `.mp3`. Timestamps are derived via ElevenLabs' alignment API on first play.

In both cases, audio and timestamps are generated once and cached permanently in Supabase Storage.

---

## Architecture

### New API Route

`POST /api/the-web/[slug]/audio`

**Request:** No body. Authenticated via standard origin (public endpoint).

**Behaviour:**
1. Check Supabase Storage for `audio/[slug]/audio.mp3` — if it exists, return `{ audioUrl, timestampsUrl }` immediately.
2. If not: fetch post body from DB, strip markdown to plain text.
3. If `recorded_audio_url` is set on the post: download the file, run ElevenLabs alignment API to generate word timestamps.
4. Otherwise: call ElevenLabs TTS API with `ELEVENLABS_VOICE_ID`, request audio + word-level timestamps in one call.
5. Upload `audio.mp3` and `timestamps.json` to Supabase Storage under `audio/[slug]/`.
6. Update `blog_posts`: set `has_audio = true`, `audio_generated_at = now()`.
7. Return `{ audioUrl, timestampsUrl }`.

**Error handling:** If ElevenLabs is unavailable, return a 503 with `{ error: 'audio_unavailable' }`. The listen card shows a graceful "Couldn't load audio" state — no crash.

**Rate limiting:** Requests for already-generated audio (step 1) return immediately with no rate limit. The generation path (steps 2–6) is rate-limited to 1 attempt per slug per 60 seconds via Upstash Redis to prevent abuse.

### Timestamp Format (`timestamps.json`)

```json
{
  "paragraphs": [
    { "index": 0, "start": 0.0, "end": 12.4, "text": "There is something..." },
    { "index": 1, "start": 12.4, "end": 28.1, "text": "But attention isn't..." }
  ],
  "duration": 492.0
}
```

Paragraph boundaries are derived from word-level timestamps returned by ElevenLabs — each paragraph's `start` is the timestamp of its first word, `end` is the timestamp of its last word.

### Database Changes (`blog_posts`)

```sql
ALTER TABLE blog_posts
  ADD COLUMN has_audio boolean NOT NULL DEFAULT false,
  ADD COLUMN audio_generated_at timestamptz,
  ADD COLUMN recorded_audio_url text;
```

### Environment Variables

```bash
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...   # Cloned voice ID from ElevenLabs dashboard
```

### Cost

ElevenLabs charges per character. A 2,000-word post (~12,000 chars) costs ~$0.12–$0.18 at standard tier. Generated once, cached permanently — cost is per post, not per listener.

---

## UI Components

### 1. Listen Card (`ListenCard.tsx`)

**Position:** Between the post header (title, date, tags) and the post body.  
**Style:** Rich card (dark background, teal accent, prominent play button).

**States:**
- **Idle (audio not yet generated):** Shows "Listen · 8 min" with a play button. On press, calls `/api/the-web/[slug]/audio`, shows a subtle loading spinner in the button.
- **Loading:** Spinner in play button, "Generating audio…" subtitle. Typically 3–5 seconds on first play.
- **Playing:** Play button becomes pause. Progress bar fills. Time elapsed / remaining shown.
- **Paused:** Pause button becomes play. Progress bar frozen.
- **Error:** "Couldn't load audio" message. No crash, no retry loop.

**Controls:**
- Play / pause
- Progress bar (seekable — tap/click to jump)
- Time elapsed · Time remaining
- Playback speed toggle: 1× → 1.25× → 1.5× → 2× (cycles on tap)

### 2. Sticky Top Bar (`ListenBar.tsx`)

**Appears:** Slides in from top when playback starts. Sits directly below the site nav.  
**Disappears:** When playback is explicitly stopped (user presses pause then navigates away, or audio ends). The bar remains visible while paused so the user can resume — it is not dismissed just because the listen card scrolls back into view.

**Desktop (single row):**
```
[⏸] On the fragility of attention    3:24 · 4:48 left    [1×]  [↓]
────────────────────────────── teal progress strip (2px) ──────────────
```

**Mobile (two rows):**
```
────────────────── teal progress strip (2px) ──────────────
[⏸]  On the fragility of attention
      3:24 · 4:48 remaining
[1×]  [↓ Jump to position]
```

**"↓ Jump to position" button:** Scrolls the viewport to the currently active paragraph. For users who have scrolled away while listening.

### 3. Paragraph Highlighting (integrated into `MarkdownRenderer.tsx`)

When audio is playing, the renderer receives the current `paragraphIndex` via context:

- **Active paragraph:** `background: rgba(20,184,166,0.08)`, `border-left: 2px solid #14b8a6`, slight padding offset. Transitions smoothly (200ms).
- **Past paragraphs:** `opacity: 0.5`, fades as soon as the next paragraph begins.
- **Upcoming paragraphs:** Normal styling.

**Auto-scroll behaviour:**
- On paragraph change, `scrollIntoView({ behavior: 'smooth', block: 'center' })` is called on the active paragraph element.
- If the user manually scrolls (detected via `scroll` event listener), auto-scroll pauses.
- Auto-scroll resumes 4 seconds after the last manual scroll event.

---

## Background Playback (Media Session API)

Registered on first play:

```typescript
navigator.mediaSession.metadata = new MediaMetadata({
  title: post.title,
  artist: 'Mike Veson',
  artwork: [{ src: post.cover_image || '/og-image.png', sizes: '512x512' }]
});
navigator.mediaSession.setActionHandler('play', () => audio.play());
navigator.mediaSession.setActionHandler('pause', () => audio.pause());
navigator.mediaSession.setActionHandler('seekforward', () => { audio.currentTime += 30; });
navigator.mediaSession.setActionHandler('seekbackward', () => { audio.currentTime -= 15; });
```

This surfaces lock screen controls on iOS and Android. Audio continues playing when the user locks their phone or switches apps, as long as the browser tab remains loaded.

---

## Admin / Publishing

**For TTS posts (default):**
- No change to the publishing workflow. The listen card appears on every post automatically.
- Audio is generated on first play by any reader.

**For manually recorded posts:**
- Add `recorded_audio_url` field to the PUT `/api/the-web/[slug]` payload.
- Author uploads the `.mp3` to Supabase Storage manually (or via a future admin UI field) and sets this URL on the post.
- On first play, the server derives timestamps from the recording via ElevenLabs alignment — no re-generation of voice.

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `src/app/api/the-web/[slug]/audio/route.ts` | **Create** — audio generation + caching endpoint |
| `src/components/the-web/ListenCard.tsx` | **Create** — inline listen card component |
| `src/components/the-web/ListenBar.tsx` | **Create** — sticky top bar component |
| `src/hooks/useAudioPlayer.ts` | **Create** — audio state, timestamp tracking, Media Session registration |
| `src/app/the-web/[slug]/page.tsx` | **Modify** — add ListenCard, ListenBar, pass audio context to MarkdownRenderer |
| `src/app/the-web/[slug]/components/MarkdownRenderer.tsx` | **Modify** — accept + apply `activeParagraphIndex` for highlighting |
| `src/lib/blog.ts` | **Modify** — add `has_audio`, `audio_generated_at`, `recorded_audio_url` to `BlogPost` type |
| `supabase/migrations/20260417_blog_audio.sql` | **Create** — DB migration for new columns |

---

## Out of Scope

- Word-level highlighting (paragraph-level is sufficient and avoids ElevenLabs timestamp complexity at the word granularity)
- Admin UI for audio upload (manual Supabase Storage upload + API field is sufficient for now)
- Audio for the blog listing page (`/the-web`) — listen is post-page only
