# Iris Weekend Improvements - Implementation Plan

**Date**: 2025-11-18
**Branch**: `ask_mike`
**Focus**: Production readiness for personal portfolio with enhanced user experience

---

## Overview

Building on the excellent foundation in the `ask_mike` branch (UI directives, MessageComposer, enhanced routing), we're adding:

1. **Analytics & Observability** - Track all queries in Supabase for insights
2. **Production Caching** - Upstash Redis for faster repeated queries
3. **Out-of-Scope Detection** - Reject inappropriate queries politely
4. **Better Auto-Drafting** - More intelligent message draft generation
5. **Response Bubbles** - Quick action suggestions after answers
6. **Error Tracking** - Sentry integration for production debugging

---

## Current State Analysis (ask_mike branch)

### What's Already Excellent ✅

1. **UI Directives System** (`useUiDirectives.ts`)
   - Detects `<ui:contact draft="..." reason="..." open="auto|cta" />` tags
   - Auto-opens MessageComposer for insufficient context
   - Shows ContactCta for suggested follow-ups

2. **MessageComposer** (`MessageComposer.tsx`)
   - Email/Phone/Anonymous contact methods
   - Form validation and localStorage caching
   - Auto-draft from Iris via `initialDraft` prop
   - Submits to `/api/inbox` with context

3. **Enhanced Features**
   - Evaluative routing v2 for comparative queries
   - Micro-planner for alias resolution
   - Debug mode showing intent/filters/context
   - Typeahead v2 with sentence completion

### What Needs Improvement 🔧

1. **No Analytics** - Can't see what users ask or identify failing queries
2. **No Caching** - Every query hits OpenAI twice (expensive, slow)
3. **No Scope Filtering** - Answers "What's 2+2?" instead of rejecting
4. **Limited Auto-Drafting** - Current drafts are generic
5. **No Quick Actions** - Users must type follow-ups manually
6. **No Error Tracking** - Production errors go into the void

---

## Implementation Plan

### Phase 1: Core Infrastructure (2-3 hours)

#### 1.1 Add Supabase Analytics

**Schema** (`/sql/iris_analytics.sql`):
```sql
-- Table to track all Iris queries
CREATE TABLE iris_queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Query details
  query TEXT NOT NULL,
  intent TEXT,
  filters JSONB,

  -- Results
  results_count INTEGER,
  context_items JSONB,
  answer_length INTEGER,

  -- Performance
  latency_ms INTEGER,
  cached BOOLEAN DEFAULT FALSE,

  -- Session tracking
  session_id TEXT,
  user_agent TEXT,

  -- Feedback (future)
  rating INTEGER,
  feedback TEXT,

  -- Indexing
  created_at_date DATE GENERATED ALWAYS AS (created_at::date) STORED
);

-- Indexes for common queries
CREATE INDEX idx_iris_queries_created_at ON iris_queries(created_at DESC);
CREATE INDEX idx_iris_queries_date ON iris_queries(created_at_date);
CREATE INDEX idx_iris_queries_intent ON iris_queries(intent);
CREATE INDEX idx_iris_queries_session ON iris_queries(session_id);

-- Table for quick action suggestions
CREATE TABLE iris_quick_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query_id UUID REFERENCES iris_queries(id),
  suggestion TEXT NOT NULL,
  clicked BOOLEAN DEFAULT FALSE,
  clicked_at TIMESTAMP WITH TIME ZONE
);
```

**Analytics Service** (`src/lib/iris/analytics.ts`):
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

export async function logQuery(data: QueryLog): Promise<string | null> {
  try {
    const { data: result, error } = await supabase
      .from('iris_queries')
      .insert([data])
      .select('id')
      .single()

    if (error) throw error
    return result.id
  } catch (error) {
    console.error('[Analytics] Failed to log query:', error)
    return null // Non-blocking
  }
}

export async function logQuickAction(
  query_id: string,
  suggestion: string
): Promise<void> {
  try {
    await supabase
      .from('iris_quick_actions')
      .insert([{ query_id, suggestion }])
  } catch (error) {
    console.error('[Analytics] Failed to log quick action:', error)
  }
}
```

#### 1.2 Apply Upstash Caching

Already implemented in stash - will apply with:
- `UpstashCache` class in `cache.ts`
- Auto-detects env vars and falls back to in-memory
- 1-hour TTL for answers
- Normalized keys for cache hits on similar queries

#### 1.3 Add Out-of-Scope Detection

Already implemented in stash - will apply with:
- `isOutOfScope()` function detecting math, weather, prompt injection
- `createOutOfScopeResponse()` polite redirect message
- Saves API costs on off-topic queries

---

### Phase 2: Enhanced Auto-Drafting (1-2 hours)

#### 2.1 Smart Draft Generation

Current system uses `<ui:contact draft="..." />` but drafts are sometimes generic. Improve with:

**Context-Aware Drafting** (`src/lib/iris/draft_generator.ts`):
```typescript
export interface DraftContext {
  query: string
  intent: string
  reason: 'insufficient_context' | 'more_detail' | 'user_request'
  context_items: Array<{ type: string; title: string }>
}

export function generateSmartDraft(ctx: DraftContext): string {
  // User explicitly asked to contact Mike
  if (ctx.reason === 'user_request') {
    return `I'd like to connect with you about: ${ctx.query}`
  }

  // Insufficient context - be specific about what's missing
  if (ctx.reason === 'insufficient_context') {
    // Extract entities from query
    const entities = extractKeyEntities(ctx.query)

    if (entities.length > 0) {
      return `I'm interested in learning more about ${entities.join(' and ')} from your experience. ${ctx.query}`
    }

    return `I have a question about: ${ctx.query}. Could you provide more details?`
  }

  // More detail needed for specific items
  if (ctx.reason === 'more_detail' && ctx.context_items.length > 0) {
    const items = ctx.context_items.map(i => i.title).slice(0, 2).join(' and ')
    return `I'd like to discuss ${items} in more detail. ${ctx.query}`
  }

  // Fallback
  return `Regarding: ${ctx.query}`
}

function extractKeyEntities(query: string): string[] {
  // Simple noun phrase extraction (can be enhanced with NLP)
  const entities: string[] = []

  // Look for quoted phrases
  const quotedRegex = /"([^"]+)"|'([^']+)'/g
  let match
  while ((match = quotedRegex.exec(query)) !== null) {
    entities.push(match[1] || match[2])
  }

  // Look for capitalized multi-word phrases (proper nouns)
  const properNounRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g
  while ((match = properNounRegex.exec(query)) !== null) {
    entities.push(match[1])
  }

  return entities
}
```

**Integration in Answer Route**:
```typescript
// When generating <ui:contact> directive
const draft = generateSmartDraft({
  query,
  intent,
  reason: 'insufficient_context',
  context_items: results.map(r => ({ type: r.doc.kind, title: r.doc.title }))
})

const directive = `<ui:contact reason="insufficient_context" draft="${draft}" open="auto" />`
```

---

### Phase 3: Response Bubble Quick Actions (2 hours)

#### 3.1 Quick Action System

**Component** (`src/components/iris/QuickActions.tsx`):
```typescript
interface QuickAction {
  id: string
  text: string
  icon?: React.ComponentType
  action: () => void
}

interface QuickActionsProps {
  query: string
  intent: string
  context_items: Array<{ type: string; title: string }>
  onSelect: (action: string) => void
}

export default function QuickActions({
  query,
  intent,
  context_items,
  onSelect
}: QuickActionsProps) {
  const actions = generateQuickActions({ query, intent, context_items })

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => {
            onSelect(action.text)
            action.action()
          }}
          className="
            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl
            bg-white/5 hover:bg-white/10 border border-white/20
            text-xs text-white/70 hover:text-white/90
            transition-all duration-200 transform hover:scale-105
          "
        >
          {action.icon && <action.icon className="w-3.5 h-3.5" />}
          {action.text}
        </button>
      ))}
    </div>
  )
}

function generateQuickActions(ctx: {
  query: string
  intent: string
  context_items: Array<{ type: string; title: string }>
}): QuickAction[] {
  const actions: QuickAction[] = []

  // Generic actions
  actions.push({
    id: 'tell-more',
    text: 'Tell me more',
    action: () => {} // Handled by onSelect
  })

  // Intent-specific actions
  if (ctx.intent === 'filter_query') {
    actions.push({
      id: 'show-details',
      text: 'Show project details',
      action: () => {}
    })
  }

  // Context-aware actions
  if (ctx.context_items.some(i => i.type === 'project')) {
    actions.push({
      id: 'how-built',
      text: 'How was this built?',
      action: () => {}
    })

    actions.push({
      id: 'similar',
      text: 'Show similar projects',
      action: () => {}
    })
  }

  // Always offer contact
  actions.push({
    id: 'contact',
    text: 'Message Mike',
    icon: Mail,
    action: () => {}
  })

  return actions.slice(0, 4) // Max 4 actions
}
```

#### 3.2 Integration in IrisPalette

```tsx
// After answer display
{!isProcessingQuery && answer && (
  <QuickActions
    query={submittedQuery}
    intent={debugInfo?.intent || ''}
    context_items={debugInfo?.contextItems || []}
    onSelect={(action) => {
      // Either submit as new query or trigger composer
      if (action === 'Message Mike') {
        setShowComposer(true)
      } else {
        setQuery(action)
        handleSubmitQuery(action)
      }
    }}
  />
)}
```

---

### Phase 4: Production Hardening (1 hour)

#### 4.1 Sentry Integration

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

**Configuration** (`sentry.server.config.ts`):
```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,

  beforeSend(event, hint) {
    // Scrub sensitive data
    if (event.request) {
      delete event.request.cookies
      if (event.request.data) {
        event.request.data = '[Filtered]'
      }
    }
    return event
  },
})
```

**Integration in Answer Route**:
```typescript
try {
  // ... answer generation
} catch (error) {
  Sentry.captureException(error, {
    tags: { intent },
    extra: {
      query: query.substring(0, 100), // Truncate for privacy
      results_count: results.length
    }
  })
  throw error
}
```

#### 4.2 Environment Variables Documentation

**`.env.example`**:
```bash
# OpenAI (Required)
OPENAI_API_KEY=sk-...

# Upstash Redis (Optional - enables caching)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Supabase (Optional - enables analytics)
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...

# Sentry (Optional - enables error tracking)
NEXT_PUBLIC_SENTRY_DSN=https://...

# GitHub (Optional - enables recent activity)
GITHUB_TOKEN=ghp_...
```

---

## Expected Outcomes

### Immediate Improvements

1. **Faster Responses**
   - Cached queries: <100ms (was ~800ms)
   - First-time queries: ~800ms (unchanged)
   - Cache hit rate: 50-70% after a week

2. **Lower Costs**
   - 50% reduction in OpenAI API calls
   - $36/month → $18/month (100 queries/day)

3. **Better UX**
   - Out-of-scope queries rejected politely
   - Smarter auto-draft messages
   - Quick action suggestions reduce friction

4. **Visibility**
   - All queries logged in Supabase
   - Error tracking in Sentry
   - Can identify common patterns/failures

### Data-Driven Insights (After 1 Week)

**Query Analytics Dashboard** (Supabase SQL):
```sql
-- Most common queries
SELECT query, COUNT(*) as count
FROM iris_queries
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY query
ORDER BY count DESC
LIMIT 20;

-- Intent distribution
SELECT intent, COUNT(*) as count
FROM iris_queries
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY intent;

-- Performance metrics
SELECT
  AVG(latency_ms) as avg_latency,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency,
  COUNT(CASE WHEN cached THEN 1 END)::float / COUNT(*) as cache_hit_rate
FROM iris_queries
WHERE created_at > NOW() - INTERVAL '7 days';

-- Failing queries (no results)
SELECT query, COUNT(*) as count
FROM iris_queries
WHERE results_count = 0
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY query
ORDER BY count DESC
LIMIT 10;
```

---

## Migration Steps

### For Local Development

1. **Install dependencies**:
   ```bash
   npm install @upstash/redis @supabase/supabase-js @sentry/nextjs
   ```

2. **Set up Upstash** (free tier):
   - Sign up at https://upstash.com
   - Create Redis database
   - Copy REST URL and token to `.env.local`

3. **Set up Supabase** (free tier):
   - Sign up at https://supabase.com
   - Create project
   - Run `sql/iris_analytics.sql` in SQL editor
   - Copy project URL and service role key to `.env.local`

4. **Set up Sentry** (free tier):
   - Sign up at https://sentry.io
   - Run wizard: `npx @sentry/wizard@latest -i nextjs`
   - Copy DSN to `.env.local`

5. **Test locally**:
   ```bash
   npm run dev
   # Open Iris, ask a few questions
   # Check Supabase dashboard for logged queries
   # Trigger an error and check Sentry
   ```

### For Production (Vercel)

1. **Add environment variables** in Vercel dashboard:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SENTRY_DSN`
   - `SENTRY_AUTH_TOKEN` (from wizard)

2. **Deploy**:
   ```bash
   git push origin ask_mike
   # Vercel auto-deploys
   ```

3. **Monitor**:
   - Supabase: Query analytics
   - Sentry: Error tracking
   - Vercel: Function logs

---

## Success Metrics

### Week 1
- ✅ All queries logged in Supabase
- ✅ Cache hit rate >30%
- ✅ No errors in Sentry
- ✅ Out-of-scope queries rejected

### Week 2-4
- ✅ Cache hit rate >50%
- ✅ Identify top 10 common queries
- ✅ Find and fix failing query patterns
- ✅ Users click quick actions >20% of the time

### Month 1
- ✅ Cost reduced by 40-50%
- ✅ Average latency <600ms
- ✅ 95% of queries get good answers
- ✅ Zero production errors

---

## Rollback Plan

If anything breaks:

1. **Disable Upstash caching**:
   - Remove `UPSTASH_*` env vars
   - System falls back to in-memory cache

2. **Disable analytics**:
   - Remove `SUPABASE_*` env vars
   - Analytics calls fail gracefully (non-blocking)

3. **Disable Sentry**:
   - Remove `SENTRY_*` env vars
   - No error tracking, but system works

4. **Revert to main**:
   ```bash
   git checkout main
   git push -f origin ask_mike
   ```

---

## Next Steps

Once weekend improvements are stable:

1. **Week 2**: Add conversation memory (5 messages history)
2. **Week 3**: Build admin dashboard for KB management
3. **Week 4**: Add user feedback (thumbs up/down on answers)
4. **Month 2**: Implement semantic caching (similar queries → cache hit)

---

## Timeline

**Total Effort**: ~8 hours

| Phase | Task | Time | Priority |
|-------|------|------|----------|
| 1.1 | Supabase analytics | 2h | P0 |
| 1.2 | Upstash caching | 30min | P0 |
| 1.3 | Out-of-scope detection | 30min | P0 |
| 2.1 | Smart draft generation | 2h | P1 |
| 3.1 | Quick actions component | 2h | P1 |
| 4.1 | Sentry integration | 30min | P1 |
| 4.2 | Documentation | 30min | P2 |

**This weekend**: Focus on P0 tasks (3 hours)
**Next week**: Complete P1 tasks (4 hours)
**Nice to have**: P2 tasks (30 min)
