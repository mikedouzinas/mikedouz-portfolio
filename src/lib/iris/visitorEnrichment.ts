/**
 * Server-side visitor enrichment for Iris query logging.
 * Pulls referrer + UTMs out of request headers, hashes the IP, and asks
 * ipinfo.io for geo + org data. Results are cached in Upstash Redis for 24h
 * keyed by IP so we don't hit the ipinfo budget on bots/refreshes.
 */

import { createHash } from 'crypto';

// Static project salt — protects against trivial rainbow-table reversal of the
// 4-billion-entry IPv4 space if the DB is ever leaked. Not a secret in the
// classic sense; rotating it would just lose visitor-clustering continuity.
const IP_HASH_SALT = '4f3b9a2e-mikeveson-iris-2026';

const IPINFO_BASE = 'https://ipinfo.io';
const CACHE_TTL_SEC = 60 * 60 * 24; // 24h

export interface VisitorEnrichment {
  referrer?: string;
  ip_hash?: string;
  org?: string;
  city?: string;
  region?: string;
  country?: string;
  timezone?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

interface IpInfoResponse {
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  org?: string;
  timezone?: string;
  bogon?: boolean;
}

function extractIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip') || null;
}

function hashIp(ip: string): string {
  return createHash('sha256').update(`${IP_HASH_SALT}:${ip}`).digest('hex').slice(0, 32);
}

let redisClient: unknown = null;
async function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!redisClient) {
    const { Redis } = await import('@upstash/redis');
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redisClient;
}

async function lookupIpInfo(ip: string): Promise<IpInfoResponse | null> {
  if (!process.env.IPINFO_TOKEN) return null;

  const cacheKey = `ipinfo:${ip}`;

  try {
    const redis = (await getRedis()) as { get: (k: string) => Promise<string | null> } | null;
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return typeof cached === 'string' ? (JSON.parse(cached) as IpInfoResponse) : (cached as IpInfoResponse);
      }
    }
  } catch (error) {
    console.warn('[visitorEnrichment] Redis read failed:', error);
  }

  try {
    const res = await fetch(`${IPINFO_BASE}/${encodeURIComponent(ip)}?token=${process.env.IPINFO_TOKEN}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) {
      console.warn('[visitorEnrichment] ipinfo non-2xx:', res.status);
      return null;
    }
    const data = (await res.json()) as IpInfoResponse;

    try {
      const redis = (await getRedis()) as { set: (k: string, v: string, o?: { ex?: number }) => Promise<unknown> } | null;
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(data), { ex: CACHE_TTL_SEC });
      }
    } catch (error) {
      console.warn('[visitorEnrichment] Redis write failed:', error);
    }

    return data;
  } catch (error) {
    console.warn('[visitorEnrichment] ipinfo lookup failed:', error);
    return null;
  }
}

function parseUtms(referrerOrUrl: string | null): Pick<VisitorEnrichment, 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content' | 'utm_term'> {
  if (!referrerOrUrl) return {};
  try {
    const url = new URL(referrerOrUrl);
    return {
      utm_source: url.searchParams.get('utm_source') || undefined,
      utm_medium: url.searchParams.get('utm_medium') || undefined,
      utm_campaign: url.searchParams.get('utm_campaign') || undefined,
      utm_content: url.searchParams.get('utm_content') || undefined,
      utm_term: url.searchParams.get('utm_term') || undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Build a VisitorEnrichment from the current request. Best-effort: any
 * sub-step (ipinfo, redis, header parse) can fail silently — the returned
 * object will just have fewer fields.
 */
export async function buildVisitorEnrichment(req: Request): Promise<VisitorEnrichment> {
  const referrer = req.headers.get('referer') || undefined;

  // Prefer UTMs from the page URL (passed via x-page-url client header), fall
  // back to the referrer URL itself.
  const pageUrl = req.headers.get('x-page-url');
  const utms = parseUtms(pageUrl) ;
  const utmsFromReferrer = parseUtms(referrer ?? null);
  const mergedUtms = {
    utm_source:   utms.utm_source   ?? utmsFromReferrer.utm_source,
    utm_medium:   utms.utm_medium   ?? utmsFromReferrer.utm_medium,
    utm_campaign: utms.utm_campaign ?? utmsFromReferrer.utm_campaign,
    utm_content:  utms.utm_content  ?? utmsFromReferrer.utm_content,
    utm_term:     utms.utm_term     ?? utmsFromReferrer.utm_term,
  };

  const ip = extractIp(req);
  const ip_hash = ip ? hashIp(ip) : undefined;

  let geo: IpInfoResponse | null = null;
  if (ip && !ip.startsWith('127.') && !ip.startsWith('::1')) {
    geo = await lookupIpInfo(ip);
  }

  return {
    referrer,
    ip_hash,
    org:      geo?.org      || undefined,
    city:     geo?.city     || undefined,
    region:   geo?.region   || undefined,
    country:  geo?.country  || undefined,
    timezone: geo?.timezone || undefined,
    ...mergedUtms,
  };
}
