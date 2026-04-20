// src/app/api/the-web/[slug]/audio/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { env } from '@/lib/env';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import {
  stripMarkdownToParagraphs,
  estimateParagraphTimestamps,
  ElevenLabsAlignment,
  AudioTimestamps,
  ParagraphTimestamp,
} from '@/lib/audioUtils';

export const runtime = 'nodejs';
export const maxDuration = 60; // seconds — ElevenLabs generation can take up to 30s

// Redis-based generation lock: survives serverless cold starts, prevents duplicate ElevenLabs calls
function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

type RouteParams = { params: Promise<{ slug: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }

  const ip = getClientIp(req);
  const userAgent = req.headers.get('user-agent') ?? '';
  const rateLimit = checkRateLimit(ip, userAgent);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many requests' },
      { status: 429 },
    );
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

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

    // 2. Rate limit: only one generation per slug at a time (Redis NX lock, 60s TTL)
    const redis = getRedis();
    const lockKey = `audio-gen-lock:${slug}`;
    if (redis) {
      const acquired = await redis.set(lockKey, '1', { nx: true, ex: 60 });
      if (!acquired) {
        return NextResponse.json(
          { error: 'audio_generating', message: 'Audio is already being generated, try again shortly.' },
          { status: 429 },
        );
      }
    }

    // 3. Validate ElevenLabs is configured
    if (!env.elevenLabsApiKey || !env.elevenLabsVoiceId) {
      if (redis) await redis.del(lockKey);
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
      if (redis) await redis.del(lockKey);
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    try {
      // Prefer client-provided paragraphs (collected from the rendered DOM — exact alignment).
      // Fall back to server-side stripping if the client didn't send any.
      let clientParagraphs: string[] = [];
      try {
        const body = await req.json() as { paragraphs?: unknown };
        if (Array.isArray(body.paragraphs)) {
          clientParagraphs = (body.paragraphs as unknown[])
            .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
            .map((p) => p.trim());
        }
      } catch {
        // No body or invalid JSON — use server-side fallback
      }
      const paragraphs = clientParagraphs.length > 0
        ? clientParagraphs
        : stripMarkdownToParagraphs(postData.body as string);

      let timestamps: AudioTimestamps;
      let audioBuffer: ArrayBuffer;

      if ((postData as { body: string; recorded_audio_url?: string | null }).recorded_audio_url) {
        const recordedUrl = (postData as { body: string; recorded_audio_url: string }).recorded_audio_url;
        // Recorded audio: download file, estimate paragraph timestamps from duration
        const audioResponse = await fetch(recordedUrl);
        if (!audioResponse.ok) throw new Error('Failed to fetch recorded audio');
        audioBuffer = await audioResponse.arrayBuffer();

        // Estimate duration from file size (rough: ~128kbps mp3 = 16KB/s)
        const estimatedDuration = audioBuffer.byteLength / 16000;
        timestamps = estimateParagraphTimestamps(paragraphs, estimatedDuration);
      } else {
        // TTS: call ElevenLabs per-paragraph so each paragraph gets its own exact
        // alignment data. Batched at 5 concurrent to stay under ElevenLabs' limit.
        const ELEVENLABS_CONCURRENCY = 5;
        const paraResults: { buf: Buffer; paraDuration: number }[] = [];
        for (let i = 0; i < paragraphs.length; i += ELEVENLABS_CONCURRENCY) {
          const batch = paragraphs.slice(i, i + ELEVENLABS_CONCURRENCY);
          const batchResults = await Promise.all(batch.map(async (para) => {
            const resp = await fetch(
              `https://api.elevenlabs.io/v1/text-to-speech/${env.elevenLabsVoiceId}/with-timestamps`,
              {
                method: 'POST',
                headers: {
                  'xi-api-key': env.elevenLabsApiKey,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  text: para,
                  model_id: 'eleven_turbo_v2_5',
                  voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                    speed: 0.9,
                  },
                }),
              },
            );
            if (!resp.ok) {
              const errText = await resp.text();
              console.error('[audio] ElevenLabs paragraph error:', errText);
              throw new Error('ElevenLabs API request failed');
            }
            const data = await resp.json() as {
              audio_base64: string;
              alignment: ElevenLabsAlignment;
            };
            const buf = Buffer.from(data.audio_base64, 'base64');
            const paraDuration = data.alignment.character_end_times_seconds.at(-1) ?? 0;
            return { buf, paraDuration };
          }));
          paraResults.push(...batchResults);
        }

        // Concatenate all paragraph buffers into one mp3
        const combined = Buffer.concat(paraResults.map((r) => r.buf));
        audioBuffer = combined.buffer.slice(combined.byteOffset, combined.byteOffset + combined.byteLength);

        // Build timestamps as exact cumulative sums
        let offset = 0;
        const totalDuration = paraResults.reduce((sum, r) => sum + r.paraDuration, 0);
        const tsParas: ParagraphTimestamp[] = paragraphs.map((para, i) => {
          const start = offset;
          const end = offset + paraResults[i].paraDuration;
          offset = end;
          return { index: i, start, end, text: para.slice(0, 100) };
        });
        timestamps = { paragraphs: tsParas, duration: totalDuration };
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
      if (redis) await redis.del(lockKey);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[audio] Generation error:', message);
    return NextResponse.json(
      { error: 'audio_unavailable', message: 'Failed to generate audio.' },
      { status: 503 },
    );
  }
}
