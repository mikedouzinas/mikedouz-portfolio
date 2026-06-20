import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/dev/password';
import {
  signSession,
  hasValidDevSession,
  DEV_SESSION_COOKIE,
  sessionCookieOptions,
} from '@/lib/dev/session';
import {
  checkAuthRateLimit,
  checkGlobalLockout,
  recordGlobalFailure,
  resetGlobalFailures,
  resetAuthRateLimit,
  type RateLimitResult,
} from '@/lib/dev/rateLimit';
import { getClientIp } from '@/lib/rateLimit';

export const runtime = 'nodejs';

/** 429 with a Retry-After header derived from the limiter result. */
function tooManyAttempts(rl: RateLimitResult): NextResponse {
  const res = NextResponse.json({ error: 'too many attempts' }, { status: 429 });
  if (typeof rl.retryAfterS === 'number') {
    res.headers.set('Retry-After', String(rl.retryAfterS));
  }
  return res;
}

/**
 * GET → reports whether the caller holds a valid dev session.
 *
 * Public (the middleware lets /api/dev/auth through unauthenticated), so
 * non-admins simply get `{ authed: false }` rather than a 404/401. Lets client
 * components light up admin affordances (e.g. comment deletion) without reading
 * the httpOnly cookie. Never reveals the cookie value.
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({ authed: await hasValidDevSession(req) });
}

/** POST { password } → sets session cookie on success. */
export async function POST(req: NextRequest) {
  // Global lockout first: after N total failures across all IPs, every
  // attempt is rejected for a cooldown — independent of the per-IP limiter.
  const global = await checkGlobalLockout();
  if (!global.allowed) {
    return tooManyAttempts(global);
  }

  const ip = getClientIp(req);
  const rl = await checkAuthRateLimit(ip);
  if (!rl.allowed) {
    return tooManyAttempts(rl);
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === 'string' ? body.password : '';
  const hash = process.env.DEV_CONSOLE_PASSWORD_HASH || '';

  if (!password || !hash || !verifyPassword(password, hash)) {
    // Count this failure toward the shared global lockout.
    await recordGlobalFailure();
    return NextResponse.json({ error: 'invalid credentials' }, { status: 401 });
  }

  // Successful login clears the failure counters so legitimate sign-ins — and
  // repeated login/logout cycles — never trip the brute-force caps.
  await resetGlobalFailures();
  await resetAuthRateLimit(ip);

  const token = await signSession(Date.now());
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEV_SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}

/** DELETE → clears the session cookie (logout). */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEV_SESSION_COOKIE, '', { ...sessionCookieOptions, maxAge: 0 });
  return res;
}
