// src/app/api/dev/projects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { listProjectsWithItems } from '@/lib/dev/items';
import { getDevSession } from '@/lib/dev/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Vault projects are personal — visitor sessions (#82/#6) get none.
    const session = await getDevSession(req);
    if (session?.role !== 'admin') {
      return NextResponse.json({ projects: [] });
    }
    const projects = await listProjectsWithItems();
    return NextResponse.json({ projects });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
