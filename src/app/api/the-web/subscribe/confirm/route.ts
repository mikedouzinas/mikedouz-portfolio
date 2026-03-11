import { NextRequest, NextResponse } from 'next/server';
import { confirmSubscriber } from '@/lib/subscribers';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/the-web?subscribe=invalid', req.url));
  }

  const subscriber = await confirmSubscriber(token);

  if (!subscriber) {
    return NextResponse.redirect(new URL('/the-web?subscribe=invalid', req.url));
  }

  return NextResponse.redirect(new URL('/the-web?subscribe=confirmed', req.url));
}
