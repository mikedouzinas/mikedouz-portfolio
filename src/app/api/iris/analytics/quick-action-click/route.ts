import { NextRequest, NextResponse } from 'next/server';
import { recordQuickActionClick } from '@/lib/iris/analytics';

export const runtime = 'nodejs';

/**
 * POST /api/iris/analytics/quick-action-click
 * Record when a quick action is clicked
 * Client-safe endpoint for tracking quick action analytics
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { queryId, suggestion } = body;

    if (!queryId || !suggestion) {
      return NextResponse.json(
        { error: 'Missing queryId or suggestion' },
        { status: 400 }
      );
    }

    // Record the click (non-blocking, failures are logged but don't error)
    await recordQuickActionClick(queryId, suggestion);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Quick Action Click API] Error:', error);
    // Don't fail the request for analytics errors
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
