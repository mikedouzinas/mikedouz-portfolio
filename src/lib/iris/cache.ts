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
 * Default cache implementation (no-op for v1)
 * TODO: Replace with actual cache backend (Redis/Upstash/LRU)
 */
class DefaultIrisCache implements IrisCache {
  async get(query: string): Promise<string | undefined> {
    // TODO: Implement with persistent cache
    // Example Redis implementation:
    // const key = `iris:answer:${normalizeQuery(query)}`;
    // return await redis.get(key);
    
    return undefined; // No-op for v1
  }
  
  async set(query: string, answer: string, ttlSec?: number): Promise<void> {
    // TODO: Implement with persistent cache  
    // Example Redis implementation:
    // const key = `iris:answer:${normalizeQuery(query)}`;
    // const ttl = ttlSec || 3600; // Default 1 hour
    // await redis.setex(key, ttl, answer);
    
    // No-op for v1
  }
  
  shouldCache(query: string): boolean {
    // Don't cache time-sensitive queries
    if (isTimeSensitive(query)) {
      return false;
    }
    
    // Don't cache very short queries (likely too generic)
    if (query.trim().length < 5) {
      return false;
    }
    
    // Don't cache very long queries (likely too specific)
    if (query.length > 200) {
      return false;
    }
    
    return true;
  }
  
  async clear(pattern?: string): Promise<void> {
    // TODO: Implement cache clearing
    // Example Redis implementation:
    // const keys = await redis.keys(pattern || 'iris:answer:*');
    // if (keys.length > 0) {
    //   await redis.del(...keys);
    // }
    
    // No-op for v1
  }
  
  async getStats(): Promise<{
    hits: number;
    misses: number; 
    size: number;
    hitRate: number;
  }> {
    // TODO: Track and return real statistics
    // Example implementation:
    // const hits = await redis.get('iris:stats:hits') || '0';
    // const misses = await redis.get('iris:stats:misses') || '0';
    // const size = await redis.dbsize();
    
    return {
      hits: 0,
      misses: 0,
      size: 0,
      hitRate: 0
    };
  }
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
      this.cache.delete(oldestKey);
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
 * Singleton cache instance
 * TODO: Configure based on environment (Redis in prod, memory in dev)
 */
let cacheInstance: IrisCache | null = null;

/**
 * Get the configured cache instance
 * Lazy initialization with environment-appropriate backend
 */
export function getIrisCache(): IrisCache {
  if (!cacheInstance) {
    // TODO: Initialize based on environment
    // if (process.env.REDIS_URL) {
    //   cacheInstance = new RedisIrisCache(process.env.REDIS_URL);
    // } else if (process.env.UPSTASH_REDIS_REST_URL) {
    //   cacheInstance = new UpstashIrisCache();
    // } else {
    //   cacheInstance = new InMemoryCache();
    // }
    
    // For v1, use in-memory cache in development, no-op in production
    if (process.env.NODE_ENV === 'development') {
      cacheInstance = new InMemoryCache();
    } else {
      cacheInstance = new DefaultIrisCache();
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
 * TODO List for future cache implementation:
 * 
 * 1. Redis Integration:
 *    - Add @upstash/redis dependency
 *    - Implement RedisIrisCache class
 *    - Handle connection errors gracefully
 *    - Add Redis health checks
 * 
 * 2. Cache Invalidation:
 *    - Invalidate cache when KB updates
 *    - Version-based invalidation strategy
 *    - Manual invalidation endpoints
 * 
 * 3. Performance Monitoring:
 *    - Add detailed timing metrics
 *    - Track cache effectiveness
 *    - Monitor memory usage
 *    - Alert on cache failures
 * 
 * 4. Advanced Features:
 *    - Semantic similarity for cache hits
 *    - Partial answer caching
 *    - Precomputed popular answers
 *    - Cache warming strategies
 */