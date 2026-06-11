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
  // The auth endpoint must be reachable while unauthenticated (login/logout).
  if (req.nextUrl.pathname === '/api/dev/auth') {
    return NextResponse.next();
  }

  const token = req.cookies.get(DEV_SESSION_COOKIE)?.value;
  const result = token ? await verifySession(token, Date.now()) : { valid: false as const };

  if (!result.valid) {
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    // Don't admit the page exists.
    return new NextResponse(null, { status: 404 });
  }

  const res = NextResponse.next();
  if (result.refreshed) {
    res.cookies.set(DEV_SESSION_COOKIE, result.refreshed, sessionCookieOptions);
  }
  return res;
}
