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
