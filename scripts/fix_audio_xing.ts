/**
 * Fixes cached blog audio files by stripping embedded Xing/Info/VBRI metadata
 * frames. Each ElevenLabs batch embeds its own Xing header; concatenated files
 * therefore confuse the browser into thinking the total duration is just the
 * first batch. Stripping yields a clean CBR stream that seeks correctly.
 *
 * Usage:
 *   npx tsx scripts/fix_audio_xing.ts <slug>          # analyze only (dry run)
 *   npx tsx scripts/fix_audio_xing.ts <slug> --apply  # strip + re-upload
 *   npx tsx scripts/fix_audio_xing.ts --all           # analyze every post with audio
 *   npx tsx scripts/fix_audio_xing.ts --all --apply   # fix every post with audio
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { getMp3DurationSeconds, stripMetadataFrames } from '../src/lib/audioUtils';

function countMetadataFrames(buf: Buffer): { metadata: number; audio: number } {
  const BITRATES_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
  const BITRATES_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
  const SAMPLE_RATES = [44100, 48000, 32000, 0];
  let metadata = 0;
  let audio = 0;
  let i = 0;
  while (i < buf.length - 3) {
    if (buf[i] !== 0xFF || (buf[i + 1] & 0xE0) !== 0xE0) { i++; continue; }
    const b1 = buf[i + 1];
    const b2 = buf[i + 2];
    const mpegVersion = (b1 >> 3) & 0x3;
    if (mpegVersion === 1) { i++; continue; }
    const layer = (b1 >> 1) & 0x3;
    if (layer !== 1) { i++; continue; }
    const bitrateIdx = (b2 >> 4) & 0xF;
    const srIdx = (b2 >> 2) & 0x3;
    if (bitrateIdx === 0 || bitrateIdx === 15 || srIdx === 3) { i++; continue; }
    const isMpeg1 = mpegVersion === 3;
    const bitrate = (isMpeg1 ? BITRATES_V1[bitrateIdx] : BITRATES_V2[bitrateIdx]) * 1000;
    const sr = isMpeg1 ? SAMPLE_RATES[srIdx] : SAMPLE_RATES[srIdx] / 2;
    const samplesPerFrame = isMpeg1 ? 1152 : 576;
    const padding = (b2 >> 1) & 0x1;
    const frameSize = Math.floor(samplesPerFrame * bitrate / (8 * sr)) + padding;
    if (frameSize < 4) { i++; continue; }
    const b3 = buf[i + 3];
    const isMono = ((b3 >> 6) & 0x3) === 3;
    const xingOff = isMpeg1 ? (isMono ? 21 : 36) : (isMono ? 13 : 21);
    let isMeta = false;
    if (i + xingOff + 4 <= buf.length) {
      const tag = buf.slice(i + xingOff, i + xingOff + 4).toString('latin1');
      isMeta = tag === 'Xing' || tag === 'Info' || tag === 'VBRI';
    }
    if (isMeta) metadata++; else audio++;
    i += frameSize;
  }
  return { metadata, audio };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdmin = any;

async function processSlug(
  admin: SupabaseAdmin,
  slug: string,
  apply: boolean,
): Promise<void> {
  console.log(`\n━━━ ${slug} ━━━`);
  const { data: dl, error: dlErr } = await admin.storage.from('blog-audio').download(`${slug}/audio.mp3`);
  if (dlErr || !dl) {
    console.log(`  ✗ no audio.mp3: ${dlErr?.message ?? 'not found'}`);
    return;
  }
  const original = Buffer.from(await dl.arrayBuffer());
  const before = countMetadataFrames(original);
  const durBefore = getMp3DurationSeconds(original);
  console.log(`  original: ${original.length} bytes, ${before.audio} audio frames, ${before.metadata} metadata frames, ${durBefore.toFixed(2)}s`);

  if (before.metadata === 0) {
    console.log(`  ✓ already clean — nothing to fix`);
    return;
  }
  if (before.metadata === 1) {
    console.log(`  ℹ only one Xing header (normal) — likely not the seek bug`);
  } else {
    console.log(`  ✗ FOUND ${before.metadata} Xing headers — this IS the seek bug (one per batch)`);
  }

  const stripped = stripMetadataFrames(original);
  const after = countMetadataFrames(stripped);
  const durAfter = getMp3DurationSeconds(stripped);
  console.log(`  stripped: ${stripped.length} bytes, ${after.audio} audio frames, ${after.metadata} metadata frames, ${durAfter.toFixed(2)}s`);

  if (after.audio !== before.audio) {
    console.log(`  ⚠ audio frame count changed (${before.audio} → ${after.audio}) — aborting`);
    return;
  }
  if (Math.abs(durAfter - durBefore) > 0.1) {
    console.log(`  ⚠ duration changed (${durBefore.toFixed(2)} → ${durAfter.toFixed(2)}) — aborting`);
    return;
  }

  if (!apply) {
    console.log(`  ▸ dry run — pass --apply to re-upload the stripped file`);
    return;
  }

  const { error: upErr } = await admin.storage
    .from('blog-audio')
    .upload(`${slug}/audio.mp3`, stripped, { contentType: 'audio/mpeg', upsert: true });
  if (upErr) {
    console.log(`  ✗ upload failed: ${upErr.message}`);
    return;
  }
  console.log(`  ✓ re-uploaded cleaned audio (${stripped.length} bytes)`);
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const all = args.includes('--all');
  const slug = args.find((a) => !a.startsWith('--'));

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  const admin = createClient(url, key);

  if (all) {
    const { data: posts, error } = await admin
      .from('blog_posts')
      .select('slug')
      .eq('has_audio', true);
    if (error) { console.error(error.message); process.exit(1); }
    if (!posts?.length) { console.log('No posts with audio found.'); return; }
    console.log(`Found ${posts.length} post(s) with audio.`);
    for (const p of posts as Array<{ slug: string }>) {
      await processSlug(admin, p.slug, apply);
    }
    return;
  }

  if (!slug) {
    console.error('Pass a slug or --all. Add --apply to actually re-upload.');
    process.exit(1);
  }
  await processSlug(admin, slug, apply);
}

main().catch((e) => { console.error(e); process.exit(1); });
