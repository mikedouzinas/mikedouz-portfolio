import { NextRequest, NextResponse } from 'next/server';
import { unsubscribeByToken } from '@/lib/subscribers';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/the-web?subscribe=error', req.url));
  }

  // Redirect regardless of result (don't leak subscriber existence)
  await unsubscribeByToken(token);

  return NextResponse.redirect(new URL('/the-web?subscribe=removed', req.url));
}
