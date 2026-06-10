import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteComment } from '@/lib/comments';

export const runtime = 'nodejs';

const UUIDParam = z.string().uuid();

/**
 * DELETE /api/the-web/comments/[id]
 * Admin-only endpoint to soft-delete a comment.
 *
 * Auth is enforced by the edge middleware (the dev_session cookie from the /dev
 * portal login), which 401s any request without a valid session before this
 * handler runs — same model as the /api/dev/* routes. No header check here.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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
