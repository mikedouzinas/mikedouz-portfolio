/**
 * Fixed-window brute-force limiter for /api/dev/auth.
 * Uses the existing @upstash/redis client. 5 attempts / 15 min per IP.
 * Fails OPEN only when Redis is unconfigured (local dev); prod has Redis.
 */
import { Redis } from '@upstash/redis';

const MAX_ATTEMPTS = 5;
const WINDOW_S = 15 * 60;

let client: Redis | null = null;

function getRedis(): Redis | null {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  client = new Redis({ url, token });
  return client;
}

export async function checkAuthRateLimit(ip: string): Promise<{ allowed: boolean }> {
  const redis = getRedis();
  if (!redis) return { allowed: true }; // dev, no redis
  const key = `dev:auth:rl:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_S);
  }
  return { allowed: count <= MAX_ATTEMPTS };
}
