import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

/**
 * GET /api/cron/keep-alive
 * Pings Supabase every 5 days to prevent free-tier auto-pause.
 * Triggered by Vercel cron (see vercel.json).
 */
export async function GET(req: NextRequest) {
  // Verify the request comes from Vercel cron in production
  const authHeader = req.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from('inbox_messages')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('[KeepAlive] Supabase ping failed:', JSON.stringify(error));
      return NextResponse.json({ ok: false, error: error.message, code: error.code, details: error.details }, { status: 500 });
    }

    console.log(`[KeepAlive] Supabase alive — ${count} inbox messages`);
    return NextResponse.json({ ok: true, messageCount: count });
  } catch (err) {
    console.error('[KeepAlive] Error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
