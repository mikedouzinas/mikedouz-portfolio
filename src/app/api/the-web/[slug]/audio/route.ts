// src/app/api/the-web/[slug]/audio/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
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
      const paragraphs = stripMarkdownToParagraphs(postData.body as string);
      const plainText = paragraphs.join('\n\n');
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
        audioBuffer = Buffer.from(elevenData.audio_base64, 'base64').buffer;

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
    console.error('[audio] Generation error:', error);
    return NextResponse.json(
      { error: 'audio_unavailable', message: 'Failed to generate audio.' },
      { status: 503 },
    );
  }
}
