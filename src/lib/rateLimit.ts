/**
 * Simple in-memory rate limiter
 * Uses IP + User-Agent hash to track request counts
 * 
 * Note: This is an in-memory implementation suitable for single-server deployments
 * For production with multiple servers, consider Redis-based rate limiting
 */

import { createHash } from 'crypto';

/**
 * Rate limit configuration
 */
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 seconds
const RATE_LIMIT_MAX_REQUESTS = 3; // Max requests per window

/**
 * Track requests by hashed identifier
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Generate a consistent hash from IP and User-Agent
 * This provides basic rate limiting without storing PII
 * 
 * @param ip - Client IP address
 * @param userAgent - User-Agent header
 * @returns Hashed identifier
 */
function hashIdentifier(ip: string, userAgent: string): string {
  const combined = `${ip}:${userAgent}`;
  return createHash('sha256').update(combined).digest('hex').substring(0, 16);
}

/**
 * Check if request should be rate limited
 * 
 * @param ip - Client IP address
 * @param userAgent - User-Agent header
 * @returns Object with allowed status and remaining requests
 */
export function checkRateLimit(ip: string, userAgent: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const identifier = hashIdentifier(ip, userAgent);
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);
  
  // Clean up expired entries periodically
  if (rateLimitStore.size > 1000) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }
  
  // No entry or expired: allow and create new window
  if (!entry || entry.resetAt < now) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt,
    });
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetAt,
    };
  }
  
  // Check if limit exceeded
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }
  
  // Increment and allow
  entry.count++;
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Get client IP from Next.js request
 * Handles various proxy scenarios
 */
export function getClientIp(request: Request): string {
  // Check various headers for client IP (common in proxies/CDNs)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // Fallback: use connection remote address if available
  // This is a minimal fallback and may not always work
  return 'unknown';
}
