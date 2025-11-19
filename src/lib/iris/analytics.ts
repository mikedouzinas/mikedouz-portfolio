/**
 * Iris Analytics Service
 *
 * Tracks all queries to Supabase for analytics and improvement insights.
 * All operations are non-blocking - failures won't break the user experience.
 */

import { createClient } from '@supabase/supabase-js'

// Lazy initialization to avoid requiring env vars at build time
let supabaseClient: ReturnType<typeof createClient> | null = null

function getSupabase() {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
      console.warn('[Analytics] Supabase not configured - analytics disabled')
      return null
    }

    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false, // Server-side, no session needed
      },
    })
  }

  return supabaseClient
}

export interface QueryLog {
  query: string
  intent: string
  filters?: Record<string, unknown>
  results_count: number
  context_items?: Array<{ type: string; title: string; score?: number }>
  answer_length: number
  latency_ms: number
  cached: boolean
  session_id?: string
  user_agent?: string
}

export interface QuickActionLog {
  query_id: string
  suggestion: string
}

/**
 * Log a query to Supabase analytics
 * Non-blocking - returns query ID or null if failed
 */
export async function logQuery(data: QueryLog): Promise<string | null> {
  const supabase = getSupabase()
  if (!supabase) return null

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (supabase as any)
      .from('iris_queries')
      .insert([data])
      .select('id')
      .single()

    if (error) {
      console.warn('[Analytics] Failed to log query:', error.message)
      return null
    }

    return result.id
  } catch (error) {
    console.warn('[Analytics] Query logging error:', error)
    return null
  }
}

/**
 * Log a quick action suggestion
 * Non-blocking - logs when user sees quick actions
 */
export async function logQuickAction(data: QuickActionLog): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('iris_quick_actions')
      .insert([data])

    if (error) {
      console.warn('[Analytics] Failed to log quick action:', error.message)
    }
  } catch (error) {
    console.warn('[Analytics] Quick action logging error:', error)
  }
}

/**
 * Record when a quick action is clicked
 * Non-blocking - updates click status
 */
export async function recordQuickActionClick(
  query_id: string,
  suggestion: string
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('iris_quick_actions')
      .update({
        clicked: true,
        clicked_at: new Date().toISOString(),
      })
      .match({ query_id, suggestion })

    if (error) {
      console.warn('[Analytics] Failed to record click:', error.message)
    }
  } catch (error) {
    console.warn('[Analytics] Click recording error:', error)
  }
}

/**
 * Record user feedback on an answer
 * Non-blocking - updates rating and optional feedback text
 */
export async function recordFeedback(
  query_id: string,
  rating: number,
  feedback?: string
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('iris_queries')
      .update({
        rating,
        feedback: feedback || null,
      })
      .eq('id', query_id)

    if (error) {
      console.warn('[Analytics] Failed to record feedback:', error.message)
    }
  } catch (error) {
    console.warn('[Analytics] Feedback recording error:', error)
  }
}

/**
 * Get analytics summary (for admin dashboard)
 * Returns null if Supabase not configured
 */
export async function getAnalyticsSummary(days: number = 7): Promise<{
  total_queries: number
  avg_latency_ms: number
  cache_hit_rate: number
  failed_queries: number
  top_intents: Array<{ intent: string; count: number }>
  common_queries: Array<{ query: string; count: number }>
} | null> {
  const supabase = getSupabase()
  if (!supabase) return null

  try {
    const since = new Date()
    since.setDate(since.getDate() - days)

    // Get overall stats
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: stats } = await (supabase as any).rpc('get_analytics_summary', {
      since_date: since.toISOString(),
    })

    // Fallback if RPC not available - query directly
    if (!stats) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: queries } = await (supabase as any)
        .from('iris_queries')
        .select('*')
        .gte('created_at', since.toISOString())

      if (!queries) return null

      // Type for queries returned from Supabase
      type QueryRow = {
        cached: boolean;
        results_count: number;
        latency_ms?: number;
        intent: string;
        query: string;
      }

      const total = queries.length
      const cached = queries.filter((q: QueryRow) => q.cached).length
      const failed = queries.filter((q: QueryRow) => q.results_count === 0).length

      const avgLatency =
        queries.reduce((sum: number, q: QueryRow) => sum + (q.latency_ms || 0), 0) / total

      const intentCounts = queries.reduce((acc: Record<string, number>, q: QueryRow) => {
        acc[q.intent] = (acc[q.intent] || 0) + 1
        return acc
      }, {})

      const queryCounts = queries.reduce(
        (acc: Record<string, number>, q: QueryRow) => {
          acc[q.query] = (acc[q.query] || 0) + 1
          return acc
        },
        {}
      )

      return {
        total_queries: total,
        avg_latency_ms: Math.round(avgLatency),
        cache_hit_rate: total > 0 ? cached / total : 0,
        failed_queries: failed,
        top_intents: Object.entries(intentCounts)
          .map(([intent, count]) => ({ intent, count: count as number }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        common_queries: Object.entries(queryCounts)
          .map(([query, count]) => ({ query, count: count as number }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
      }
    }

    return stats
  } catch (error) {
    console.warn('[Analytics] Summary fetch error:', error)
    return null
  }
}

/**
 * Health check for analytics system
 * Returns true if Supabase is configured and accessible
 */
export async function checkAnalyticsHealth(): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase) return false

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('iris_queries')
      .select('id')
      .limit(1)

    return !error
  } catch {
    return false
  }
}
