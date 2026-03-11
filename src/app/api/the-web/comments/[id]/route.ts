import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { deleteComment } from '@/lib/comments';

export const runtime = 'nodejs';

const UUIDParam = z.string().uuid();

/**
 * DELETE /api/the-web/comments/[id]
 * Admin-only endpoint to soft-delete a comment.
 * Requires x-admin-key header.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const adminKey = req.headers.get('x-admin-key');
    if (!adminKey || adminKey !== env.adminApiKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const parsed = UUIDParam.safeParse(id);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid comment ID' }, { status: 400 });
    }

    await deleteComment(parsed.data);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Comments] DELETE error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
