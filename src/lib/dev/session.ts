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

/**
 * Session roles (#53/#82/#6). `admin` is Mike (password login, full access).
 * `visitor` is the read-only tier: wrong-password visitor mode and guest share
 * links. Visitor sessions may carry a `repoScope` claim restricting the board
 * to one repo (guest links). Tokens minted before roles existed have no role
 * claim — they were only ever issued via the password, so they read as admin.
 */
export type DevRole = 'admin' | 'visitor';

export interface SessionClaims {
  role: DevRole;
  /** Restrict a visitor session to one repo's board (guest share links). */
  repoScope?: string;
}

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
export async function signSession(
  nowMs: number,
  claims: SessionClaims = { role: 'admin' },
): Promise<string> {
  const iat = Math.floor(nowMs / 1000);
  return new SignJWT({
    lastSeen: iat,
    role: claims.role,
    ...(claims.repoScope ? { repoScope: claims.repoScope } : {}),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(iat)
    .setExpirationTime(iat + ABSOLUTE_TTL_S)
    .sign(secretKey());
}

export interface VerifyResult {
  valid: boolean;
  /** New token with refreshed lastSeen (same exp + claims). Present only when valid. */
  refreshed?: string;
  role?: DevRole;
  repoScope?: string;
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
    // Pre-role tokens (no role claim) were only ever minted via the password.
    const role: DevRole = payload.role === 'visitor' ? 'visitor' : 'admin';
    const repoScope = typeof payload.repoScope === 'string' ? payload.repoScope : undefined;
    const exp = payload.exp as number;
    const refreshed = await new SignJWT({
      lastSeen: nowS,
      role,
      ...(repoScope ? { repoScope } : {}),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(nowS)
      .setExpirationTime(exp) // keep the original absolute cap
      .sign(secretKey());
    return { valid: true, refreshed, role, repoScope };
  } catch {
    return { valid: false };
  }
}

/** The request's session claims, or null when no valid session cookie rides it. */
export async function getDevSession(
  req: NextRequest,
): Promise<{ role: DevRole; repoScope?: string } | null> {
  const token = req.cookies.get(DEV_SESSION_COOKIE)?.value;
  if (!token) return null;
  const result = await verifySession(token, Date.now());
  if (!result.valid) return null;
  return { role: result.role ?? 'admin', repoScope: result.repoScope };
}

/**
 * True iff the request carries a currently-valid ADMIN dev session cookie.
 *
 * Convenience wrapper for API routes that want to gate an individual handler
 * (e.g. the public /api/inbox POST coexists with an admin-only GET, so the
 * matcher can't blanket-guard the whole route). Routes wholly under the
 * middleware matcher don't need this — the edge check already ran. Visitor
 * sessions (#82/#6) deliberately do NOT satisfy this check: they unlock the
 * read-only board, never the admin surfaces that ride the same cookie.
 */
export async function hasValidDevSession(req: NextRequest): Promise<boolean> {
  const session = await getDevSession(req);
  return session?.role === 'admin';
}
