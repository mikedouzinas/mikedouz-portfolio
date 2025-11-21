#!/usr/bin/env tsx
/**
 * Build script to pre-compute importance rankings for all KB items
 * Outputs to src/data/iris/derived/rankings.json
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { computeRankings } from '../src/lib/iris/rankings';
import { loadKBItems } from '../src/lib/iris/load';

async function main() {
  console.log('[build_rankings] Loading KB items...');

  try {
    const allItems = await loadKBItems();
    console.log(`[build_rankings] Loaded ${allItems.length} items`);

    console.log('[build_rankings] Computing rankings...');
    const rankings = computeRankings(allItems);

    console.log('[build_rankings] Rankings computed:');
    console.log(`  - Skills: ${rankings.skills.length} items`);
    console.log(`  - Projects: ${rankings.projects.length} items`);
    console.log(`  - Experiences: ${rankings.experiences.length} items`);
    console.log(`  - Classes: ${rankings.classes.length} items`);
    console.log(`  - Blogs: ${rankings.blogs.length} items`);
    console.log(`  - Total: ${rankings.all.length} items`);

    // Show top 5 in each category
    console.log('\n[build_rankings] Top 5 by category:');

    console.log('\n  Top Skills:');
    rankings.skills.slice(0, 5).forEach((r, i) => {
      console.log(`    ${i + 1}. ${r.id} (${r.importance})`);
    });

    console.log('\n  Top Projects:');
    rankings.projects.slice(0, 5).forEach((r, i) => {
      console.log(`    ${i + 1}. ${r.id} (${r.importance})`);
    });

    console.log('\n  Top Experiences:');
    rankings.experiences.slice(0, 5).forEach((r, i) => {
      console.log(`    ${i + 1}. ${r.id} (${r.importance})`);
    });

    // Ensure derived directory exists
    const outputPath = join(process.cwd(), 'src/data/iris/derived/rankings.json');
    const dir = dirname(outputPath);
    mkdirSync(dir, { recursive: true });

    // Write rankings
    writeFileSync(
      outputPath,
      JSON.stringify(rankings, null, 2),
      'utf-8'
    );

    console.log(`\n[build_rankings] ✓ Rankings written to ${outputPath}`);
  } catch (error) {
    console.error('[build_rankings] Error:', error);
    process.exit(1);
  }
}

main();
