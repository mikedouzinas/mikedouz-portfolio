# Quick Vercel Setup Checklist

This is a quick reference for deploying to Vercel with all required environment variables.

## 1. Get Your API Keys First

Before deploying, make sure you have:
- [ ] OpenAI API key from https://platform.openai.com/api-keys
- [ ] Upstash Redis URL + Token from https://console.upstash.com/
- [ ] Supabase URL + Keys from https://app.supabase.com/
- [ ] (Optional) GitHub token from https://github.com/settings/tokens

See [SETUP.md](./SETUP.md) for detailed instructions on obtaining these.

## 2. Add to Vercel Environment Variables

Go to your Vercel project → **Settings** → **Environment Variables**

Add these **one by one**:

### Required Variables

| Variable Name | Where to Get It | Example Value |
|--------------|-----------------|---------------|
| `OPENAI_API_KEY` | OpenAI Dashboard → API Keys | `sk-proj-...` |
| `UPSTASH_REDIS_REST_URL` | Upstash Console → Database → Details | `https://xxx.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Console → Database → Details | `AXX...` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | `eyJhbG...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (click Reveal) | `eyJhbG...` |

### Optional Variables

| Variable Name | Where to Get It | Purpose |
|--------------|-----------------|---------|
| `GITHUB_TOKEN` | GitHub → Settings → Tokens | Recent activity in responses |

## 3. Select Environments

For each variable, select:
- ✅ **Production**
- ✅ **Preview**
- ✅ **Development** (optional, for `vercel dev`)

## 4. Set Up Supabase Tables

**Important**: Run this SQL in Supabase **before** deploying:

1. Open [Supabase SQL Editor](https://app.supabase.com/)
2. Select your project
3. Go to **SQL Editor** → **New Query**
4. Copy and paste the contents of **`sql/iris_analytics.sql`** from your repo
5. Click **Run**
6. Verify tables created in **Table Editor**

Required tables:
- ✅ `iris_queries`
- ✅ `iris_quick_actions`
- ✅ Analytics views (iris_daily_stats, etc.)

Optional (for inbox feature):
- Run `supabase/migrations/20251027_inbox.sql`
- Run `supabase/migrations/20251027_inbox_add_context.sql`
- Creates `inbox_messages` table

## 5. Deploy

### Option A: GitHub Auto-Deploy (Recommended)
- Just push to your main branch
- Vercel will auto-deploy with the new env vars

### Option B: Manual Deploy
```bash
vercel --prod
```

## 6. Verify Deployment

After deployment:

1. **Test Iris**: Visit your site → Click Iris button → Ask a question
2. **Check Analytics**:
   - Supabase → Table Editor → `iris_queries`
   - Should see your query logged
3. **Check Cache**:
   - Upstash Console → Data Browser
   - Search for `iris:answer:*` keys
4. **Check Logs**:
   - Vercel → Deployments → Latest → Functions
   - Look for `/api/iris/answer` logs

## 7. Access Admin Features

### View Inbox Messages
- Go to: `https://your-site.com/admin/inbox`
- See all contact form submissions
- Requires authentication (you may want to add auth)

### View Analytics (Supabase)
Run queries in SQL Editor:
```sql
-- Recent queries
SELECT * FROM iris_queries ORDER BY created_at DESC LIMIT 20;

-- Daily stats
SELECT * FROM iris_daily_stats ORDER BY query_date DESC LIMIT 7;

-- Cache performance
SELECT
  COUNT(*) as total_queries,
  ROUND(AVG(latency_ms)) as avg_latency_ms,
  ROUND(COUNT(*) FILTER (WHERE cached = true)::numeric / COUNT(*) * 100, 2) as cache_hit_rate
FROM iris_queries
WHERE created_at > NOW() - INTERVAL '7 days';
```

## Troubleshooting

### Build Fails
- Check all env vars are set correctly
- Verify no typos in variable names
- Make sure `OPENAI_API_KEY` is set (required for build)

### Iris Not Working
- Check Function logs in Vercel
- Common issues:
  - Missing `OPENAI_API_KEY`
  - Incorrect Upstash URL/token
  - Supabase tables not created

### No Analytics
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set (not just anon key)
- Check SQL migrations were run
- Look for errors in Function logs

### Cache Not Working
- Verify both Upstash env vars are set
- Check Upstash database is active (not paused)
- Iris will fall back to in-memory cache (non-critical)

## Security Checklist

Before going live:
- [ ] All API keys added to Vercel (not in code)
- [ ] `.env.local` is in `.gitignore`
- [ ] No secrets committed to git
- [ ] Service role key only used server-side
- [ ] Rate limiting enabled (already in code)

## Cost Monitoring

Set up alerts:
- **OpenAI**: [Platform → Usage](https://platform.openai.com/usage) - Set billing alerts
- **Upstash**: Free tier is generous, monitor in console
- **Supabase**: Free tier should be sufficient, check database size
- **Vercel**: Hobby plan includes generous limits

Expected monthly cost for personal portfolio: **$3-15/month** (mostly OpenAI)

---

**Next Steps**: See [SETUP.md](./SETUP.md) for detailed setup instructions for each service.
