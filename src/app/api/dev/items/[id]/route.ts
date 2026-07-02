// src/app/api/dev/items/[id]/route.ts
// Mutations for a virtual project's item. Accepts the SAME body shape the board
// card sends to /api/dev/issues (priority/status/size/state/title/body/feedback),
// so the card routes here by source with no translation. Middleware-gated.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getItem, updateItem, updateItemSchema } from '@/lib/dev/items';
import { upsertReviewBlock } from '@/lib/dev/github';
import { getDevSession } from '@/lib/dev/session';

export const dynamic = 'force-dynamic';

const PatchSchema = updateItemSchema.extend({
  feedback: z.string().min(1).optional(), // send-back review feedback
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Middleware blocks visitor non-GETs; re-assert so vault mutations can never
  // ride anything less than an admin session (#53).
  const session = await getDevSession(req);
  if (session?.role !== 'admin') {
    return NextResponse.json({ error: 'read-only' }, { status: 403 });
  }
  const { id } = await params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  try {
    const { feedback, ...fields } = parsed.data;
    if (feedback) {
      // Send-back: record the feedback in a review block and move to in progress —
      // same effect as the GitHub path, written into the item body.
      const cur = await getItem(id);
      const body = upsertReviewBlock(cur?.body ?? '', { feedback });
      await updateItem(id, { status: 'in progress', body });
      return NextResponse.json({ ok: true });
    }
    await updateItem(id, fields);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
