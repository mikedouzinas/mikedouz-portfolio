import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { getEnhancedAnalytics } from '@/lib/iris/analytics';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';

export const dynamic = 'force-dynamic';

/**
 * Admin page for viewing Iris analytics
 * Gated by x-admin-key header
 */
export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: { days?: string };
}) {
  // Check authentication
  const headersList = await headers();
  const adminKey = headersList.get('x-admin-key');

  if (!adminKey || adminKey !== env.adminApiKey) {
    redirect('/'); // Redirect if not authenticated
  }

  // Parse days parameter (default to 7)
  const days = parseInt(searchParams.days || '7', 10);
  const validDays = isNaN(days) || days < 1 || days > 90 ? 7 : days;

  // Fetch analytics data
  let data = null;
  let error: string | null = null;

  try {
    data = await getEnhancedAnalytics(validDays);
    if (!data) {
      error = 'Analytics not configured or no data available';
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to fetch analytics';
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Iris Analytics</h1>
            <p className="text-white/60">Comprehensive insights into Iris usage and performance</p>
          </div>

          {/* Time range selector */}
          <div className="flex gap-2">
            {[7, 14, 30, 90].map((d) => (
              <a
                key={d}
                href={`/admin/analytics?days=${d}`}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  validDays === d
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {d}d
              </a>
            ))}
          </div>
        </div>

        {error ? (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-400">{error}</p>
          </div>
        ) : data ? (
          <AnalyticsDashboard data={data} days={validDays} />
        ) : (
          <div className="bg-white/5 rounded-lg p-8 text-center">
            <p className="text-white/60">Loading analytics...</p>
          </div>
        )}
      </div>
    </div>
  );
}
