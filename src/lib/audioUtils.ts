/**
 * Removes Xing/Info/VBRI metadata frames from an MP3 buffer.
 *
 * ElevenLabs embeds a Xing/Info header at the start of every generated MP3. That
 * header tells the browser "this file has N frames." When we concatenate multiple
 * batch MP3s the browser reads Batch 1's header and thinks the whole file is
 * Batch-1-duration long — so seeking is clamped to the first batch. Stripping
 * these frames leaves a pure CBR audio stream; browsers seek CBR by byte-offset
 * arithmetic and correctly cover the full file length.
 */
export function stripMetadataFrames(buf: Buffer): Buffer {
  const BITRATES_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
  const BITRATES_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
  const SAMPLE_RATES = [44100, 48000, 32000, 0];

  const keep: Array<{ start: number; end: number }> = [];
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
    let isMetadata = false;
    if (i + xingOff + 4 <= buf.length) {
      const tag = buf.slice(i + xingOff, i + xingOff + 4).toString('latin1');
      isMetadata = tag === 'Xing' || tag === 'Info' || tag === 'VBRI';
    }

    if (!isMetadata) keep.push({ start: i, end: i + frameSize });
    i += frameSize;
  }

  if (keep.length === 0) return buf;

  const total = keep.reduce((sum, r) => sum + (r.end - r.start), 0);
  const out = Buffer.allocUnsafe(total);
  let offset = 0;
  for (const r of keep) {
    buf.copy(out, offset, r.start, r.end);
    offset += r.end - r.start;
  }
  return out;
}

/**
 * Parses an MP3 buffer frame-by-frame to measure its exact playable duration.
 * More accurate than using ElevenLabs' character_end_times_seconds, which doesn't
 * account for trailing silence or encoder padding after the last spoken character.
 */
export function getMp3DurationSeconds(buf: Buffer): number {
  // Bitrate tables (kbps) indexed by header bits [4..7] of byte 2
  const BITRATES_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
  const BITRATES_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
  const SAMPLE_RATES = [44100, 48000, 32000, 0];

  let totalSamples = 0;
  let sampleRate = 44100;
  let i = 0;

  while (i < buf.length - 3) {
    if (buf[i] !== 0xFF || (buf[i + 1] & 0xE0) !== 0xE0) { i++; continue; }

    const b1 = buf[i + 1];
    const b2 = buf[i + 2];
    const mpegVersion = (b1 >> 3) & 0x3; // 3=MPEG1, 2=MPEG2, 0=MPEG2.5, 1=reserved
    if (mpegVersion === 1) { i++; continue; }

    const layer = (b1 >> 1) & 0x3; // 1=LayerIII, 2=LayerII, 3=LayerI
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

    // Skip Xing/INFO/VBRI metadata frames — they have a valid MP3 header but contain
    // no audio. Counting them as 1152 samples would overestimate duration by ~26ms/chunk.
    const b3 = buf[i + 3];
    const isMono = ((b3 >> 6) & 0x3) === 3;
    const xingOff = isMpeg1 ? (isMono ? 21 : 36) : (isMono ? 13 : 21);
    if (i + xingOff + 4 <= buf.length) {
      const tag = buf.slice(i + xingOff, i + xingOff + 4).toString('latin1');
      if (tag === 'Xing' || tag === 'Info' || tag === 'VBRI') {
        i += frameSize;
        continue;
      }
    }

    sampleRate = sr;
    totalSamples += samplesPerFrame;
    i += frameSize;
  }

  return sampleRate > 0 ? totalSamples / sampleRate : 0;
}

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
    .replace(/```[\s\S]*?```/g, '')          // fenced code blocks
    .replace(/`[^`]+`/g, '')                 // inline code
    .replace(/#{1,6}\s+(.+)/g, '$1')         // headings → keep text
    .replace(/\*\*([^*]+)\*\*/g, '$1')       // bold
    .replace(/\*([^*]+)\*/g, '$1')           // italic
    .replace(/__([^_]+)__/g, '$1')           // double-underscore bold
    .replace(/_([^_]+)_/g, '$1')             // underscore italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/^[-*+]\s+/gm, '')              // unordered list markers
    .replace(/^\d+\.\s+/gm, '')              // ordered list markers
    .replace(/^>\s+/gm, '')                  // blockquotes
    // Hoverdef: keep the visible text (first field), discard the definition payload.
    // Syntax: ::visible text|definition|key=value...::
    .replace(/::([^|:]+)\|[\s\S]*?::/g, '$1')
    .replace(/^[-*_]{3,}\s*$/gm, '')         // horizontal rules
    .replace(/<[^>]+>/g, '')                  // HTML tags
    .replace(/\n{3,}/g, '\n\n')              // collapse excess newlines
    .trim();

  return stripped
    .split(/\n\n+/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter((p) => p.length > 0); // only skip truly empty strings
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
    searchOffset = charIndex + para.length;

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
