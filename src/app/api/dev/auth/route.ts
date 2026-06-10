import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/dev/password';
import { signSession, DEV_SESSION_COOKIE, sessionCookieOptions } from '@/lib/dev/session';
import {
  checkAuthRateLimit,
  checkGlobalLockout,
  recordGlobalFailure,
  resetGlobalFailures,
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

  // Successful login clears the global failure counter.
  await resetGlobalFailures();

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
