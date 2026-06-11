/**
 * Brute-force limiters for /api/dev/auth.
 *
 * Two independent layers, both backed by the existing @upstash/redis client:
 *
 *  1. Per-IP fixed-window limiter — 5 attempts / 15 min, keyed on client IP.
 *     Throttles a single noisy source.
 *
 *  2. GLOBAL lockout — after GLOBAL_MAX_FAILURES total *failed* logins across
 *     ALL IPs within a window, every login attempt is locked for a cooldown.
 *     This hardens a short PIN against a distributed/rotating-IP guess attack
 *     that would slip under the per-IP cap. The two layers compose: a request
 *     must clear BOTH to proceed.
 *
 * Both layers fail OPEN only when Redis is unconfigured (local dev); prod has
 * Redis. We never lock people out because the store is down.
 */
import { Redis } from '@upstash/redis';

const MAX_ATTEMPTS = 5;
const WINDOW_S = 15 * 60;

/** Total failed logins across all IPs before the global lockout engages. */
const GLOBAL_MAX_FAILURES = 20;
/** How long the global lockout stays engaged once tripped (seconds). */
const GLOBAL_COOLDOWN_S = 15 * 60;

const GLOBAL_FAILURE_KEY = 'dev:auth:rl:global:failures';

let client: Redis | null = null;

function getRedis(): Redis | null {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  client = new Redis({ url, token });
  return client;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds the caller should wait before retrying, when not allowed. */
  retryAfterS?: number;
}

/**
 * Per-IP fixed-window limiter. Increments on every call (i.e. every attempt).
 * Returns retry-after = remaining window TTL when blocked.
 */
export async function checkAuthRateLimit(ip: string): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) return { allowed: true }; // dev, no redis
  try {
    const key = `dev:auth:rl:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, WINDOW_S);
    }
    if (count <= MAX_ATTEMPTS) return { allowed: true };
    const ttl = await redis.ttl(key);
    return { allowed: false, retryAfterS: ttl > 0 ? ttl : WINDOW_S };
  } catch {
    return { allowed: true }; // fail open on transient Redis errors
  }
}

/**
 * Read-only check of the global lockout. Does NOT increment — call this on
 * every login attempt BEFORE verifying credentials so a locked window rejects
 * all comers. The counter is advanced only by {@link recordGlobalFailure} on an
 * actual credential failure.
 */
export async function checkGlobalLockout(): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) return { allowed: true }; // dev, no redis
  try {
    const count = await redis.get<number>(GLOBAL_FAILURE_KEY);
    if (count === null || count < GLOBAL_MAX_FAILURES) return { allowed: true };
    const ttl = await redis.ttl(GLOBAL_FAILURE_KEY);
    return { allowed: false, retryAfterS: ttl > 0 ? ttl : GLOBAL_COOLDOWN_S };
  } catch {
    return { allowed: true }; // fail open
  }
}

/**
 * Record one failed login against the global counter. Call this only after a
 * credential check actually fails. The first failure of a window sets the
 * cooldown TTL; once the count reaches GLOBAL_MAX_FAILURES the window is locked
 * (see {@link checkGlobalLockout}) until that TTL expires.
 */
export async function recordGlobalFailure(): Promise<void> {
  const redis = getRedis();
  if (!redis) return; // dev, no redis
  try {
    const count = await redis.incr(GLOBAL_FAILURE_KEY);
    if (count === 1) {
      await redis.expire(GLOBAL_FAILURE_KEY, GLOBAL_COOLDOWN_S);
    }
  } catch {
    // fail open: a dropped increment must never lock anyone out
  }
}

/**
 * Clear the global failure counter. Call on a successful login so a legitimate
 * sign-in resets the shared counter and can't be tipped into lockout by stale
 * failures.
 */
export async function resetGlobalFailures(): Promise<void> {
  const redis = getRedis();
  if (!redis) return; // dev, no redis
  try {
    await redis.del(GLOBAL_FAILURE_KEY);
  } catch {
    // fail open
  }
}
