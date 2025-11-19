/**
 * Cache Clear API Endpoint
 * 
 * Clears the Iris answer cache. Useful for development when you've made
 * changes to the knowledge base or answer generation logic.
 * 
 * This endpoint can clear:
 * - In-memory cache (development)
 * - Upstash Redis cache (production)
 * 
 * Usage:
 *   POST /api/iris/cache/clear
 *   POST /api/iris/cache/clear?pattern=internship
 */

import { NextRequest, NextResponse } from 'next/server';
import { irisCache } from '@/lib/iris/cache';

export async function POST(req: NextRequest) {
  try {
    // Get optional pattern from query params
    const { searchParams } = new URL(req.url);
    const pattern = searchParams.get('pattern') || undefined;

    // Get cache stats before clearing
    const statsBefore = await irisCache.getStats();

    // Clear cache
    if (pattern) {
      await irisCache.clear(pattern);
    } else {
      await irisCache.clear();
    }

    // Get cache stats after clearing
    const statsAfter = await irisCache.getStats();
    const clearedCount = statsBefore.size - statsAfter.size;

    return NextResponse.json({
      success: true,
      message: `Cleared ${clearedCount} cache entries`,
      stats: {
        before: {
          size: statsBefore.size,
          hits: statsBefore.hits,
          misses: statsBefore.misses,
          hitRate: statsBefore.hitRate
        },
        after: {
          size: statsAfter.size,
          hits: statsAfter.hits,
          misses: statsAfter.misses,
          hitRate: statsAfter.hitRate
        },
        cleared: clearedCount
      }
    });
  } catch (error) {
    console.error('[Cache Clear API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Also support GET for convenience (though POST is more RESTful)
export async function GET(req: NextRequest) {
  return POST(req);
}

