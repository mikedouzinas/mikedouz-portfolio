// src/app/api/dev/items/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { updateItemStatus, updateItemStatusSchema } from '@/lib/dev/items';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const parsed = updateItemStatusSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  try {
    const item = await updateItemStatus(id, parsed.data.status);
    return NextResponse.json({ item });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
