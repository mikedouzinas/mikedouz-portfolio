# Iris Setup Guide

This guide walks you through setting up all required services for your portfolio's Iris AI assistant.

## Overview

Iris requires the following services:
- **OpenAI** (required) - AI responses and embeddings
- **Upstash Redis** (required for production) - Response caching
- **Supabase** (required for production) - Analytics and inbox storage
- **GitHub Token** (optional) - Recent activity context

---

## 1. OpenAI API Key

**Purpose**: Powers Iris AI responses, intent detection, and embeddings.

### Setup Steps:

1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click **"Create new secret key"**
4. Give it a name (e.g., "Portfolio Iris")
5. Copy the key (starts with `sk-`)
6. Add to your `.env.local`:
   ```bash
   OPENAI_API_KEY=sk-...
   ```

**Cost**: Pay-as-you-go. Typical portfolio usage: $3-36/month
- GPT-4o-mini (embeddings): ~$0.50/month
- GPT-4o (responses): ~$2-35/month depending on traffic

---

## 2. Upstash Redis

**Purpose**: Caches Iris responses for 1 hour to reduce costs and improve speed.

### Setup Steps:

1. Go to [Upstash Console](https://console.upstash.com/)
2. Sign in with GitHub/Google
3. Click **"Create Database"**
   - Name: `iris-cache` (or whatever you prefer)
   - Type: **Regional** (cheaper for portfolio use)
   - Region: Choose closest to your Vercel deployment
   - Eviction: **LRU** (recommended)
4. After creation, go to database **Details** tab
5. Scroll to **REST API** section
6. Copy **UPSTASH_REDIS_REST_URL** and **UPSTASH_REDIS_REST_TOKEN**
7. Add to your `.env.local`:
   ```bash
   UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
   UPSTASH_REDIS_REST_TOKEN=AXXXabc...
   ```

**Cost**: Free tier (10,000 commands/day) is sufficient for portfolio use.

**Note**: Without Upstash configured, Iris will fall back to in-memory caching (works fine for development).

---

## 3. Supabase

**Purpose**: Stores analytics (query logs, performance metrics) and inbox messages.

### Setup Steps:

#### 3.1 Create Supabase Project

1. Go to [Supabase](https://app.supabase.com/)
2. Sign in with GitHub
3. Click **"New Project"**
   - Organization: Create one if needed
   - Name: `portfolio-iris` (or your preference)
   - Database Password: Generate a strong password (save it!)
   - Region: Choose closest to Vercel deployment
4. Wait for project to be created (~2 minutes)

#### 3.2 Get API Keys

1. Go to **Settings** → **API** in left sidebar
2. Copy the following:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public** key (under Project API keys)
   - **service_role** key (click "Reveal" first - keep this secret!)

3. Add to your `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
   ```

#### 3.3 Create Database Tables

1. In Supabase dashboard, go to **SQL Editor** in left sidebar
2. Click **"New Query"**
3. Copy the entire contents of `sql/iris_analytics.sql` from your repo
4. Paste into the SQL editor
5. Click **"Run"** (or press Cmd/Ctrl + Enter)
6. You should see: "Success. No rows returned"

This creates:
- `iris_queries` table - Stores all Iris queries with performance metrics
- `iris_quick_actions` table - Tracks quick action suggestions
- Analytics views for reporting

7. Go to **Table Editor** in left sidebar to verify tables were created

#### 3.4 Run Inbox Migration (Optional but Recommended)

If you want the inbox feature (contact form messages):

1. In SQL Editor, run `supabase/migrations/20251027_inbox.sql`
2. Then run `supabase/migrations/20251027_inbox_add_context.sql`

This creates the `inbox_messages` table.

**Cost**: Free tier (500 MB database, 2 GB bandwidth) is more than sufficient for portfolio analytics.

---

## 4. GitHub Token (Optional)

**Purpose**: Allows Iris to mention your recent GitHub activity in responses.

### Setup Steps:

1. Go to [GitHub Settings → Tokens](https://github.com/settings/tokens)
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Settings:
   - Note: `Portfolio Iris - Recent Activity`
   - Expiration: 90 days (or "No expiration" if you trust your deployment security)
   - Scopes:
     - ✅ `public_repo` (read-only access to public repos)
4. Click **"Generate token"**
5. Copy the token (starts with `ghp_`)
6. Add to your `.env.local`:
   ```bash
   GITHUB_TOKEN=ghp_...
   ```

**Cost**: Free

**Note**: Without this, Iris will still work but won't mention recent GitHub projects.

---

## 5. Vercel Deployment

Once you have all the keys, add them to Vercel:

### Option A: Vercel Dashboard (Recommended)

1. Go to your project on [Vercel](https://vercel.com/dashboard)
2. Go to **Settings** → **Environment Variables**
3. Add each variable:
   - Name: `OPENAI_API_KEY`
   - Value: `sk-...`
   - Environment: Select **Production**, **Preview**, **Development**
   - Click **"Save"**

4. Repeat for all variables:
   ```
   OPENAI_API_KEY
   UPSTASH_REDIS_REST_URL
   UPSTASH_REDIS_REST_TOKEN
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   GITHUB_TOKEN (optional)
   ```

5. **Redeploy** your site (Settings → Deployments → click ⋯ → Redeploy)

### Option B: Vercel CLI

```bash
vercel env add OPENAI_API_KEY
# Paste your key when prompted
# Select: Production, Preview, Development

# Repeat for all variables
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add GITHUB_TOKEN

# Redeploy
vercel --prod
```

---

## 6. Verify Everything Works

### Local Development

1. Create `.env.local` with all your keys:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your actual keys
   ```

2. Rebuild embeddings and typeahead:
   ```bash
   npm run kb:rebuild
   ```

3. Start dev server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000 and click the Iris button
5. Try a query like: "What projects has Mike built?"
6. Check terminal for logs showing:
   - `[IrisCache] Using Upstash Redis cache` (if configured)
   - `[Analytics] Logging query...` (if Supabase configured)

### Production Verification

1. Deploy to Vercel with all env vars set
2. Visit your production site
3. Open Iris and ask a question
4. Check Supabase:
   - Go to **Table Editor** → `iris_queries`
   - You should see your query logged
5. Check Upstash:
   - Go to Upstash Console → your database → **Data Browser**
   - Search for keys starting with `iris:answer:`
   - You should see cached responses

---

## 7. View Analytics (Optional)

To see query analytics in Supabase:

1. Go to **SQL Editor** in Supabase
2. Try these queries:

**Recent queries:**
```sql
SELECT created_at, query, intent, latency_ms, cached
FROM iris_queries
ORDER BY created_at DESC
LIMIT 20;
```

**Daily stats:**
```sql
SELECT * FROM iris_daily_stats
ORDER BY query_date DESC
LIMIT 7;
```

**Most common queries:**
```sql
SELECT * FROM iris_common_queries
LIMIT 10;
```

**Performance metrics:**
```sql
SELECT * FROM iris_performance;
```

---

## Troubleshooting

### "Missing OPENAI_API_KEY"
- Check `.env.local` exists and has the key
- For Vercel: Check Settings → Environment Variables
- Redeploy after adding env vars

### "Upstash connection failed"
- Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- Check Upstash database is active (not paused)
- Iris will fall back to in-memory cache if Upstash fails (non-critical)

### "Supabase connection failed"
- Verify all 3 Supabase env vars are set
- Check project URL doesn't have trailing slash
- Verify service role key is correct (not the anon key)
- Check tables were created (SQL Editor → run `\dt` to list tables)

### "No queries showing in analytics"
- Check Supabase RLS (Row Level Security) is disabled for `iris_queries` table
  - Go to **Authentication** → **Policies**
  - The table should have no RLS policies, or a policy allowing inserts
- Check browser console for errors
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set (not just anon key)

---

## Cost Summary

**Minimum (Free Tier):**
- OpenAI: ~$3-36/month (pay-as-you-go based on traffic)
- Upstash: Free (up to 10k commands/day)
- Supabase: Free (up to 500 MB database)
- GitHub: Free
- **Total: ~$3-36/month**

**Expected for Personal Portfolio:**
- 10-100 queries/day
- 50-70% cache hit rate after first week
- **Realistic cost: $3-15/month**

---

## Security Notes

⚠️ **Never commit** `.env.local` to git - it's in `.gitignore`

⚠️ **Keep service role key secret** - only use in server-side code

✅ **Safe to expose** in client code:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

❌ **Never expose** in client code:
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `UPSTASH_REDIS_REST_TOKEN`

---

## Next Steps

Once everything is set up:
1. ✅ Test Iris locally
2. ✅ Deploy to Vercel with env vars
3. ✅ Verify analytics in Supabase
4. 📊 Monitor costs in OpenAI dashboard
5. 📈 Check cache hit rate in Upstash

Need help? Check the troubleshooting section above or open an issue.
