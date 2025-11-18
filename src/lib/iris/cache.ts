/**
 * Cache System Interface for Future Enhancement
 * 
 * Provides hooks for caching Iris answers to improve response times.
 * Currently implemented as no-ops with clear TODOs for future integration
 * with persistent cache solutions like Upstash Redis or LRU cache.
 */

export interface IrisCache {
  /**
   * Retrieve a cached answer for the given query
   * @param query - The normalized query string
   * @returns Cached answer or undefined if not found/expired
   */
  get(query: string): Promise<string | undefined>;
  
  /**
   * Store an answer in the cache
   * @param query - The normalized query string  
   * @param answer - The complete answer to cache
   * @param ttlSec - Time to live in seconds (optional)
   */
  set(query: string, answer: string, ttlSec?: number): Promise<void>;
  
  /**
   * Check if a query should be cached
   * @param query - The query to evaluate
   * @returns Whether this query type should be cached
   */
  shouldCache(query: string): boolean;
  
  /**
   * Clear cache entries (for maintenance or debugging)
   * @param pattern - Optional pattern to match keys for deletion
   */
  clear(pattern?: string): Promise<void>;
  
  /**
   * Get cache statistics
   * @returns Usage and performance metrics
   */
  getStats(): Promise<{
    hits: number;
    misses: number;
    size: number;
    hitRate: number;
  }>;
}

/**
 * Normalize query string for consistent cache keys
 * Handles case, whitespace, and punctuation standardization
 */
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ');    // Normalize whitespace
}

/**
 * Check if query contains time-sensitive keywords that should skip cache
 */
function isTimeSensitive(query: string): boolean {
  const timeSensitiveKeywords = [
    'today', 'now', 'current', 'recent', 'latest', 'this week', 'this month',
    'currently', 'right now', 'at the moment', 'these days', 'lately'
  ];
  
  const normalizedQuery = query.toLowerCase();
  return timeSensitiveKeywords.some(keyword => normalizedQuery.includes(keyword));
}

/**
 * In-memory cache for development and fallback
 * TODO: Replace with persistent solution for production
 */
class InMemoryCache implements IrisCache {
  private cache = new Map<string, { answer: string; expiry: number }>();
  private stats = { hits: 0, misses: 0 };
  
  async get(query: string): Promise<string | undefined> {
    const key = normalizeQuery(query);
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }
    
    // Check expiry
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }
    
    this.stats.hits++;
    return entry.answer;
  }
  
  async set(query: string, answer: string, ttlSec: number = 3600): Promise<void> {
    if (!this.shouldCache(query)) {
      return;
    }
    
    const key = normalizeQuery(query);
    const expiry = Date.now() + (ttlSec * 1000);
    
    this.cache.set(key, { answer, expiry });
    
    // Prevent unbounded growth
    if (this.cache.size > 1000) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }
  
  shouldCache(query: string): boolean {
    return !isTimeSensitive(query) && query.trim().length >= 5 && query.length <= 200;
  }
  
  async clear(pattern?: string): Promise<void> {
    if (pattern) {
      // Simple pattern matching for in-memory cache
      const regex = new RegExp(pattern.replace('*', '.*'));
      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
  
  async getStats(): Promise<{
    hits: number;
    misses: number;
    size: number; 
    hitRate: number;
  }> {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;
    
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate
    };
  }
}

/**
 * Upstash Redis cache for production
 * Uses Upstash's HTTP-based Redis for serverless environments
 */
class UpstashCache implements IrisCache {
  // Lazy import to avoid requiring env vars at build time
  private redis: unknown = null;
  private stats = { hits: 0, misses: 0 };

  private async getRedis() {
    if (!this.redis) {
      const { Redis } = await import('@upstash/redis');
      this.redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });
    }
    return this.redis;
  }

  async get(query: string): Promise<string | undefined> {
    try {
      const redis = await this.getRedis() as { get: (key: string) => Promise<string | null> };
      const key = normalizeQuery(query);
      const value = await redis.get(`iris:answer:${key}`);

      if (value) {
        this.stats.hits++;
        return value as string;
      }

      this.stats.misses++;
      return undefined;
    } catch (error) {
      console.warn('[UpstashCache] Get failed:', error);
      this.stats.misses++;
      return undefined;
    }
  }

  async set(query: string, answer: string, ttlSec: number = 3600): Promise<void> {
    if (!this.shouldCache(query)) {
      return;
    }

    try {
      // Upstash Redis REST API uses set() with expiration option, not setex()
      const redis = await this.getRedis() as { set: (key: string, value: string, options?: { ex?: number }) => Promise<unknown> };
      const key = normalizeQuery(query);
      await redis.set(`iris:answer:${key}`, answer, { ex: ttlSec });
    } catch (error) {
      console.warn('[UpstashCache] Set failed:', error);
      // Non-critical error, continue without caching
    }
  }

  shouldCache(query: string): boolean {
    return !isTimeSensitive(query) && query.trim().length >= 5 && query.length <= 200;
  }

  async clear(pattern?: string): Promise<void> {
    try {
      const redis = await this.getRedis() as { keys: (pattern: string) => Promise<string[]>; del: (...keys: string[]) => Promise<unknown> };
      const keyPattern = pattern || 'iris:answer:*';

      // Upstash doesn't support SCAN in REST API, so we use KEYS (ok for small cache)
      const keys = await redis.keys(keyPattern);
      if (keys && keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.warn('[UpstashCache] Clear failed:', error);
    }
  }

  async getStats(): Promise<{
    hits: number;
    misses: number;
    size: number;
    hitRate: number;
  }> {
    try {
      const redis = await this.getRedis() as { keys: (pattern: string) => Promise<string[]> };
      const keys = await redis.keys('iris:answer:*');
      const total = this.stats.hits + this.stats.misses;
      const hitRate = total > 0 ? this.stats.hits / total : 0;

      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        size: keys ? keys.length : 0,
        hitRate
      };
    } catch (error) {
      console.warn('[UpstashCache] GetStats failed:', error);
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        size: 0,
        hitRate: 0
      };
    }
  }
}

/**
 * Singleton cache instance
 * Automatically configured based on environment
 */
let cacheInstance: IrisCache | null = null;

/**
 * Get the configured cache instance
 * Lazy initialization with environment-appropriate backend
 */
export function getIrisCache(): IrisCache {
  if (!cacheInstance) {
    // Production: Use Upstash if configured, otherwise fall back to in-memory
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      console.log('[IrisCache] Using Upstash Redis cache');
      cacheInstance = new UpstashCache();
    }
    // Development: Use in-memory cache
    else if (process.env.NODE_ENV === 'development') {
      console.log('[IrisCache] Using in-memory cache (development)');
      cacheInstance = new InMemoryCache();
    }
    // Fallback: In-memory for production without Upstash
    else {
      console.log('[IrisCache] Using in-memory cache (Upstash not configured)');
      cacheInstance = new InMemoryCache();
    }
  }

  return cacheInstance;
}

/**
 * Main cache interface for the answer API
 * Provides the primary methods used by the answer generation system
 */
export const irisCache: IrisCache = {
  async get(query: string): Promise<string | undefined> {
    return await getIrisCache().get(query);
  },
  
  async set(query: string, answer: string, ttlSec?: number): Promise<void> {
    return await getIrisCache().set(query, answer, ttlSec);
  },
  
  shouldCache(query: string): boolean {
    return getIrisCache().shouldCache(query);
  },
  
  async clear(pattern?: string): Promise<void> {
    return await getIrisCache().clear(pattern);
  },
  
  async getStats(): Promise<{
    hits: number;
    misses: number;
    size: number;
    hitRate: number;
  }> {
    return await getIrisCache().getStats();
  }
};

/**
 * Utility functions for cache key management
 */
export const cacheUtils = {
  normalize: normalizeQuery,
  isTimeSensitive,
  
  /**
   * Generate a cache key with optional prefix
   */
  generateKey(query: string, prefix: string = 'iris:answer'): string {
    return `${prefix}:${normalizeQuery(query)}`;
  },
  
  /**
   * Extract query from cache key
   */
  extractQuery(key: string, prefix: string = 'iris:answer'): string {
    return key.replace(`${prefix}:`, '');
  }
};

/**
 * Future cache enhancements:
 *
 * 1. ✅ Redis Integration (DONE)
 *    - ✅ Upstash Redis implementation
 *    - ✅ Graceful error handling
 *    - ✅ Automatic fallback to in-memory
 *
 * 2. Cache Invalidation (TODO):
 *    - Invalidate cache when KB updates
 *    - Version-based invalidation strategy
 *    - Manual invalidation endpoints
 *
 * 3. Performance Monitoring (TODO):
 *    - Add detailed timing metrics
 *    - Track cache effectiveness per query type
 *    - Monitor memory usage
 *    - Alert on cache failures
 *
 * 4. Advanced Features (TODO):
 *    - Semantic similarity for cache hits (similar queries → same answer)
 *    - Partial answer caching
 *    - Precomputed popular answers
 *    - Cache warming strategies
 */
