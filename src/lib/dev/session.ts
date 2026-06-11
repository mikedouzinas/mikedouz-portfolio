/**
 * Dev-console session token (edge-safe).
 *
 * Uses `jose` so it runs in BOTH the Node auth route and the Edge middleware.
 * MUST NOT import node:crypto or anything Node-only — middleware runs on edge.
 *
 * Security model:
 *  - HS256 JWT signed with DEV_SESSION_SECRET.
 *  - exp = 2h absolute cap (never extended).
 *  - lastSeen claim = idle anchor; rejected after 30m of inactivity.
 *  - verifySession returns a `refreshed` token (new lastSeen, same exp) on success.
 */
import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';

export const DEV_SESSION_COOKIE = 'dev_session';

const ABSOLUTE_TTL_S = 2 * 60 * 60; // 2 hours
const IDLE_TTL_S = 30 * 60; // 30 minutes

/** Session cookie options. `secure` only in prod so localhost http works. */
export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  // No maxAge → browser session cookie (cleared on browser close).
};

function secretKey(): Uint8Array {
  const s = process.env.DEV_SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error('DEV_SESSION_SECRET not configured (min 32 chars)');
  }
  return new TextEncoder().encode(s);
}

/** Mint a new session token. `nowMs` injectable for tests. */
export async function signSession(nowMs: number): Promise<string> {
  const iat = Math.floor(nowMs / 1000);
  return new SignJWT({ lastSeen: iat })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(iat)
    .setExpirationTime(iat + ABSOLUTE_TTL_S)
    .sign(secretKey());
}

export interface VerifyResult {
  valid: boolean;
  /** New token with refreshed lastSeen (same exp). Present only when valid. */
  refreshed?: string;
}

/** Verify a token against absolute exp + idle window. `nowMs` injectable. */
export async function verifySession(token: string, nowMs: number): Promise<VerifyResult> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      currentDate: new Date(nowMs), // use injected clock for exp validation
      requiredClaims: ['exp'],
    }); // throws on bad sig / past exp / missing exp
    const nowS = Math.floor(nowMs / 1000);
    const lastSeen = typeof payload.lastSeen === 'number' ? payload.lastSeen : 0;
    if (nowS - lastSeen > IDLE_TTL_S) {
      return { valid: false };
    }
    const exp = payload.exp as number;
    const refreshed = await new SignJWT({ lastSeen: nowS })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(nowS)
      .setExpirationTime(exp) // keep the original absolute cap
      .sign(secretKey());
    return { valid: true, refreshed };
  } catch {
    return { valid: false };
  }
}

/**
 * True iff the request carries a currently-valid dev session cookie.
 *
 * Convenience wrapper for API routes that want to gate an individual handler
 * (e.g. the public /api/inbox POST coexists with an admin-only GET, so the
 * matcher can't blanket-guard the whole route). Routes wholly under the
 * middleware matcher don't need this — the edge check already ran.
 */
export async function hasValidDevSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(DEV_SESSION_COOKIE)?.value;
  if (!token) return false;
  const result = await verifySession(token, Date.now());
  return result.valid;
}
