/**
 * sync_soundtracks.ts
 *
 * Auto-generates blog post soundtracks from music moments data.
 * For each published post, finds music moments whose dateRange overlaps
 * with the 7-day window ending on the post's published_at date.
 *
 * Usage:  npx tsx scripts/sync_soundtracks.ts
 *         npx tsx scripts/sync_soundtracks.ts --dry-run
 *
 * Required env vars (loaded from .env.local):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MusicMoment {
  id: string;
  trackName: string;
  artist: string;
  album: string;
  trackUri: string;
  albumArtUrl: string;
  spotifyUrl: string;
  dateRange: { start: string; end: string };
  playCount: number;
  weeksCount: number;
  intensity: number;
  maxState: number;
}

interface SoundtrackTrack {
  trackUri: string;
  trackName: string;
  artist: string;
  albumArtUrl: string;
}

interface BlogPostRow {
  slug: string;
  title: string;
  published_at: string;
  soundtrack: SoundtrackTrack[] | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if two date ranges overlap.
 * Blog window: [postDate - 7 days, postDate]
 * Music range: [moment.dateRange.start, moment.dateRange.end]
 */
function dateRangesOverlap(
  blogStart: Date,
  blogEnd: Date,
  momentStart: Date,
  momentEnd: Date,
): boolean {
  return blogStart <= momentEnd && momentStart <= blogEnd;
}

function daysAgo(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function parseDate(dateStr: string): Date {
  // Handle both "2026-03-23" and "2026-03-23T..." formats
  return new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00Z'));
}

// Deduplicate by trackUri (same track may appear in multiple moments)
function deduplicateTracks(tracks: SoundtrackTrack[]): SoundtrackTrack[] {
  const seen = new Set<string>();
  return tracks.filter((t) => {
    if (seen.has(t.trackUri)) return false;
    seen.add(t.trackUri);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  // Validate env
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  // Load music moments
  const momentsPath = path.join(process.cwd(), 'src/data/spotify/music-moments.json');
  if (!fs.existsSync(momentsPath)) {
    console.error('❌ Music moments file not found:', momentsPath);
    process.exit(1);
  }
  const moments: MusicMoment[] = JSON.parse(fs.readFileSync(momentsPath, 'utf-8'));
  console.log(`📀 Loaded ${moments.length} music moments`);

  // Connect to Supabase
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Fetch all published posts
  const { data: posts, error } = await supabase
    .from('blog_posts')
    .select('slug, title, published_at, soundtrack')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (error) {
    console.error('❌ Failed to fetch blog posts:', error.message);
    process.exit(1);
  }

  if (!posts || posts.length === 0) {
    console.log('📝 No published blog posts found');
    return;
  }

  console.log(`📝 Found ${posts.length} published posts\n`);

  let updated = 0;
  let skipped = 0;

  for (const post of posts as BlogPostRow[]) {
    const publishedAt = parseDate(post.published_at);
    const windowStart = daysAgo(publishedAt, 7);
    const windowEnd = publishedAt;

    // Find overlapping music moments
    const matching = moments
      .filter((m) => {
        const mStart = parseDate(m.dateRange.start);
        const mEnd = parseDate(m.dateRange.end);
        return dateRangesOverlap(windowStart, windowEnd, mStart, mEnd);
      })
      // Sort by playCount * intensity (most impactful first)
      .sort((a, b) => b.playCount * b.intensity - a.playCount * a.intensity);

    // Build soundtrack
    const soundtrack: SoundtrackTrack[] = deduplicateTracks(
      matching.map((m) => ({
        trackUri: m.trackUri,
        trackName: m.trackName,
        artist: m.artist,
        albumArtUrl: m.albumArtUrl,
      })),
    );

    // Check if anything changed
    const existingUris = (post.soundtrack || []).map((t: SoundtrackTrack) => t.trackUri).sort();
    const newUris = soundtrack.map((t) => t.trackUri).sort();
    const unchanged = JSON.stringify(existingUris) === JSON.stringify(newUris);

    const windowStr = `${windowStart.toISOString().slice(0, 10)} → ${windowEnd.toISOString().slice(0, 10)}`;

    if (soundtrack.length === 0) {
      console.log(`  ⸱ "${post.title}" (${windowStr}) — no matching music`);
      skipped++;
      continue;
    }

    if (unchanged) {
      console.log(`  ✓ "${post.title}" — ${soundtrack.length} tracks (unchanged)`);
      skipped++;
      continue;
    }

    console.log(`  → "${post.title}" (${windowStr})`);
    for (const t of soundtrack) {
      console.log(`    ♪ ${t.trackName} — ${t.artist}`);
    }

    if (!dryRun) {
      const { error: updateErr } = await supabase
        .from('blog_posts')
        .update({ soundtrack })
        .eq('slug', post.slug);

      if (updateErr) {
        console.error(`    ❌ Failed to update: ${updateErr.message}`);
      } else {
        console.log(`    ✅ Updated (${soundtrack.length} tracks)`);
        updated++;
      }
    } else {
      console.log(`    [dry-run] Would update with ${soundtrack.length} tracks`);
      updated++;
    }
  }

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Done: ${updated} updated, ${skipped} skipped`);
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
