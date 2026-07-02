import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/dev/password';
import {
  signSession,
  getDevSession,
  DEV_SESSION_COOKIE,
  sessionCookieOptions,
} from '@/lib/dev/session';
import { validateShareToken } from '@/lib/dev/share';
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
  const session = await getDevSession(req);
  // `authed` stays admin-only: pre-role consumers (blog admin affordances,
  // inbox) key on it, and a visitor session must not light those up.
  return NextResponse.json({
    authed: session?.role === 'admin',
    role: session?.role ?? null,
    repoScope: session?.repoScope ?? null,
  });
}

/**
 * POST { password } → full (admin) session.
 * POST { visitor: true } → read-only visitor session (#82, wrong-password path).
 * POST { shareToken } → read-only visitor session scoped to one repo (#6).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // Guest share link (#6): a valid token mints a repo-scoped visitor session.
  // No rate-limit interplay — the token itself is the credential.
  if (typeof body?.shareToken === 'string') {
    const repo = await validateShareToken(body.shareToken);
    if (!repo) {
      return NextResponse.json({ error: 'invalid or expired link' }, { status: 401 });
    }
    const token = await signSession(Date.now(), { role: 'visitor', repoScope: repo });
    const res = NextResponse.json({ ok: true, role: 'visitor', repoScope: repo });
    res.cookies.set(DEV_SESSION_COOKIE, token, sessionCookieOptions);
    return res;
  }

  // Visitor mode (#82): the wrong-password path offers a look-don't-touch view
  // of the whole board. Read-only is enforced by the middleware + routes.
  if (body?.visitor === true) {
    const token = await signSession(Date.now(), { role: 'visitor' });
    const res = NextResponse.json({ ok: true, role: 'visitor' });
    res.cookies.set(DEV_SESSION_COOKIE, token, sessionCookieOptions);
    return res;
  }

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

  const password = typeof body?.password === 'string' ? body.password : '';
  const hash = process.env.DEV_CONSOLE_PASSWORD_HASH || '';

  if (!password || !hash || !verifyPassword(password, hash)) {
    // Count this failure toward the shared global lockout, and let the client
    // offer the read-only visitor path instead of a dead-end "Nope." (#82).
    await recordGlobalFailure();
    return NextResponse.json({ error: 'invalid credentials', visitorOffer: true }, { status: 401 });
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
