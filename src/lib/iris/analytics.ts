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
  complexity?: QueryComplexity
  retrieval_quality?: RetrievalQuality
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

// ============================================================================
// ENHANCED ANALYTICS - Failure Detection, KB Gaps, and Session Tracking
// ============================================================================

export interface FailureMetadata {
  query_id: string
  failure_type: string
  word_count: number
  filter_count: number
  has_negation: boolean
  has_multiple_intents: boolean
  char_length: number
  max_score?: number
  score_gap?: number
  total_candidates?: number
  top_5_avg_score?: number
  extracted_topics?: string[]
  missing_kb_types?: string[]
  metadata?: Record<string, unknown>
}

export interface KBGap {
  topic: string
  suggested_kb_type: string
  example_query: string
}

export interface QueryComplexity {
  word_count: number
  filter_count: number
  has_negation: boolean
  has_conjunction: boolean
  char_length: number
}

export interface RetrievalQuality {
  max_score: number
  top_5_avg: number
  score_gap: number
  total_candidates: number
}

/**
 * Calculate query complexity metrics
 */
export function calculateQueryComplexity(
  query: string,
  filters?: Record<string, unknown>
): QueryComplexity {
  const words = query.trim().split(/\s+/)
  const filterCount = filters ? Object.keys(filters).length : 0

  return {
    word_count: words.length,
    filter_count: filterCount,
    has_negation: /\b(not|without|except|excluding|don't|doesn't|didn't)\b/i.test(
      query
    ),
    has_conjunction: /\b(and|or|but)\b/i.test(query),
    char_length: query.length,
  }
}

/**
 * Calculate retrieval quality metrics from results
 */
export function calculateRetrievalQuality(
  results: Array<{ score: number }>
): RetrievalQuality {
  if (results.length === 0) {
    return {
      max_score: 0,
      top_5_avg: 0,
      score_gap: 0,
      total_candidates: 0,
    }
  }

  const top5 = results.slice(0, 5)
  const top5Avg =
    top5.reduce((sum, r) => sum + r.score, 0) / Math.max(1, top5.length)

  return {
    max_score: results[0]?.score || 0,
    top_5_avg: top5Avg,
    score_gap: results.length >= 2 ? results[0].score - results[1].score : 0,
    total_candidates: results.length,
  }
}

/**
 * Classify failure type based on query characteristics and results
 */
export function classifyFailure(
  query: string,
  intent: string,
  filters: Record<string, unknown> | undefined,
  results: Array<{ score: number }>
): string {
  const complexity = calculateQueryComplexity(query, filters)

  // No results at all
  if (results.length === 0) {
    return 'no_results'
  }

  // Low confidence (top result score < 0.3)
  if (results[0].score < 0.3) {
    return 'low_confidence'
  }

  // Too vague (very short query with poor results)
  if (complexity.word_count <= 3 && results[0].score < 0.5) {
    return 'too_vague'
  }

  // Filter conflict (multiple filters but no/poor results)
  if (complexity.filter_count >= 2 && results[0].score < 0.4) {
    return 'filter_conflict'
  }

  // Ambiguous (similar scores for top results = unclear intent)
  const quality = calculateRetrievalQuality(results)
  if (quality.score_gap < 0.1 && results.length > 1) {
    return 'ambiguous'
  }

  // Time-sensitive queries
  if (
    /\b(today|now|current|recent|latest|this week|this month)\b/i.test(query)
  ) {
    return 'time_sensitive'
  }

  return 'unknown'
}

/**
 * Extract topics/keywords that might be missing from KB
 * Simple implementation - can be enhanced with NLP
 */
export function extractTopics(query: string): string[] {
  const topics = new Set<string>()

  // Extract capitalized terms (likely proper nouns/tech terms)
  const capitalPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g
  const capitalMatches = query.match(capitalPattern)
  if (capitalMatches) {
    capitalMatches.forEach((match) => topics.add(match))
  }

  // Common tech keywords (expand as needed)
  const techKeywords = [
    'TypeScript',
    'JavaScript',
    'React',
    'Node',
    'Python',
    'Docker',
    'Kubernetes',
    'AWS',
    'Azure',
    'GraphQL',
    'REST',
    'API',
    'MongoDB',
    'PostgreSQL',
    'Redis',
    'Git',
    'GitHub',
    'CI/CD',
    'TDD',
    'Agile',
  ]

  techKeywords.forEach((keyword) => {
    if (new RegExp(`\\b${keyword}\\b`, 'i').test(query)) {
      topics.add(keyword)
    }
  })

  return Array.from(topics).slice(0, 5) // Limit to 5 topics
}

/**
 * Log failure metadata for analysis
 * Non-blocking - helps identify patterns
 */
export async function logFailureMetadata(
  data: FailureMetadata
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('iris_failure_metadata')
      .insert([data])

    if (error) {
      console.warn('[Analytics] Failed to log failure metadata:', error.message)
    }
  } catch (error) {
    console.warn('[Analytics] Failure metadata logging error:', error)
  }
}

/**
 * Log or update KB gap
 * Non-blocking - helps identify missing content
 */
export async function upsertKBGap(data: KBGap): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return

  try {
    // Check if gap already exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('iris_kb_gaps')
      .select('id, query_count, example_queries, last_seen')
      .eq('topic', data.topic)
      .eq('suggested_kb_type', data.suggested_kb_type)
      .single()

    if (existing) {
      // Update existing gap
      const updatedQueries = existing.example_queries || []
      if (!updatedQueries.includes(data.example_query)) {
        updatedQueries.push(data.example_query)
      }

      // Keep only last 10 example queries
      const limitedQueries = updatedQueries.slice(-10)

      // Calculate priority score
      const newQueryCount = existing.query_count + 1
      const daysSinceLastSeen =
        (Date.now() - new Date(existing.last_seen).getTime()) / (1000 * 60 * 60 * 24)

      let recencyMultiplier = 1.0
      if (daysSinceLastSeen <= 7) recencyMultiplier = 2.0
      else if (daysSinceLastSeen <= 14) recencyMultiplier = 1.5
      else if (daysSinceLastSeen <= 30) recencyMultiplier = 1.2

      const priorityScore = Math.floor(newQueryCount * recencyMultiplier)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('iris_kb_gaps')
        .update({
          query_count: newQueryCount,
          last_seen: new Date().toISOString(),
          example_queries: limitedQueries,
          priority_score: priorityScore,
        })
        .eq('id', existing.id)
    } else {
      // Insert new gap
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('iris_kb_gaps')
        .insert([
          {
            topic: data.topic,
            suggested_kb_type: data.suggested_kb_type,
            query_count: 1,
            example_queries: [data.example_query],
            priority_score: 2, // New gaps start with priority 2 (recency boost)
          },
        ])
    }
  } catch (error) {
    console.warn('[Analytics] KB gap upsert error:', error)
  }
}

/**
 * Update session flow when a new query is added
 * Non-blocking - tracks user journeys
 */
export async function updateSessionFlow(
  sessionId: string,
  queryId: string,
  intent: string,
  success: boolean,
  userAgent: string | undefined,
  query: string
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return

  try {
    // Use the database function for consistency
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc('update_session_flow', {
      p_session_id: sessionId,
      p_query_id: queryId,
      p_intent: intent,
      p_success: success,
      p_user_agent: userAgent || null,
      p_query: query,
    })

    if (error) {
      console.warn('[Analytics] Failed to update session flow:', error.message)
    }
  } catch (error) {
    console.warn('[Analytics] Session flow update error:', error)
  }
}

/**
 * Detect and log query reformulation
 * Non-blocking - helps understand what makes users rephrase
 */
export async function logReformulation(
  sessionId: string,
  originalQueryId: string,
  reformulatedQueryId: string,
  originalQuery: string,
  reformulatedQuery: string,
  originalSuccess: boolean,
  reformulationSuccess: boolean,
  timeBetweenMs: number
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return

  try {
    // Simple Levenshtein-based similarity
    const similarity = calculateSimilarity(originalQuery, reformulatedQuery)

    // Detect what changed
    const originalWords = new Set(originalQuery.toLowerCase().split(/\s+/))
    const reformulatedWords = new Set(
      reformulatedQuery.toLowerCase().split(/\s+/)
    )

    const wordsAdded = Array.from(reformulatedWords).filter(
      (w) => !originalWords.has(w)
    )
    const wordsRemoved = Array.from(originalWords).filter(
      (w) => !reformulatedWords.has(w)
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('iris_reformulations')
      .insert([
        {
          session_id: sessionId,
          original_query_id: originalQueryId,
          reformulated_query_id: reformulatedQueryId,
          similarity_score: similarity,
          words_added: wordsAdded,
          words_removed: wordsRemoved,
          time_between_ms: timeBetweenMs,
          original_success: originalSuccess,
          reformulation_success: reformulationSuccess,
          improvement: !originalSuccess && reformulationSuccess,
        },
      ])

    if (error) {
      console.warn('[Analytics] Failed to log reformulation:', error.message)
    }
  } catch (error) {
    console.warn('[Analytics] Reformulation logging error:', error)
  }
}

/**
 * Calculate similarity between two strings (simple Levenshtein-based)
 * Returns value between 0.0 (completely different) and 1.0 (identical)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase()
  const s2 = str2.toLowerCase()

  // Early exit for identical strings
  if (s1 === s2) return 1.0

  const maxLen = Math.max(s1.length, s2.length)
  if (maxLen === 0) return 1.0

  // Simple normalized edit distance
  const distance = levenshteinDistance(s1, s2)
  return 1.0 - distance / maxLen
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        )
      }
    }
  }

  return dp[m][n]
}
