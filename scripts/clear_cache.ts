/**
 * Clear Iris Cache Utility
 * 
 * Clears all cached answers from both in-memory and Upstash Redis caches.
 * 
 * IMPORTANT: For in-memory cache (local dev server), this script calls the
 * running Next.js server's API endpoint to clear its cache. For Upstash Redis,
 * it clears directly.
 * 
 * Usage:
 *   npx tsx scripts/clear_cache.ts                    # Clear all cache
 *   npx tsx scripts/clear_cache.ts --pattern "internship"  # Clear entries matching pattern
 *   npx tsx scripts/clear_cache.ts --direct              # Clear directly (Upstash only, won't work for in-memory)
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function clearViaAPI(pattern?: string) {
  const url = new URL(`${API_URL}/api/iris/cache/clear`);
  if (pattern) {
    url.searchParams.set('pattern', pattern);
  }

  console.log(`Calling API endpoint: ${url.toString()}\n`);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`API request failed: ${error.error || response.statusText}`);
  }

  return await response.json();
}

async function clearDirectly(pattern?: string) {
  // Direct cache clearing (only works for Upstash Redis, not in-memory)
  const { irisCache } = await import('../src/lib/iris/cache');

  const statsBefore = await irisCache.getStats();
  console.log('Cache stats before clearing:');
  console.log(`  Size: ${statsBefore.size} entries`);
  console.log(`  Hits: ${statsBefore.hits}`);
  console.log(`  Misses: ${statsBefore.misses}`);
  console.log(`  Hit Rate: ${(statsBefore.hitRate * 100).toFixed(2)}%\n`);

  if (pattern) {
    console.log(`Clearing cache entries matching pattern: "${pattern}"`);
    await irisCache.clear(pattern);
  } else {
    console.log('Clearing all cache entries...');
    await irisCache.clear();
  }

  await new Promise(resolve => setTimeout(resolve, 500));

  const statsAfter = await irisCache.getStats();
  console.log('\nCache stats after clearing:');
  console.log(`  Size: ${statsAfter.size} entries`);
  console.log(`  Hits: ${statsAfter.hits}`);
  console.log(`  Misses: ${statsAfter.misses}`);
  console.log(`  Hit Rate: ${(statsAfter.hitRate * 100).toFixed(2)}%\n`);

  return {
    cleared: statsBefore.size - statsAfter.size,
    stats: { before: statsBefore, after: statsAfter }
  };
}

async function main() {
  const args = process.argv.slice(2);
  const patternArg = args.find(arg => arg.startsWith('--pattern='));
  const pattern = patternArg ? patternArg.split('=')[1] : undefined;
  const useDirect = args.includes('--direct');

  console.log('🧹 Clearing Iris cache...\n');

  try {
    let result;

    if (useDirect) {
      // Direct clearing (Upstash Redis only)
      console.log('⚠️  Using direct cache clearing (Upstash Redis only)\n');
      console.log('   Note: This won\'t clear in-memory cache in running dev server.\n');
      result = await clearDirectly(pattern);
    } else {
      // Try API endpoint first (works for both in-memory and Upstash)
      try {
        const apiResult = await clearViaAPI(pattern);
        
        // API returns: { success, message, stats: { before, after, cleared } }
        if (!apiResult.success) {
          throw new Error(apiResult.error || 'API returned unsuccessful response');
        }

        console.log('Cache stats before clearing:');
        console.log(`  Size: ${apiResult.stats.before.size} entries`);
        console.log(`  Hits: ${apiResult.stats.before.hits}`);
        console.log(`  Misses: ${apiResult.stats.before.misses}`);
        console.log(`  Hit Rate: ${(apiResult.stats.before.hitRate * 100).toFixed(2)}%\n`);
        
        if (pattern) {
          console.log(`Clearing cache entries matching pattern: "${pattern}"`);
        } else {
          console.log('Clearing all cache entries...');
        }
        
        console.log('\nCache stats after clearing:');
        console.log(`  Size: ${apiResult.stats.after.size} entries`);
        console.log(`  Hits: ${apiResult.stats.after.hits}`);
        console.log(`  Misses: ${apiResult.stats.after.misses}`);
        console.log(`  Hit Rate: ${(apiResult.stats.after.hitRate * 100).toFixed(2)}%\n`);

        result = {
          cleared: apiResult.stats.cleared,
          stats: apiResult.stats
        };
      } catch (apiError) {
        console.warn('⚠️  API endpoint failed (server may not be running)');
        console.warn('   Falling back to direct cache clearing (Upstash Redis only)\n');
        result = await clearDirectly(pattern);
      }
    }

    if (result.cleared > 0) {
      console.log(`✅ Successfully cleared ${result.cleared} cache entries!`);
    } else {
      console.log('ℹ️  No cache entries were cleared (cache may have been empty or pattern matched nothing).');
    }
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      if (error.message.includes('fetch')) {
        console.error('\n💡 Tip: Make sure your Next.js dev server is running on', API_URL);
        console.error('   Or use --direct flag for Upstash Redis only');
      }
    }
    process.exit(1);
  }
}

main();

