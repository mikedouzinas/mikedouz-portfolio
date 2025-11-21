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
  // Enhanced tracking fields
  visitor_id?: string
  ip_address?: string
  country?: string
  city?: string
  region?: string
  referrer?: string
  device_type?: string
  screen_size?: string
  parent_query_id?: string
  conversation_depth?: number
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

/**
 * Get enhanced analytics dashboard data
 * Includes visitor tracking, geo data, and conversation threading
 */
export async function getEnhancedAnalytics(days: number = 7) {
  const supabase = getSupabase()
  if (!supabase) return null

  try {
    const since = new Date()
    since.setDate(since.getDate() - days)

    // Get all queries for the period
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: queries, error } = await (supabase as any)
      .from('iris_queries')
      .select('*')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })

    if (error || !queries) {
      console.warn('[Analytics] Failed to fetch enhanced analytics:', error)
      return null
    }

    // Calculate overview metrics
    const uniqueVisitors = new Set(queries.filter((q: any) => q.visitor_id).map((q: any) => q.visitor_id)).size
    const totalQueries = queries.length
    const avgLatency = queries.reduce((sum: number, q: any) => sum + (q.latency_ms || 0), 0) / totalQueries
    const cacheHitRate = queries.filter((q: any) => q.cached).length / totalQueries

    // Geographic distribution
    const geoDistribution = queries
      .filter((q: any) => q.country)
      .reduce((acc: Record<string, number>, q: any) => {
        acc[q.country] = (acc[q.country] || 0) + 1
        return acc
      }, {})

    // Device type distribution
    const deviceDistribution = queries
      .filter((q: any) => q.device_type)
      .reduce((acc: Record<string, number>, q: any) => {
        acc[q.device_type] = (acc[q.device_type] || 0) + 1
        return acc
      }, {})

    // Intent distribution
    const intentDistribution = queries.reduce((acc: Record<string, number>, q: any) => {
      acc[q.intent] = (acc[q.intent] || 0) + 1
      return acc
    }, {})

    // Top queries
    const queryFrequency = queries.reduce((acc: Record<string, number>, q: any) => {
      acc[q.query] = (acc[q.query] || 0) + 1
      return acc
    }, {})

    const topQueries = Object.entries(queryFrequency)
      .map(([query, count]) => ({ query, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Time series data (queries by day)
    const queriesByDay = queries.reduce((acc: Record<string, number>, q: any) => {
      const date = new Date(q.created_at).toISOString().split('T')[0]
      acc[date] = (acc[date] || 0) + 1
      return acc
    }, {})

    // Conversation threads (root queries with follow-ups)
    const conversations = queries
      .filter((q: any) => !q.parent_query_id)
      .map((root: any) => {
        const followUps = queries.filter((q: any) => q.parent_query_id === root.id)
        return {
          id: root.id,
          query: root.query,
          created_at: root.created_at,
          visitor_id: root.visitor_id,
          follow_up_count: followUps.length,
          follow_ups: followUps.map((f: any) => ({
            id: f.id,
            query: f.query,
            created_at: f.created_at,
            depth: f.conversation_depth
          }))
        }
      })
      .slice(0, 20) // Latest 20 conversations

    return {
      overview: {
        total_queries: totalQueries,
        unique_visitors: uniqueVisitors,
        avg_latency_ms: Math.round(avgLatency),
        cache_hit_rate: cacheHitRate,
        date_range: { start: since.toISOString(), end: new Date().toISOString() }
      },
      geographic: Object.entries(geoDistribution)
        .map(([country, count]) => ({ country, count: count as number }))
        .sort((a, b) => b.count - a.count),
      devices: Object.entries(deviceDistribution)
        .map(([device, count]) => ({ device, count: count as number }))
        .sort((a, b) => b.count - a.count),
      intents: Object.entries(intentDistribution)
        .map(([intent, count]) => ({ intent, count: count as number }))
        .sort((a, b) => b.count - a.count),
      top_queries: topQueries,
      time_series: Object.entries(queriesByDay)
        .map(([date, count]) => ({ date, count: count as number }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      conversations: conversations
    }
  } catch (error) {
    console.warn('[Analytics] Enhanced analytics fetch error:', error)
    return null
  }
}

/**
 * Get a specific conversation thread
 * Returns all queries in a conversation from root to leaves
 */
export async function getConversationThread(rootQueryId: string) {
  const supabase = getSupabase()
  if (!supabase) return null

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('get_conversation_thread', {
      root_query_id: rootQueryId
    })

    if (error) {
      console.warn('[Analytics] Failed to fetch conversation thread:', error)
      return null
    }

    return data
  } catch (error) {
    console.warn('[Analytics] Conversation thread fetch error:', error)
    return null
  }
}
