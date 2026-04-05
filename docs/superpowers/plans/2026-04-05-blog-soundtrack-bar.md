# Blog Soundtrack Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Spotify soundtrack bar to blog posts so authors can associate tracks with articles and readers can play them inline.

**Architecture:** A `soundtrack` JSONB column on `blog_posts` stores an array of Spotify track references. A new `SoundtrackBar` client component renders below the Iris highlight hint. A `useSoundtrackPlayer` hook adapts the existing `useSpotifyEmbed` hook for playlist-style playback (prev/next, auto-advance).

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Supabase (JSONB), Spotify IFrame API (via existing `useSpotifyEmbed`)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/20260405_blog_soundtrack.sql` | Create | Add `soundtrack` column to `blog_posts` |
| `src/lib/blog.ts` | Modify | Add `SoundtrackTrack` type, update `BlogPost`, `CreateBlogPostInput`, queries |
| `src/app/api/the-web/route.ts` | Modify | Accept `soundtrack` in POST validation schema |
| `src/app/api/the-web/[slug]/route.ts` | Modify | Pass `soundtrack` through in PUT |
| `src/app/the-web/hooks/useSoundtrackPlayer.ts` | Create | Playlist playback hook wrapping `useSpotifyEmbed` |
| `src/app/the-web/components/SoundtrackBar.tsx` | Create | The soundtrack bar UI component |
| `src/app/the-web/[slug]/page.tsx` | Modify | Wire `SoundtrackBar` into the post page |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260405_blog_soundtrack.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Add soundtrack column to blog_posts
-- Stores an array of Spotify track references as JSONB
-- Example: [{"trackUri":"spotify:track:xxx","trackName":"...","artist":"...","albumArtUrl":"..."}]
ALTER TABLE blog_posts ADD COLUMN soundtrack jsonb DEFAULT NULL;
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push` (or apply via Supabase dashboard SQL editor)

Expected: Column added successfully, no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260405_blog_soundtrack.sql
git commit -m "feat: add soundtrack column to blog_posts"
```

---

### Task 2: Type Definitions & Data Layer

**Files:**
- Modify: `src/lib/blog.ts`

- [ ] **Step 1: Add the `SoundtrackTrack` type**

In `src/lib/blog.ts`, add this type after the `BlogPostTheme` interface (around line 20):

```typescript
export interface SoundtrackTrack {
  trackUri: string;      // "spotify:track:xxx"
  trackName: string;
  artist: string;
  albumArtUrl: string;   // Spotify CDN image URL
}
```

- [ ] **Step 2: Add `soundtrack` to `BlogPost` interface**

In the `BlogPost` interface, add after the `iris_context` field (line 37):

```typescript
  soundtrack: SoundtrackTrack[] | null;
```

- [ ] **Step 3: Add `soundtrack` to `CreateBlogPostInput` interface**

In the `CreateBlogPostInput` interface, add after the `iris_context` field (line 64):

```typescript
  soundtrack?: SoundtrackTrack[];
```

- [ ] **Step 4: Update `getPostBySlug` select columns**

In `getPostBySlug()` (line 185), add `soundtrack` to the select string:

Change:
```typescript
.select('id, slug, title, subtitle, body, tags, published_at, updated_at, status, reading_time, cover_image, images, theme, iris_context')
```

To:
```typescript
.select('id, slug, title, subtitle, body, tags, published_at, updated_at, status, reading_time, cover_image, images, theme, iris_context, soundtrack')
```

- [ ] **Step 5: Update `getPostBySlug` return mapping**

In the return statement of `getPostBySlug()` (around line 198-205), add the soundtrack cast:

Change:
```typescript
  return data
    ? {
        ...data,
        theme: data.theme as BlogPostTheme,
        images: data.images as { url: string; alt?: string }[],
      }
    : null;
```

To:
```typescript
  return data
    ? {
        ...data,
        theme: data.theme as BlogPostTheme,
        images: data.images as { url: string; alt?: string }[],
        soundtrack: (data.soundtrack as SoundtrackTrack[] | null) ?? null,
      }
    : null;
```

- [ ] **Step 6: Update `createBlogPost` insert and select**

In `createBlogPost()` (around line 243-258), add `soundtrack` to the insert payload and select columns:

Add to the insert object (after `iris_context`):
```typescript
      soundtrack: input.soundtrack || null,
```

Add `soundtrack` to the select string:
```typescript
.select('id, slug, title, subtitle, body, tags, published_at, updated_at, status, reading_time, cover_image, images, theme, iris_context, soundtrack')
```

Add to the return mapping (after `images`):
```typescript
    soundtrack: (data.soundtrack as SoundtrackTrack[] | null) ?? null,
```

- [ ] **Step 7: Update `updateBlogPost` payload and select**

In `updateBlogPost()` (around line 277-315), add soundtrack handling.

Add after the `iris_context` line (around line 297):
```typescript
  if (updates.soundtrack !== undefined) payload.soundtrack = updates.soundtrack || null;
```

Add `soundtrack` to the select string:
```typescript
.select('id, slug, title, subtitle, body, tags, published_at, updated_at, status, reading_time, cover_image, images, theme, iris_context, soundtrack')
```

Add to the return mapping (after `images`):
```typescript
    soundtrack: (data.soundtrack as SoundtrackTrack[] | null) ?? null,
```

- [ ] **Step 8: Verify build**

Run: `npm run build`

Expected: No TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/blog.ts
git commit -m "feat: add SoundtrackTrack type and soundtrack field to blog data layer"
```

---

### Task 3: API Route Updates

**Files:**
- Modify: `src/app/api/the-web/route.ts`
- Modify: `src/app/api/the-web/[slug]/route.ts`

- [ ] **Step 1: Add soundtrack to the POST validation schema**

In `src/app/api/the-web/route.ts`, add to `CreatePostSchema` (after `iris_context` on line 34):

```typescript
  soundtrack: z
    .array(
      z.object({
        trackUri: z.string().startsWith('spotify:track:'),
        trackName: z.string().min(1),
        artist: z.string().min(1),
        albumArtUrl: z.string().url(),
      }),
    )
    .optional(),
```

- [ ] **Step 2: Verify the PUT route passes soundtrack through**

In `src/app/api/the-web/[slug]/route.ts`, confirm that `updateBlogPost(slug, body)` on line 63 passes the full body through. Since `updateBlogPost` already handles `updates.soundtrack` from Task 2 Step 7, and the PUT route passes the raw body, no changes are needed here. The route already passes `body` (which includes `soundtrack` if provided) directly to `updateBlogPost`.

No code change needed — just verify.

- [ ] **Step 3: Verify build**

Run: `npm run build`

Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/the-web/route.ts
git commit -m "feat: accept soundtrack field in blog post creation API"
```

---

### Task 4: Soundtrack Player Hook

**Files:**
- Create: `src/app/the-web/hooks/useSoundtrackPlayer.ts`

- [ ] **Step 1: Create the hook file**

Create `src/app/the-web/hooks/useSoundtrackPlayer.ts`:

```typescript
'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { SoundtrackTrack } from '@/lib/blog';
import type { MusicMoment } from '@/lib/spotify/types';
import { useSpotifyEmbed } from '@/hooks/useSpotifyEmbed';

/**
 * Adapts the existing useSpotifyEmbed hook for playlist-style playback.
 * Manages track index, prev/next, and auto-advance.
 */
export function useSoundtrackPlayer(soundtrack: SoundtrackTrack[]) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previewEnded, setPreviewEnded] = useState(false);
  const [autoAdvancing, setAutoAdvancing] = useState(false);

  const embed = useSpotifyEmbed();

  // Convert SoundtrackTrack to a MusicMoment-shaped object for useSpotifyEmbed.
  // Only the fields that useSpotifyEmbed actually uses: id, trackUri, spotifyUrl.
  const asMoments: MusicMoment[] = useMemo(
    () =>
      soundtrack.map((t, i) => ({
        id: `soundtrack-${i}`,
        trackName: t.trackName,
        artist: t.artist,
        album: '',
        trackUri: t.trackUri,
        albumArtUrl: t.albumArtUrl,
        previewUrl: null,
        spotifyUrl: '',
        dateRange: { start: '', end: '' },
        playCount: 0,
        weeksCount: 0,
        intensity: 0,
        maxState: 0,
        peakDay: '',
        peakDayPlays: 0,
        hotDays: [],
      })),
    [soundtrack],
  );

  const currentTrack = soundtrack[currentIndex] ?? null;
  const isCurrentPlaying =
    embed.currentMomentId === `soundtrack-${currentIndex}`;

  // Detect track ended (progress >= 1 and stopped playing) → auto-advance
  const trackEnded =
    isCurrentPlaying && embed.progress >= 1 && !embed.isPlaying;

  useEffect(() => {
    if (trackEnded && !autoAdvancing && soundtrack.length > 1) {
      setAutoAdvancing(true);
      const nextIdx = (currentIndex + 1) % soundtrack.length;
      setCurrentIndex(nextIdx);
      setPreviewEnded(false);
      embed.togglePlay(asMoments[nextIdx]);
      // Reset flag after a short delay to avoid re-triggering
      const timer = setTimeout(() => setAutoAdvancing(false), 500);
      return () => clearTimeout(timer);
    }
    // If single track and it ended, mark preview ended
    if (trackEnded && soundtrack.length === 1) {
      setPreviewEnded(true);
    }
  }, [trackEnded, autoAdvancing, currentIndex, soundtrack.length, asMoments, embed]);

  const play = useCallback(() => {
    if (!asMoments[currentIndex]) return;
    setPreviewEnded(false);
    embed.togglePlay(asMoments[currentIndex]);
  }, [asMoments, currentIndex, embed]);

  const pause = useCallback(() => {
    if (isCurrentPlaying && embed.isPlaying) {
      embed.togglePlay(asMoments[currentIndex]);
    }
  }, [asMoments, currentIndex, embed, isCurrentPlaying]);

  const togglePlay = useCallback(() => {
    if (isCurrentPlaying) {
      embed.togglePlay(asMoments[currentIndex]);
    } else {
      play();
    }
  }, [asMoments, currentIndex, embed, isCurrentPlaying, play]);

  const next = useCallback(() => {
    const nextIdx = (currentIndex + 1) % soundtrack.length;
    setCurrentIndex(nextIdx);
    setPreviewEnded(false);
    embed.togglePlay(asMoments[nextIdx]);
  }, [asMoments, currentIndex, embed, soundtrack.length]);

  const prev = useCallback(() => {
    const prevIdx = (currentIndex - 1 + soundtrack.length) % soundtrack.length;
    setCurrentIndex(prevIdx);
    setPreviewEnded(false);
    embed.togglePlay(asMoments[prevIdx]);
  }, [asMoments, currentIndex, embed, soundtrack.length]);

  return {
    currentTrack,
    currentIndex,
    trackCount: soundtrack.length,
    isPlaying: isCurrentPlaying && embed.isPlaying,
    isLoading: isCurrentPlaying && embed.isLoading,
    progress: isCurrentPlaying ? embed.progress : 0,
    position: isCurrentPlaying ? embed.position : 0,
    duration: isCurrentPlaying ? embed.duration : 0,
    previewEnded,
    togglePlay,
    play,
    pause,
    next,
    prev,
    containerRef: embed.containerRef,
  };
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/the-web/hooks/useSoundtrackPlayer.ts
git commit -m "feat: add useSoundtrackPlayer hook for playlist playback"
```

---

### Task 5: SoundtrackBar Component

**Files:**
- Create: `src/app/the-web/components/SoundtrackBar.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/the-web/components/SoundtrackBar.tsx`:

```typescript
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Play, Pause, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { SoundtrackTrack } from '@/lib/blog';
import { useSoundtrackPlayer } from '../hooks/useSoundtrackPlayer';

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

interface SoundtrackBarProps {
  soundtrack: SoundtrackTrack[];
}

export default function SoundtrackBar({ soundtrack }: SoundtrackBarProps) {
  const [dismissed, setDismissed] = useState(false);
  const player = useSoundtrackPlayer(soundtrack);

  if (dismissed || soundtrack.length === 0) return null;

  const { currentTrack, currentIndex, trackCount } = player;
  if (!currentTrack) return null;

  return (
    <>
      {/* Hidden Spotify embed container */}
      <div
        ref={player.containerRef}
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }}
      />

      <div className="rounded-xl bg-gradient-to-r from-[#1DB954]/[0.08] to-emerald-500/[0.08] border border-white/[0.06] mb-8 overflow-hidden">
        <div className="flex items-center gap-2.5 px-3 py-2">
          {/* Album art — 32px on mobile, 40px on sm+ */}
          <div className="relative w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 rounded-lg overflow-hidden">
            <Image
              src={currentTrack.albumArtUrl}
              alt={`${currentTrack.trackName} album art`}
              fill
              sizes="40px"
              className="object-cover"
              unoptimized
            />
          </div>

          {/* Prev button */}
          {trackCount > 1 && (
            <button
              onClick={player.prev}
              className="flex-shrink-0 w-6 h-6 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              aria-label="Previous track"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-white/50" />
            </button>
          )}

          {/* Play / Pause button */}
          <button
            onClick={player.togglePlay}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-[#1DB954]/20 hover:bg-[#1DB954]/30 transition-colors"
            aria-label={player.isPlaying ? 'Pause' : 'Play'}
          >
            {player.isLoading ? (
              <LoadingBars />
            ) : player.isPlaying ? (
              <Pause className="w-3.5 h-3.5 text-[#1DB954]" fill="#1DB954" />
            ) : (
              <Play className="w-3.5 h-3.5 text-[#1DB954] ml-0.5" fill="#1DB954" />
            )}
          </button>

          {/* Next button */}
          {trackCount > 1 && (
            <button
              onClick={player.next}
              className="flex-shrink-0 w-6 h-6 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              aria-label="Next track"
            >
              <ChevronRight className="w-3.5 h-3.5 text-white/50" />
            </button>
          )}

          {/* Track info */}
          <div className="flex-1 min-w-0">
            <div className="text-xs text-white/80 font-medium truncate">
              {currentTrack.trackName}
            </div>
            <div className="text-[11px] text-white/40 truncate">
              {currentTrack.artist}
              {player.isPlaying && player.duration > 0 && (
                <span className="text-white/30 ml-1.5">
                  {formatTime(player.position)} / {formatTime(player.duration)}
                </span>
              )}
            </div>
          </div>

          {/* Track dots */}
          {trackCount > 1 && (
            <div className="flex gap-1 items-center flex-shrink-0">
              {soundtrack.map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-colors ${
                    i === currentIndex
                      ? 'w-1.5 h-1.5 bg-[#1DB954]'
                      : 'w-1 h-1 bg-white/20'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Close button */}
          <button
            onClick={() => {
              player.pause();
              setDismissed(true);
            }}
            className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            aria-label="Dismiss soundtrack"
          >
            <X className="w-2.5 h-2.5 text-white/30" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-white/[0.06]">
          <div
            className="h-full bg-gradient-to-r from-[#1DB954] to-emerald-500 transition-[width] duration-300"
            style={{ width: `${player.progress * 100}%` }}
          />
        </div>

        {/* Preview ended message */}
        {player.previewEnded && (
          <div className="px-3 py-1.5 text-[10px] text-white/40 border-t border-white/[0.04]">
            Preview ended.{' '}
            <a
              href="https://open.spotify.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1DB954]/70 hover:text-[#1DB954] transition-colors underline"
            >
              Log in to Spotify
            </a>{' '}
            for full tracks.
          </div>
        )}
      </div>
    </>
  );
}

/** Tiny bouncing equalizer bars for loading state */
function LoadingBars() {
  return (
    <div className="flex items-end justify-center" style={{ height: 10, gap: 1.5 }}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-full"
          style={{
            width: 2,
            backgroundColor: '#1DB954',
            animation: `eqBounce 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
          }}
        />
      ))}
      <style>{`
        @keyframes eqBounce {
          0% { height: 20%; opacity: 0.4; }
          100% { height: 100%; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/the-web/components/SoundtrackBar.tsx
git commit -m "feat: add SoundtrackBar component for blog post soundtracks"
```

---

### Task 6: Wire Into Blog Post Page

**Files:**
- Modify: `src/app/the-web/[slug]/page.tsx`

- [ ] **Step 1: Add the import**

In `src/app/the-web/[slug]/page.tsx`, add after the `IrisHighlightHint` import (line 10):

```typescript
import SoundtrackBar from '../components/SoundtrackBar';
```

- [ ] **Step 2: Add SoundtrackBar between IrisHighlightHint and PostBodyWithIris**

In the JSX, between `<IrisHighlightHint />` (line 96) and the `{/* Body */}` comment (line 98), add:

```typescript
        {/* Soundtrack */}
        {post.soundtrack && post.soundtrack.length > 0 && (
          <SoundtrackBar soundtrack={post.soundtrack} />
        )}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

Expected: No TypeScript errors. The page renders the soundtrack bar only when a post has a non-empty `soundtrack` array.

- [ ] **Step 4: Manual test**

Run: `npm run dev`

1. Update a blog post via the API to include a soundtrack:
```bash
curl -X PUT http://localhost:3000/api/the-web/YOUR_POST_SLUG \
  -H "Content-Type: application/json" \
  -H "x-admin-key: $ADMIN_API_KEY" \
  -d '{
    "soundtrack": [
      {"trackUri": "spotify:track:2bPGTMB5sFfFYQ2YvSmup0", "trackName": "Comptine d'\''un autre été", "artist": "Yann Tiersen", "albumArtUrl": "https://i.scdn.co/image/ab67616d00004851e8b066f70c206551210d902b"},
      {"trackUri": "spotify:track:4VqPOruhp5EdPBeR92t6lQ", "trackName": "Experience", "artist": "Ludovico Einaudi", "albumArtUrl": "https://i.scdn.co/image/ab67616d00004851ccdb5942ace0060e42a06ac9"}
    ]
  }'
```

2. Navigate to `http://localhost:3000/the-web/YOUR_POST_SLUG`
3. Verify:
   - Soundtrack bar appears below the Iris highlight hint
   - Album art shows for the first track
   - Play/pause toggles playback
   - Prev/next arrows switch tracks
   - Track dots show current position
   - Progress bar fills during playback
   - X button dismisses the bar and stops playback
   - Posts without a soundtrack show no bar

- [ ] **Step 5: Commit**

```bash
git add src/app/the-web/[slug]/page.tsx
git commit -m "feat: wire SoundtrackBar into blog post page"
```
