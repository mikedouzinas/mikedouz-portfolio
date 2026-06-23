// src/app/api/dev/projects/route.ts
import { NextResponse } from 'next/server';
import { listProjectsWithItems } from '@/lib/dev/items';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const projects = await listProjectsWithItems();
    return NextResponse.json({ projects });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
