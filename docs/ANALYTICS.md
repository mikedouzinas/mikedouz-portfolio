# Iris Analytics System

**Last Updated**: 2025-11-21

Comprehensive analytics system for tracking Iris usage, performance, and user behavior.

---

## 📊 Overview

The analytics system integrates **Supabase** (for detailed query logs) and **Vercel Analytics** (for visitor tracking and custom events) to provide complete visibility into how users interact with Iris.

### Key Features

- ✅ **Unified Tracking**: Links Vercel visitor IDs with Supabase query logs
- ✅ **Geographic Data**: Country, city, region from Vercel Edge Network
- ✅ **Device Detection**: Mobile, tablet, desktop classification
- ✅ **Conversation Threading**: Track full chat histories with parent-child relationships
- ✅ **Rich Metadata**: IP address, referrer, screen size, user agent
- ✅ **Custom Vercel Events**: Track Iris queries in Vercel Analytics dashboard
- ✅ **Performance Insights**: Latency, cache hit rates, p50/p95/p99 metrics
- ✅ **Admin Dashboard**: Beautiful charts and visualizations at `/admin/analytics`

---

## 🏗️ Architecture

### Data Flow

```
User Query (⌘K)
    ↓
IrisPalette Component
    ├─ Screen Size Header: x-screen-size
    ├─ Parent Query ID: For threading
    └─ Query submitted
        ↓
Answer API Route
    ├─ Extract Metadata
    │   ├─ Vercel Geo Headers (country, city, region)
    │   ├─ Visitor ID (from cookie or header)
    │   ├─ Device Type (from user agent)
    │   └─ IP Address, Referrer
    ├─ Process Query
    ├─ Log to Supabase
    │   └─ ALL metadata fields
    └─ Track in Vercel
        └─ Custom event: iris_query
```

### Database Schema

**New Columns in `iris_queries`:**
```sql
visitor_id TEXT             -- Vercel Analytics visitor ID
ip_address TEXT             -- IP address
country TEXT                -- Country code (US, CA, GB, etc.)
city TEXT                   -- City name
region TEXT                 -- State/region
referrer TEXT               -- HTTP referer
device_type TEXT            -- mobile, tablet, or desktop
screen_size TEXT            -- e.g., "1920x1080"
parent_query_id UUID        -- Parent query for threading
conversation_depth INTEGER  -- Depth in conversation tree
```

**New Views:**
- `iris_daily_stats_enhanced` - Daily stats with visitor and geo data
- `iris_geographic_stats` - Geographic distribution
- `iris_device_stats` - Device type distribution
- `iris_conversations` - Conversation threads
- `iris_visitor_summary` - Per-visitor activity

**New Functions:**
- `get_conversation_thread(root_query_id)` - Recursive query to get full thread

---

## 🚀 Setup

### 1. Run Supabase Migration

```bash
# Connect to your Supabase project
psql postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres

# Run the migration
\i supabase/migrations/20251121_analytics_enhanced.sql
```

Or use Supabase Studio:
1. Go to SQL Editor
2. Copy contents of `supabase/migrations/20251121_analytics_enhanced.sql`
3. Execute

### 2. Enable Vercel Analytics

Already enabled! The following are included in the project:

```typescript
// src/app/layout.tsx
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

<Analytics />        // Visitor tracking + custom events
<SpeedInsights />    // Core Web Vitals
```

### 3. Environment Variables

Ensure these are set:

```bash
# Supabase (for detailed logs)
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

# Admin access
ADMIN_API_KEY=...
```

---

## 📈 Usage

### Accessing the Dashboard

**URL**: `/admin/analytics`

**Authentication**: Set the `x-admin-key` header:

```bash
# Using curl
curl -H "x-admin-key: your_admin_api_key" \
  https://yourdomain.com/admin/analytics

# In Chrome/Firefox with ModHeader extension:
# 1. Install ModHeader extension
# 2. Add header: x-admin-key = your_admin_api_key
# 3. Visit /admin/analytics
```

**Time Ranges**: Add `?days=N` parameter (7, 14, 30, or 90)
- `/admin/analytics?days=7` (default)
- `/admin/analytics?days=30`

### Dashboard Sections

1. **Overview Cards**
   - Total Queries
   - Unique Visitors
   - Average Latency
   - Cache Hit Rate

2. **Queries Over Time**
   - Line chart showing daily query volume

3. **Intent Distribution**
   - Pie chart of query intents (general, specific_item, filter_query, etc.)

4. **Device Types**
   - Bar chart: mobile vs tablet vs desktop

5. **Geographic Distribution**
   - Top 10 countries by query count

6. **Top Queries**
   - Most frequently asked questions

7. **Recent Conversations**
   - Expandable conversation threads
   - Shows follow-up queries
   - Conversation depth tracking

---

## 🔍 Querying Analytics Data

### Direct Supabase Queries

```sql
-- Get all queries from last 7 days
SELECT * FROM iris_queries
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Geographic distribution
SELECT * FROM iris_geographic_stats;

-- Device breakdown
SELECT * FROM iris_device_stats;

-- Get a specific conversation thread
SELECT * FROM get_conversation_thread('query-id-here');

-- Top visitors
SELECT * FROM iris_visitor_summary
ORDER BY total_queries DESC
LIMIT 10;

-- Failed queries (for debugging)
SELECT query, intent, created_at
FROM iris_queries
WHERE results_count = 0
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

### Using the Analytics API

```typescript
// In your code
import { getEnhancedAnalytics } from '@/lib/iris/analytics';

const data = await getEnhancedAnalytics(7); // Last 7 days

// Returns:
{
  overview: {
    total_queries: number,
    unique_visitors: number,
    avg_latency_ms: number,
    cache_hit_rate: number
  },
  geographic: [{ country, count }],
  devices: [{ device, count }],
  intents: [{ intent, count }],
  top_queries: [{ query, count }],
  time_series: [{ date, count }],
  conversations: [...]
}
```

---

## 🔗 Linking Vercel + Supabase Data

### Visitor Tracking

Each query has a `visitor_id` that corresponds to Vercel Analytics:

1. **In Vercel Dashboard**:
   - Go to Analytics > Events
   - Filter by event: `iris_query`
   - See visitor IDs, countries, devices

2. **In Supabase**:
   - Query by `visitor_id` to see all queries from a specific user
   - Cross-reference with Vercel page views

```sql
-- Get all queries from a specific visitor
SELECT query, intent, created_at, country, device_type
FROM iris_queries
WHERE visitor_id = 'va_...'
ORDER BY created_at ASC;
```

### Conversation Threading

Track full chat histories:

```sql
-- Get root queries (conversation starters)
SELECT * FROM iris_queries
WHERE parent_query_id IS NULL
ORDER BY created_at DESC;

-- Get entire conversation
SELECT * FROM get_conversation_thread('root-query-id');
```

---

## 📊 Vercel Analytics Custom Events

Every Iris query triggers a Vercel custom event:

**Event Name**: `iris_query`

**Properties**:
- `intent` - Query intent type
- `cached` - Whether served from cache
- `latency_ms` - Response time
- `results_count` - Number of results (for non-cached)
- `country` - User's country
- `device` - Device type

**Viewing in Vercel**:
1. Go to your project dashboard
2. Click "Analytics"
3. Click "Events" tab
4. Filter by `iris_query`

---

## 🛠️ Maintenance

### Cleaning Old Data

```sql
-- Delete queries older than 90 days
DELETE FROM iris_queries
WHERE created_at < NOW() - INTERVAL '90 days';
```

### Monitoring Performance

```sql
-- Check average latency by country
SELECT
  country,
  COUNT(*) as queries,
  ROUND(AVG(latency_ms)::numeric, 2) as avg_latency_ms
FROM iris_queries
WHERE country IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY country
ORDER BY queries DESC;

-- Check cache effectiveness
SELECT
  DATE(created_at) as date,
  COUNT(*) as total,
  COUNT(CASE WHEN cached THEN 1 END) as cached_count,
  ROUND(COUNT(CASE WHEN cached THEN 1 END)::numeric / COUNT(*)::numeric * 100, 2) as cache_hit_percent
FROM iris_queries
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## 🔐 Security & Privacy

### PII Handling

- **IP Addresses**: Logged but not displayed in dashboard
- **Visitor IDs**: Anonymized by Vercel (not personally identifiable)
- **Queries**: User questions are logged for analytics
- **No Tracking**: No personal data (names, emails) unless explicitly submitted via contact form

### Access Control

- Dashboard requires `x-admin-key` header
- Supabase RLS enabled on tables
- Service role key used for server-side operations only

---

## 📝 Example Insights

### Question 1: Where are users coming from?

```sql
SELECT country, COUNT(*) as queries
FROM iris_queries
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY country
ORDER BY queries DESC;
```

### Question 2: What are users asking about?

```sql
SELECT query, COUNT(*) as frequency
FROM iris_queries
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY query
ORDER BY frequency DESC
LIMIT 20;
```

### Question 3: How long are conversations?

```sql
SELECT
  conversation_depth,
  COUNT(*) as count
FROM iris_queries
WHERE parent_query_id IS NOT NULL
GROUP BY conversation_depth
ORDER BY conversation_depth;
```

### Question 4: Mobile vs Desktop usage?

```sql
SELECT
  device_type,
  COUNT(*) as queries,
  ROUND(AVG(latency_ms)::numeric, 2) as avg_latency
FROM iris_queries
WHERE device_type IS NOT NULL
GROUP BY device_type;
```

---

## 🐛 Troubleshooting

### Issue: No data in dashboard

**Check**:
1. Supabase migration ran successfully
2. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
3. Queries are being made to Iris (press ⌘K and ask something)
4. Check Supabase logs for errors

### Issue: Visitor ID is null

**Cause**: Vercel Analytics not initialized or cookies blocked

**Fix**:
- Ensure `<Analytics />` is in `layout.tsx`
- Check browser console for errors
- Verify cookies are enabled

### Issue: Geo data is null

**Cause**: Not deployed to Vercel Edge Network

**Fix**:
- Geo headers only work on Vercel deployment
- Local development won't have geo data
- Deploy to Vercel to test

### Issue: Can't access dashboard

**Check**:
1. `ADMIN_API_KEY` is set in environment variables
2. `x-admin-key` header matches the env var
3. Not on RLS-restricted network

---

## 🚀 Future Enhancements

Potential additions:

1. **Real-Time Dashboard** - WebSocket updates
2. **Alerts** - Email/Slack for anomalies
3. **A/B Testing** - Compare different answer strategies
4. **Sentiment Analysis** - Analyze user satisfaction
5. **Funnel Analysis** - Track user journey from landing → query → contact
6. **Export** - CSV/JSON download of analytics data
7. **Retention Metrics** - Track returning visitors
8. **Cohort Analysis** - Group users by behavior

---

## 📚 Related Files

- `src/lib/iris/analytics.ts` - Core analytics functions
- `src/lib/iris/metadata.ts` - Metadata extraction utilities
- `src/app/api/iris/answer/route.ts` - Query logging
- `src/components/IrisPalette.tsx` - Frontend tracking
- `src/app/admin/analytics/page.tsx` - Admin dashboard
- `src/components/analytics/AnalyticsDashboard.tsx` - Dashboard component
- `supabase/migrations/20251121_analytics_enhanced.sql` - Database schema

---

**Need Help?** Check the [main README](../README.md) or ask Iris directly on [mikeveson.com](https://mikeveson.com)!
