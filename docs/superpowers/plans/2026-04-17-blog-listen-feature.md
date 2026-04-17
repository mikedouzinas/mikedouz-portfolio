# Blog Listen Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a listen feature to every blog post that generates TTS audio via ElevenLabs (cloned voice), caches it in Supabase Storage, and plays it back with paragraph-synced highlighting, auto-scroll, and background playback via the Media Session API.

**Architecture:** On first play, the frontend calls `POST /api/the-web/[slug]/audio` which generates audio + character-level timestamps via ElevenLabs, derives paragraph start/end times, and caches both in Supabase Storage. A `useAudioPlayer` hook manages playback state and exposes `activeParagraphIndex` for real-time highlighting. A `ListenFeature` client wrapper orchestrates the listen card, sticky top bar, and MarkdownRenderer.

**Tech Stack:** ElevenLabs REST API, Supabase Storage, Web Audio API (`<audio>` element), Media Session API, React 19, Next.js 15 App Router, Tailwind CSS, lucide-react

---

## Prerequisites (manual, before coding)

1. Create a `blog-audio` bucket in the Supabase dashboard → Storage. Set it to **Public**.
2. Sign up for ElevenLabs, clone your voice, copy the Voice ID.
3. Add to `.env.local`:
   ```
   ELEVENLABS_API_KEY=your_key_here
   ELEVENLABS_VOICE_ID=your_voice_id_here
   ```

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/20260417_blog_audio.sql` | Create | DB columns: `has_audio`, `audio_generated_at`, `recorded_audio_url` |
| `src/lib/blog.ts` | Modify | Add audio fields to `BlogPost` type |
| `src/lib/env.ts` | Modify | Add ElevenLabs env vars |
| `src/lib/audioUtils.ts` | Create | Markdown stripping, timestamp derivation |
| `src/app/api/the-web/[slug]/audio/route.ts` | Create | Audio generation + caching endpoint |
| `src/hooks/useAudioPlayer.ts` | Create | Audio state, timestamp tracking, Media Session API |
| `src/app/the-web/components/MarkdownRenderer.tsx` | Modify | Add `activeParagraphIndex` prop, paragraph highlighting, auto-scroll |
| `src/app/the-web/[slug]/components/ListenCard.tsx` | Create | Inline rich listen card (idle/loading/playing/paused/error states) |
| `src/app/the-web/[slug]/components/ListenBar.tsx` | Create | Fixed-position sticky top bar |
| `src/app/the-web/[slug]/components/ListenFeature.tsx` | Create | Client wrapper that orchestrates all listen components |
| `src/app/the-web/[slug]/page.tsx` | Modify | Replace body section with `ListenFeature` |

---

## Task 1: Database migration + type updates

**Files:**
- Create: `supabase/migrations/20260417_blog_audio.sql`
- Modify: `src/lib/blog.ts`
- Modify: `src/lib/env.ts`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260417_blog_audio.sql
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS has_audio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS audio_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS recorded_audio_url text;
```

- [ ] **Step 2: Apply the migration**

```bash
# If using Supabase CLI:
npx supabase db push

# Or run the SQL directly in the Supabase dashboard SQL editor.
```

- [ ] **Step 3: Update BlogPost interface in `src/lib/blog.ts`**

Find the `BlogPost` interface and add three fields:

```typescript
export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  body: string;
  tags: string[];
  published_at: string;
  updated_at: string;
  status: 'draft' | 'published';
  reading_time: number;
  cover_image: string | null;
  images: { url: string; alt?: string }[];
  theme: BlogPostTheme;
  iris_context?: string | null;
  soundtrack: SoundtrackTrack[] | null;
  // Audio listen feature
  has_audio: boolean;
  audio_generated_at: string | null;
  recorded_audio_url: string | null;
}
```

- [ ] **Step 4: Update `src/lib/env.ts`**

Add ElevenLabs keys to the env object:

```typescript
export const env = {
  resendApiKey: process.env.RESEND_API_KEY || '',
  adminApiKey: process.env.ADMIN_API_KEY || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  inboxRecipientEmail: process.env.INBOX_RECIPIENT_EMAIL || 'mike@douzinas.com',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || '',
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || '',
} as const;
```

- [ ] **Step 5: Verify the build still compiles**

```bash
npm run build
```
Expected: no TypeScript errors. If `BlogPost` is used in queries, Supabase returns all columns so new fields appear automatically.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260417_blog_audio.sql src/lib/blog.ts src/lib/env.ts
git commit -m "feat: add audio columns to blog_posts and update BlogPost type"
```

---

## Task 2: Audio utility functions

**Files:**
- Create: `src/lib/audioUtils.ts`
- Test: manually via `console.log` in Task 3 before wiring up

- [ ] **Step 1: Create `src/lib/audioUtils.ts`**

```typescript
export interface ParagraphTimestamp {
  index: number;
  start: number; // seconds
  end: number;   // seconds
  text: string;  // first 100 chars for reference
}

export interface AudioTimestamps {
  paragraphs: ParagraphTimestamp[];
  duration: number;
}

export interface ElevenLabsAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

/**
 * Strips markdown syntax to plain text and splits into paragraphs.
 * Paragraphs are separated by blank lines; headings become their own paragraph.
 */
export function stripMarkdownToParagraphs(markdown: string): string[] {
  const stripped = markdown
    .replace(/```[\s\S]*?```/g, '')        // fenced code blocks
    .replace(/`[^`]+`/g, '')               // inline code
    .replace(/#{1,6}\s+(.+)/g, '$1')       // headings → keep text
    .replace(/\*\*([^*]+)\*\*/g, '$1')     // bold
    .replace(/\*([^*]+)\*/g, '$1')         // italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/^[-*+]\s+/gm, '')            // unordered list markers
    .replace(/^\d+\.\s+/gm, '')            // ordered list markers
    .replace(/^>\s+/gm, '')                // blockquotes
    .replace(/::[\s\S]*?::/g, '')          // hoverdef custom syntax
    .replace(/\n{3,}/g, '\n\n')            // collapse excess newlines
    .trim();

  return stripped
    .split(/\n\n+/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter((p) => p.length > 10); // skip very short fragments
}

/**
 * Derives paragraph timestamps from ElevenLabs character-level alignment data.
 * Falls back to duration-based estimation if a paragraph can't be found.
 */
export function deriveParagraphTimestamps(
  paragraphs: string[],
  alignment: ElevenLabsAlignment,
  duration: number,
): AudioTimestamps {
  const fullText = alignment.characters.join('');
  let searchOffset = 0;

  const result: ParagraphTimestamp[] = paragraphs.map((para, index) => {
    const anchor = para.slice(0, 30);
    const charIndex = fullText.indexOf(anchor, searchOffset);

    if (charIndex === -1) {
      // Fallback: proportional estimate
      const fraction = index / paragraphs.length;
      const start = fraction * duration;
      const end = ((index + 1) / paragraphs.length) * duration;
      return { index, start, end, text: para.slice(0, 100) };
    }

    const endCharIndex = Math.min(charIndex + para.length - 1, alignment.characters.length - 1);
    searchOffset = charIndex + 1;

    const start = alignment.character_start_times_seconds[charIndex] ?? 0;
    const end = alignment.character_end_times_seconds[endCharIndex] ?? duration;

    return { index, start, end, text: para.slice(0, 100) };
  });

  return { paragraphs: result, duration };
}

/**
 * Estimates paragraph timestamps from audio duration + word counts.
 * Used for manually recorded audio where alignment isn't available.
 */
export function estimateParagraphTimestamps(
  paragraphs: string[],
  duration: number,
): AudioTimestamps {
  const totalWords = paragraphs.reduce((sum, p) => sum + p.split(/\s+/).length, 0);
  let elapsed = 0;

  const result: ParagraphTimestamp[] = paragraphs.map((para, index) => {
    const wordCount = para.split(/\s+/).length;
    const fraction = wordCount / totalWords;
    const start = elapsed;
    const end = Math.min(elapsed + fraction * duration, duration);
    elapsed = end;
    return { index, start, end, text: para.slice(0, 100) };
  });

  return { paragraphs: result, duration };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/audioUtils.ts
git commit -m "feat: add audio utility functions for markdown stripping and timestamp derivation"
```

---

## Task 3: Audio generation API route

**Files:**
- Create: `src/app/api/the-web/[slug]/audio/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// src/app/api/the-web/[slug]/audio/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  stripMarkdownToParagraphs,
  deriveParagraphTimestamps,
  estimateParagraphTimestamps,
  ElevenLabsAlignment,
  AudioTimestamps,
} from '@/lib/audioUtils';

export const runtime = 'nodejs';
export const maxDuration = 60; // seconds — ElevenLabs generation can take up to 30s

// In-memory generation lock: prevents duplicate ElevenLabs calls for the same slug
const generatingSet = new Set<string>();

type RouteParams = { params: Promise<{ slug: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;

  try {
    // 1. Check if audio already exists in Supabase Storage
    const { data: existingAudio } = await supabaseAdmin.storage
      .from('blog-audio')
      .list(slug);

    const hasAudioFile = existingAudio?.some((f) => f.name === 'audio.mp3');
    const hasTimestampsFile = existingAudio?.some((f) => f.name === 'timestamps.json');

    if (hasAudioFile && hasTimestampsFile) {
      const audioUrl = supabaseAdmin.storage
        .from('blog-audio')
        .getPublicUrl(`${slug}/audio.mp3`).data.publicUrl;
      const timestampsUrl = supabaseAdmin.storage
        .from('blog-audio')
        .getPublicUrl(`${slug}/timestamps.json`).data.publicUrl;
      return NextResponse.json({ audioUrl, timestampsUrl });
    }

    // 2. Rate limit: only one generation per slug at a time
    if (generatingSet.has(slug)) {
      return NextResponse.json(
        { error: 'audio_generating', message: 'Audio is already being generated, try again shortly.' },
        { status: 429 },
      );
    }

    // 3. Validate ElevenLabs is configured
    if (!env.elevenLabsApiKey || !env.elevenLabsVoiceId) {
      return NextResponse.json(
        { error: 'audio_unavailable', message: 'Audio generation is not configured.' },
        { status: 503 },
      );
    }

    // 4. Fetch post body from DB
    const { data: postData, error: postError } = await supabaseAdmin
      .from('blog_posts')
      .select('body, recorded_audio_url')
      .eq('slug', slug)
      .single();

    if (postError || !postData) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    generatingSet.add(slug);

    try {
      const paragraphs = stripMarkdownToParagraphs(postData.body);
      const plainText = paragraphs.join('\n\n');
      let timestamps: AudioTimestamps;
      let audioBuffer: ArrayBuffer;

      if (postData.recorded_audio_url) {
        // Recorded audio: download file, estimate paragraph timestamps from duration
        const audioResponse = await fetch(postData.recorded_audio_url);
        if (!audioResponse.ok) throw new Error('Failed to fetch recorded audio');
        audioBuffer = await audioResponse.arrayBuffer();

        // Estimate duration from file size (rough: ~128kbps mp3 = 16KB/s)
        const estimatedDuration = audioBuffer.byteLength / 16000;
        timestamps = estimateParagraphTimestamps(paragraphs, estimatedDuration);
      } else {
        // TTS: call ElevenLabs with-timestamps endpoint
        const elevenResponse = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${env.elevenLabsVoiceId}/with-timestamps`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': env.elevenLabsApiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: plainText,
              model_id: 'eleven_turbo_v2_5',
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
              },
            }),
          },
        );

        if (!elevenResponse.ok) {
          const errText = await elevenResponse.text();
          console.error('[audio] ElevenLabs error:', errText);
          throw new Error('ElevenLabs API request failed');
        }

        const elevenData = await elevenResponse.json() as {
          audio_base64: string;
          alignment: ElevenLabsAlignment;
        };

        // Decode base64 audio
        const binaryStr = atob(elevenData.audio_base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        audioBuffer = bytes.buffer;

        // Estimate total duration from alignment data
        const lastIdx = elevenData.alignment.character_end_times_seconds.length - 1;
        const duration = elevenData.alignment.character_end_times_seconds[lastIdx] ?? 0;
        timestamps = deriveParagraphTimestamps(paragraphs, elevenData.alignment, duration);
      }

      // 5. Upload audio to Supabase Storage
      const { error: audioUploadError } = await supabaseAdmin.storage
        .from('blog-audio')
        .upload(`${slug}/audio.mp3`, audioBuffer, {
          contentType: 'audio/mpeg',
          upsert: true,
        });
      if (audioUploadError) throw new Error(`Audio upload failed: ${audioUploadError.message}`);

      // 6. Upload timestamps JSON to Supabase Storage
      const timestampsJson = JSON.stringify(timestamps);
      const { error: tsUploadError } = await supabaseAdmin.storage
        .from('blog-audio')
        .upload(`${slug}/timestamps.json`, new TextEncoder().encode(timestampsJson), {
          contentType: 'application/json',
          upsert: true,
        });
      if (tsUploadError) throw new Error(`Timestamps upload failed: ${tsUploadError.message}`);

      // 7. Update blog_posts: set has_audio = true
      await supabaseAdmin
        .from('blog_posts')
        .update({ has_audio: true, audio_generated_at: new Date().toISOString() })
        .eq('slug', slug);

      // 8. Return public URLs
      const audioUrl = supabaseAdmin.storage
        .from('blog-audio')
        .getPublicUrl(`${slug}/audio.mp3`).data.publicUrl;
      const timestampsUrl = supabaseAdmin.storage
        .from('blog-audio')
        .getPublicUrl(`${slug}/timestamps.json`).data.publicUrl;

      return NextResponse.json({ audioUrl, timestampsUrl });
    } finally {
      generatingSet.delete(slug);
    }
  } catch (error) {
    generatingSet.delete(slug);
    console.error('[audio] Generation error:', error);
    return NextResponse.json(
      { error: 'audio_unavailable', message: 'Failed to generate audio.' },
      { status: 503 },
    );
  }
}
```

- [ ] **Step 2: Test the endpoint manually**

Start the dev server: `npm run dev`

```bash
# Should return 404 for a non-existent slug
curl -X POST http://localhost:3000/api/the-web/test-slug-does-not-exist
# Expected: {"error":"Post not found"}

# Should return 503 if env vars not set (comment them out briefly)
curl -X POST http://localhost:3000/api/the-web/your-existing-slug
# Expected: {"error":"audio_unavailable",...} or a real audioUrl if configured
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/the-web/[slug]/audio/route.ts src/lib/audioUtils.ts
git commit -m "feat: add audio generation API route with ElevenLabs + Supabase Storage caching"
```

---

## Task 4: `useAudioPlayer` hook

**Files:**
- Create: `src/hooks/useAudioPlayer.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/useAudioPlayer.ts
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { AudioTimestamps } from '@/lib/audioUtils';

export type AudioStatus =
  | 'idle'       // never played
  | 'loading'    // fetching audio URL from API
  | 'generating' // ElevenLabs is generating (first play, no cache)
  | 'ready'      // audio URL loaded, not yet played
  | 'playing'
  | 'paused'
  | 'error';

const SPEED_STEPS = [1, 1.25, 1.5, 2] as const;

export interface UseAudioPlayerReturn {
  status: AudioStatus;
  currentTime: number;
  duration: number;
  activeParagraphIndex: number;
  speed: number;
  errorMessage: string | null;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  cycleSpeed: () => void;
  jumpToActiveParagraph: () => void;
}

export function useAudioPlayer(slug: string, postTitle: string, coverImage: string | null): UseAudioPlayerReturn {
  const [status, setStatus] = useState<AudioStatus>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState(-1);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timestampsRef = useRef<AudioTimestamps | null>(null);
  const rafRef = useRef<number | null>(null);
  const hasInitiatedRef = useRef(false);

  const speed = SPEED_STEPS[speedIndex];

  // Cancel animation frame
  const cancelRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Update progress via rAF
  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = audio.currentTime;
    setCurrentTime(t);

    // Derive active paragraph from timestamps
    const ts = timestampsRef.current;
    if (ts) {
      const idx = ts.paragraphs.findIndex((p) => t >= p.start && t < p.end);
      setActiveParagraphIndex(idx >= 0 ? idx : ts.paragraphs.length - 1);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // Register Media Session
  const registerMediaSession = useCallback((title: string, artwork: string | null) => {
    if (!('mediaSession' in navigator)) return;
    const audio = audioRef.current;
    if (!audio) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: 'Mike Veson',
      artwork: artwork
        ? [{ src: artwork, sizes: '512x512', type: 'image/jpeg' }]
        : [{ src: '/og-image.png', sizes: '512x512', type: 'image/png' }],
    });

    navigator.mediaSession.setActionHandler('play', () => {
      audio.play().catch(() => {});
      setStatus('playing');
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audio.pause();
      setStatus('paused');
    });
    navigator.mediaSession.setActionHandler('seekforward', () => {
      audio.currentTime = Math.min(audio.currentTime + 30, audio.duration);
    });
    navigator.mediaSession.setActionHandler('seekbackward', () => {
      audio.currentTime = Math.max(audio.currentTime - 15, 0);
    });
  }, []);

  // Initiate: fetch audio URL from API, load audio + timestamps
  const initiate = useCallback(async () => {
    if (hasInitiatedRef.current) return;
    hasInitiatedRef.current = true;
    setStatus('loading');
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/the-web/${slug}/audio`, { method: 'POST' });

      if (res.status === 429) {
        // Generation in progress elsewhere — keep polling briefly
        setStatus('generating');
        await new Promise((r) => setTimeout(r, 5000));
        hasInitiatedRef.current = false;
        initiate();
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to get audio URL');
      }

      const { audioUrl, timestampsUrl } = await res.json() as {
        audioUrl: string;
        timestampsUrl: string;
      };

      // Fetch timestamps JSON
      const tsRes = await fetch(timestampsUrl);
      if (!tsRes.ok) throw new Error('Failed to load timestamps');
      const ts = await tsRes.json() as AudioTimestamps;
      timestampsRef.current = ts;

      // Create and configure audio element
      const audio = new Audio(audioUrl);
      audio.preload = 'auto';
      audioRef.current = audio;

      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration);
      });

      audio.addEventListener('ended', () => {
        cancelRaf();
        setStatus('paused');
        setCurrentTime(audio.duration);
        setActiveParagraphIndex(-1);
      });

      audio.addEventListener('error', () => {
        cancelRaf();
        setStatus('error');
        setErrorMessage("Couldn't load audio.");
      });

      setStatus('ready');
    } catch (err) {
      console.error('[useAudioPlayer] initiate error:', err);
      setStatus('error');
      setErrorMessage("Couldn't load audio. Try again.");
      hasInitiatedRef.current = false;
    }
  }, [slug, cancelRaf]);

  const play = useCallback(async () => {
    if (status === 'idle' || status === 'error') {
      await initiate();
    }

    const audio = audioRef.current;
    if (!audio) return;

    try {
      audio.playbackRate = speed;
      await audio.play();
      setStatus('playing');
      registerMediaSession(postTitle, coverImage);
      cancelRaf();
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error('[useAudioPlayer] play error:', err);
      setStatus('error');
      setErrorMessage("Couldn't start playback.");
    }
  }, [status, initiate, speed, postTitle, coverImage, registerMediaSession, cancelRaf, tick]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    cancelRaf();
    setStatus('paused');
  }, [cancelRaf]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const cycleSpeed = useCallback(() => {
    setSpeedIndex((i) => {
      const next = (i + 1) % SPEED_STEPS.length;
      if (audioRef.current) {
        audioRef.current.playbackRate = SPEED_STEPS[next];
      }
      return next;
    });
  }, []);

  const jumpToActiveParagraph = useCallback(() => {
    if (activeParagraphIndex < 0) return;
    const el = document.querySelector<HTMLElement>(`[data-para-idx="${activeParagraphIndex}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeParagraphIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelRaf();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, [cancelRaf]);

  // When status transitions to 'ready', auto-play
  useEffect(() => {
    if (status === 'ready' && audioRef.current) {
      play();
    }
  }, [status, play]);

  return {
    status,
    currentTime,
    duration,
    activeParagraphIndex,
    speed,
    errorMessage,
    play,
    pause,
    seek,
    cycleSpeed,
    jumpToActiveParagraph,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useAudioPlayer.ts
git commit -m "feat: add useAudioPlayer hook with Media Session API and paragraph timestamp tracking"
```

---

## Task 5: MarkdownRenderer — paragraph highlighting + auto-scroll

**Files:**
- Modify: `src/app/the-web/components/MarkdownRenderer.tsx`

- [ ] **Step 1: Add `activeParagraphIndex` prop and highlighting**

Open `src/app/the-web/components/MarkdownRenderer.tsx`. Make these changes:

**Update the interface:**
```typescript
interface MarkdownRendererProps {
  content: string;
  activeParagraphIndex?: number; // -1 or undefined = no highlighting
}
```

**Add `useEffect` and `useRef` imports** (add to existing React import):
```typescript
import React, { useRef, useEffect } from 'react';
```

**Add auto-scroll logic** (inside the component, before the `return`):
```typescript
export default function MarkdownRenderer({ content, activeParagraphIndex = -1 }: MarkdownRendererProps) {
  const processedContent = preprocessDefinitions(content);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect manual scroll → pause auto-scroll for 4 seconds
  useEffect(() => {
    const onScroll = () => {
      isUserScrollingRef.current = true;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 4000);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  // Auto-scroll to active paragraph
  useEffect(() => {
    if (activeParagraphIndex < 0 || isUserScrollingRef.current) return;
    const el = document.querySelector<HTMLElement>(`[data-para-idx="${activeParagraphIndex}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeParagraphIndex]);
  
  // ...rest of component
```

**Replace the `p` component renderer** to add `data-para-idx` and highlighting:

Find the existing `p` renderer:
```typescript
p: ({ children }: { children?: React.ReactNode }) => (
  <p className="text-base leading-7 text-gray-300 mb-4">{children}</p>
),
```

Replace with (note: use a mutable counter ref, reset before each render):
```typescript
// Add this ref just before the return statement (outside the components object):
const paraCounterRef = useRef(0);
paraCounterRef.current = 0; // reset on each render
```

Then replace the `p` renderer:
```typescript
p: ({ children }: { children?: React.ReactNode }) => {
  const idx = paraCounterRef.current++;
  const isActive = activeParagraphIndex === idx;
  const isPast = activeParagraphIndex > idx && activeParagraphIndex >= 0;
  return (
    <p
      data-para-idx={idx}
      className={[
        'text-base leading-7 mb-4 transition-all duration-200',
        isActive
          ? 'text-gray-100 bg-teal-500/[0.08] border-l-2 border-teal-500 pl-3 -ml-[13px]'
          : isPast
          ? 'text-gray-300 opacity-50'
          : 'text-gray-300',
      ].join(' ')}
    >
      {children}
    </p>
  );
},
```

- [ ] **Step 2: Verify the component still renders correctly**

```bash
npm run dev
# Open any blog post at http://localhost:3000/the-web/[slug]
# Content should render identically to before (activeParagraphIndex defaults to -1 = no highlighting)
```

- [ ] **Step 3: Commit**

```bash
git add src/app/the-web/components/MarkdownRenderer.tsx
git commit -m "feat: add paragraph highlighting and auto-scroll to MarkdownRenderer"
```

---

## Task 6: ListenCard component

**Files:**
- Create: `src/app/the-web/[slug]/components/ListenCard.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/app/the-web/[slug]/components/ListenCard.tsx
'use client';

import { Play, Pause, Loader2 } from 'lucide-react';
import type { UseAudioPlayerReturn, AudioStatus } from '@/hooks/useAudioPlayer';

interface ListenCardProps {
  player: UseAudioPlayerReturn;
  readingTime: number;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ListenCard({ player, readingTime }: ListenCardProps) {
  const { status, currentTime, duration, speed, play, pause, seek, cycleSpeed } = player;

  const isLoading = status === 'loading' || status === 'generating';
  const isPlaying = status === 'playing';
  const isReady = status !== 'idle' && status !== 'error';
  const progress = duration > 0 ? currentTime / duration : 0;
  const remaining = Math.max(0, duration - currentTime);

  function handlePlayPause() {
    if (isPlaying) pause();
    else play();
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    seek(fraction * duration);
  }

  const subtitleText = (() => {
    if (status === 'error') return player.errorMessage ?? "Couldn't load audio";
    if (status === 'generating') return 'Generating audio…';
    if (status === 'loading') return 'Loading…';
    if (isReady && duration > 0) {
      return `${formatTime(currentTime)} · ${formatTime(remaining)} remaining · Mike Veson`;
    }
    return `${readingTime} min · Mike Veson`;
  })();

  return (
    <div className="rounded-xl bg-gradient-to-br from-teal-500/[0.08] to-teal-400/[0.04] border border-teal-500/20 p-4 mb-8">
      {/* Controls row */}
      <div className="flex items-center gap-3 mb-3">
        {/* Play / Pause button */}
        <button
          onClick={handlePlayPause}
          disabled={isLoading}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="w-10 h-10 rounded-full bg-teal-500 text-black flex items-center justify-center flex-shrink-0 hover:bg-teal-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : isPlaying ? (
            <Pause size={16} fill="currentColor" />
          ) : (
            <Play size={16} fill="currentColor" className="translate-x-px" />
          )}
        </button>

        {/* Title + subtitle */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-200">Listen to this post</div>
          <div className="text-xs text-gray-500 mt-0.5 truncate">{subtitleText}</div>
        </div>

        {/* Speed toggle — only when audio is ready */}
        {isReady && (
          <button
            onClick={cycleSpeed}
            className="text-xs text-gray-500 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full px-2.5 py-1 transition-colors flex-shrink-0"
          >
            {speed}×
          </button>
        )}
      </div>

      {/* Progress bar — only when duration is known */}
      {duration > 0 && (
        <>
          <div
            role="slider"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={currentTime}
            onClick={handleSeek}
            className="h-1 bg-gray-700 rounded-full cursor-pointer overflow-hidden"
          >
            <div
              className="h-full bg-teal-500 rounded-full transition-none"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/the-web/[slug]/components/ListenCard.tsx
git commit -m "feat: add ListenCard component with play/pause, progress bar, and speed toggle"
```

---

## Task 7: ListenBar component (sticky top bar)

**Files:**
- Create: `src/app/the-web/[slug]/components/ListenBar.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/app/the-web/[slug]/components/ListenBar.tsx
'use client';

import { Play, Pause, ArrowDown } from 'lucide-react';
import type { UseAudioPlayerReturn } from '@/hooks/useAudioPlayer';

interface ListenBarProps {
  player: UseAudioPlayerReturn;
  postTitle: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ListenBar({ player, postTitle }: ListenBarProps) {
  const { status, currentTime, duration, speed, play, pause, cycleSpeed, jumpToActiveParagraph } = player;

  const isPlaying = status === 'playing';
  const isVisible = status !== 'idle' && status !== 'error';
  const progress = duration > 0 ? currentTime / duration : 0;
  const remaining = Math.max(0, duration - currentTime);

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-teal-500/10">
      {/* Thin teal progress strip */}
      <div className="h-0.5 bg-gray-800">
        <div
          className="h-full bg-teal-500 transition-none"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Controls */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Desktop: single row */}
        <div className="hidden sm:flex items-center gap-3 py-2">
          <button
            onClick={isPlaying ? pause : play}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-7 h-7 rounded-full bg-teal-500 text-black flex items-center justify-center flex-shrink-0 hover:bg-teal-400 transition-colors"
          >
            {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="translate-x-px" />}
          </button>

          <span className="text-xs text-gray-300 truncate flex-1 min-w-0">{postTitle}</span>

          {duration > 0 && (
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {formatTime(currentTime)} · {formatTime(remaining)} left
            </span>
          )}

          <button
            onClick={cycleSpeed}
            className="text-xs text-gray-500 bg-gray-800 border border-gray-700 rounded-full px-2 py-0.5 hover:bg-gray-700 transition-colors flex-shrink-0"
          >
            {speed}×
          </button>

          <button
            onClick={jumpToActiveParagraph}
            title="Jump to reading position"
            className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
          >
            <ArrowDown size={14} />
          </button>
        </div>

        {/* Mobile: two rows */}
        <div className="flex sm:hidden flex-col py-2 gap-1.5">
          <div className="flex items-center gap-2.5">
            <button
              onClick={isPlaying ? pause : play}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-9 h-9 rounded-full bg-teal-500 text-black flex items-center justify-center flex-shrink-0 hover:bg-teal-400 transition-colors"
            >
              {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="translate-x-px" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-300 truncate">{postTitle}</div>
              {duration > 0 && (
                <div className="text-xs text-gray-500">{formatTime(currentTime)} · {formatTime(remaining)} remaining</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={cycleSpeed}
              className="text-xs text-gray-500 bg-gray-800 border border-gray-700 rounded-full px-2.5 py-1 hover:bg-gray-700 transition-colors"
            >
              {speed}×
            </button>
            <button
              onClick={jumpToActiveParagraph}
              className="text-xs text-gray-500 bg-gray-800 border border-gray-700 rounded-full px-2.5 py-1 hover:bg-gray-700 transition-colors flex items-center gap-1"
            >
              <ArrowDown size={11} />
              Jump to position
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/the-web/[slug]/components/ListenBar.tsx
git commit -m "feat: add ListenBar sticky top bar with desktop and mobile layouts"
```

---

## Task 8: ListenFeature wrapper + page integration

**Files:**
- Create: `src/app/the-web/[slug]/components/ListenFeature.tsx`
- Modify: `src/app/the-web/[slug]/page.tsx`

- [ ] **Step 1: Create the `ListenFeature` client wrapper**

```typescript
// src/app/the-web/[slug]/components/ListenFeature.tsx
'use client';

import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import ListenCard from './ListenCard';
import ListenBar from './ListenBar';
import PostBodyWithIris from '../../components/PostBodyWithIris';
import MarkdownRenderer from '../../components/MarkdownRenderer';

interface ListenFeatureProps {
  slug: string;
  postTitle: string;
  postBody: string;
  readingTime: number;
  coverImage: string | null;
}

export default function ListenFeature({
  slug,
  postTitle,
  postBody,
  readingTime,
  coverImage,
}: ListenFeatureProps) {
  const player = useAudioPlayer(slug, postTitle, coverImage);

  return (
    <>
      <ListenBar player={player} postTitle={postTitle} />
      <ListenCard player={player} readingTime={readingTime} />
      <PostBodyWithIris slug={slug} postTitle={postTitle}>
        <MarkdownRenderer content={postBody} activeParagraphIndex={player.activeParagraphIndex} />
      </PostBodyWithIris>
    </>
  );
}
```

- [ ] **Step 2: Update `src/app/the-web/[slug]/page.tsx`**

Find the current `IrisHighlightHint` + `PostBodyWithIris` + `MarkdownRenderer` block:

```tsx
{/* Iris highlight hint */}
<IrisHighlightHint />

{/* Soundtrack — existing audio feature */}
{post.soundtrack && post.soundtrack.length > 0 && (
  <SoundtrackBar soundtrack={post.soundtrack} />
)}

{/* Body */}
<PostBodyWithIris slug={slug} postTitle={post.title}>
  <MarkdownRenderer content={post.body} />
</PostBodyWithIris>
```

Replace with:

```tsx
{/* Iris highlight hint */}
<IrisHighlightHint />

{/* Soundtrack */}
{post.soundtrack && post.soundtrack.length > 0 && (
  <SoundtrackBar soundtrack={post.soundtrack} />
)}

{/* Listen feature: card + sticky bar + body with paragraph sync */}
<ListenFeature
  slug={slug}
  postTitle={post.title}
  postBody={post.body}
  readingTime={post.reading_time}
  coverImage={post.cover_image}
/>
```

Add the import at the top of the file:

```typescript
import ListenFeature from './components/ListenFeature';
```

And remove the now-unused imports (if they were only used for the body block):
```typescript
// Remove if no longer used:
// import PostBodyWithIris from '../components/PostBodyWithIris';
// import MarkdownRenderer from '../components/MarkdownRenderer';
```
(Keep them if they're used elsewhere in the file.)

- [ ] **Step 3: Build and verify**

```bash
npm run build
```
Expected: clean build, no TypeScript errors.

- [ ] **Step 4: Test manually in the browser**

```bash
npm run dev
# Open a blog post: http://localhost:3000/the-web/[any-slug]
```

Checklist:
- [ ] Listen card appears between post header and body
- [ ] Clicking play shows loading/generating state
- [ ] After generation (~5s first time), audio starts playing
- [ ] Progress bar fills in real time
- [ ] Sticky top bar slides in at top of viewport
- [ ] Active paragraph gets teal left border highlight
- [ ] Past paragraphs fade to 50% opacity
- [ ] Page auto-scrolls to active paragraph
- [ ] Manually scrolling pauses auto-scroll; resumes after 4s
- [ ] "↓ Jump to position" scrolls back to active paragraph
- [ ] Speed toggle cycles 1× → 1.25× → 1.5× → 2×
- [ ] On mobile: bar shows two-row layout
- [ ] Lock screen controls appear (play/pause, +30s/-15s)
- [ ] Audio continues when screen locks (test on mobile)
- [ ] Second visit to same post: audio loads instantly (no generation wait)

- [ ] **Step 5: Commit**

```bash
git add src/app/the-web/[slug]/components/ListenFeature.tsx src/app/the-web/[slug]/page.tsx
git commit -m "feat: integrate listen feature into blog post page"
```

---

## Task 9: Final polish + push

- [ ] **Step 1: Add `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` to `.env.example`**

Open `.env.example` and add:
```
ELEVENLABS_API_KEY=         # ElevenLabs API key
ELEVENLABS_VOICE_ID=        # Cloned voice ID from ElevenLabs dashboard
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```
Fix any warnings.

- [ ] **Step 3: Final build**

```bash
npm run build
```

- [ ] **Step 4: Commit + push**

```bash
git add .env.example
git commit -m "chore: document ElevenLabs env vars in .env.example"
git push
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ ElevenLabs TTS + recorded audio (both handled in API route)
- ✅ On-demand generation with Supabase Storage caching
- ✅ Seamless — no UI distinction between TTS and recorded
- ✅ Rich listen card (Option B design)
- ✅ Sticky top bar with desktop + mobile breakpoints
- ✅ Paragraph highlighting (teal border + glow, past paragraphs faded)
- ✅ Auto-scroll with manual-scroll pause + 4s resume
- ✅ Media Session API for background/lock screen playback
- ✅ Speed toggle (1×/1.25×/1.5×/2×)
- ✅ "Jump to position" button
- ✅ DB migration + type updates
- ✅ Rate limiting (in-memory generation lock in API route)
- ✅ Error states throughout

**Known limitation:** For recorded audio, paragraph timestamps are estimated from audio duration + word count ratio (not true alignment). ElevenLabs does not provide a standalone alignment API. This gives approximate sync which is good enough for the use case.
