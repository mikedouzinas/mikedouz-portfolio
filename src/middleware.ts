import { NextRequest, NextResponse } from 'next/server';
import {
  DEV_SESSION_COOKIE,
  sessionCookieOptions,
  verifySession,
} from '@/lib/dev/session';

export const config = {
  // Include bare `/dev` explicitly — `:path*` can miss the base segment.
  // /admin/inbox + the comment-DELETE API ride the same dev_session so one
  // portal login unlocks the board, the inbox, and comment moderation.
  // (/api/inbox is intentionally absent: its POST is public; its GET self-gates.)
  matcher: [
    '/dev',
    '/dev/:path*',
    '/api/dev/:path*',
    '/admin/inbox',
    '/admin/inbox/:path*',
    '/api/the-web/comments/:path*',
  ],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // The auth endpoint must be reachable while unauthenticated (login/logout),
  // and /dev/guest/<token> is the guest-link landing page — it exchanges its
  // token for a visitor session, so it can't require one (#6).
  if (pathname === '/api/dev/auth' || pathname.startsWith('/dev/guest/')) {
    return NextResponse.next();
  }

  const token = req.cookies.get(DEV_SESSION_COOKIE)?.value;
  const result = token ? await verifySession(token, Date.now()) : { valid: false as const };

  if (!result.valid) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    // Don't admit the page exists.
    return new NextResponse(null, { status: 404 });
  }

  // Visitor sessions (#82/#6) are strictly read-only and scoped to the board:
  // no mutating methods, and none of the other admin surfaces that ride this
  // cookie (inbox, comment moderation). Enforced here at the edge — the routes
  // also re-check, but this is the boundary that guarantees look-don't-touch.
  if (result.role === 'visitor') {
    const boardSurface = pathname === '/dev' || pathname.startsWith('/dev/') || pathname.startsWith('/api/dev/');
    if (!boardSurface) {
      return pathname.startsWith('/api/')
        ? NextResponse.json({ error: 'unauthorized' }, { status: 401 })
        : new NextResponse(null, { status: 404 });
    }
    if (pathname.startsWith('/api/') && req.method !== 'GET' && req.method !== 'HEAD') {
      return NextResponse.json({ error: 'read-only' }, { status: 403 });
    }
  }

  const res = NextResponse.next();
  if (result.refreshed) {
    res.cookies.set(DEV_SESSION_COOKIE, result.refreshed, sessionCookieOptions);
  }
  return res;
}
