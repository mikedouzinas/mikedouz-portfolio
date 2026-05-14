/**
 * scripts/sync_blogs.ts
 *
 * Pulls the latest published posts from /api/the-web and merges any NEW posts
 * into src/data/iris/kb/blogs.json. Existing entries are left untouched so
 * manual fields (context, summary, related_projects, etc.) survive.
 *
 * Usage:
 *   npm run sync:blogs              # hits production (mikeveson.com)
 *   npm run sync:blogs -- --local   # hits http://localhost:3000
 *
 * Wire this into the vault's /publish skill as a post-publish step so new
 * posts auto-flow into blogs.json on publish.
 */

import * as fs from "fs";
import * as path from "path";

const KB_PATH = path.resolve(__dirname, "../src/data/iris/kb/blogs.json");
const PROD_BASE = "https://mikeveson.com";
const LOCAL_BASE = "http://localhost:3000";

interface ApiPost {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  tags?: string[];
  published_at: string; // ISO
  cover_image?: string | null;
}

interface BlogsJsonEntry {
  title: string;
  url: string;
  image?: string;
  published_date: string;
  description: string;
  context?: string;
  summary?: string;
  class?: string | null;
  related_class?: string | null;
  related_experiences?: string[];
  related_projects?: string[];
  tags?: string[];
  [k: string]: unknown;
}

interface BlogsJson {
  blog_posts: BlogsJsonEntry[];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function entryFromApi(p: ApiPost): BlogsJsonEntry {
  return {
    title: p.title,
    url: `/the-web/${p.slug}`,
    image: p.cover_image || undefined,
    published_date: formatDate(p.published_at),
    description: p.subtitle || "",
    context: "",
    summary: "",
    class: null,
    related_class: null,
    related_experiences: [],
    related_projects: [],
    tags: p.tags || [],
  };
}

async function main() {
  const useLocal = process.argv.includes("--local");
  const base = useLocal ? LOCAL_BASE : PROD_BASE;
  const url = `${base}/api/the-web?limit=100`;

  console.log(`[sync:blogs] fetching ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`[sync:blogs] fetch failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const data = (await res.json()) as { posts: ApiPost[] };
  const apiPosts = data.posts || [];
  console.log(`[sync:blogs] received ${apiPosts.length} posts from API`);

  const raw = fs.readFileSync(KB_PATH, "utf-8");
  const kb = JSON.parse(raw) as BlogsJson;

  const existingUrls = new Set(kb.blog_posts.map((e) => e.url));
  const apiUrls = new Set(apiPosts.map((p) => `/the-web/${p.slug}`));

  // Add new posts (URL not present in blogs.json)
  let added = 0;
  for (const p of apiPosts) {
    const url = `/the-web/${p.slug}`;
    if (existingUrls.has(url)) continue;
    kb.blog_posts.push(entryFromApi(p));
    added += 1;
    console.log(`[sync:blogs] + added: ${p.title} (${url})`);
  }

  // Warn about blogs.json entries that no longer exist in the API
  // (excludes the umbrella entry /the-web and any external posts).
  for (const e of kb.blog_posts) {
    if (e.url === "/the-web") continue;
    if (!e.url.startsWith("/the-web/")) continue;
    if (!apiUrls.has(e.url)) {
      console.warn(`[sync:blogs] ! local entry not in API: ${e.url}`);
    }
  }

  if (added === 0) {
    console.log("[sync:blogs] nothing to add; blogs.json already in sync.");
    return;
  }

  fs.writeFileSync(KB_PATH, JSON.stringify(kb, null, 2) + "\n", "utf-8");
  console.log(`[sync:blogs] wrote ${added} new entries to ${path.relative(process.cwd(), KB_PATH)}`);
  console.log("[sync:blogs] review the diff, fill in context/summary, then commit.");
}

main().catch((err) => {
  console.error("[sync:blogs] fatal:", err);
  process.exit(1);
});
