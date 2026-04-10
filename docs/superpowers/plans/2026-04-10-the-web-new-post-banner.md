# The Web — New Post Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dismissable homepage banner that promotes the latest blog post when it's less than 3 days old, using bright teal web-themed styling.

**Architecture:** Single client component (`WebBanner`) fetched client-side from the existing `/api/the-web?limit=1` endpoint. Renders between About and Experience on the homepage. Dismiss state stored in localStorage keyed by post slug.

**Tech Stack:** React 19, Next.js 15 App Router, Tailwind CSS, localStorage

---

### Task 1: Create WebBanner Component

**Files:**
- Create: `src/components/WebBanner.tsx`

- [ ] **Step 1: Create the component file with full implementation**

```tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface LatestPost {
  slug: string;
  title: string;
  published_at: string;
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function isDismissed(slug: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(`web-banner-dismissed-${slug}`) === 'true';
}

function dismiss(slug: string): void {
  localStorage.setItem(`web-banner-dismissed-${slug}`, 'true');
}

function isFresh(publishedAt: string): boolean {
  return Date.now() - new Date(publishedAt).getTime() < THREE_DAYS_MS;
}

export default function WebBanner() {
  const [post, setPost] = useState<LatestPost | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch('/api/the-web?limit=1')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.posts?.[0]) return;
        const latest = data.posts[0];
        if (isFresh(latest.published_at) && !isDismissed(latest.slug)) {
          setPost({ slug: latest.slug, title: latest.title, published_at: latest.published_at });
        }
      })
      .catch(() => {});
  }, []);

  if (!post || dismissed) return null;

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dismiss(post.slug);
    setDismissed(true);
  };

  return (
    <Link
      href={`/the-web/${post.slug}`}
      className="block group relative transition-transform duration-200 hover:scale-[1.01]"
    >
      {/* SVG dotted border */}
      <svg
        className="absolute -inset-px pointer-events-none z-10"
        preserveAspectRatio="none"
        style={{ width: 'calc(100% + 2px)', height: 'calc(100% + 2px)' }}
      >
        <rect
          x="1" y="1"
          width="calc(100% - 2px)"
          height="calc(100% - 2px)"
          rx="16" ry="16"
          fill="none"
          stroke="rgba(45, 212, 191, 0.35)"
          strokeWidth="1.5"
          strokeDasharray="3 6"
          strokeLinecap="round"
        />
      </svg>

      {/* Container */}
      <div
        className="relative overflow-hidden rounded-2xl px-4 py-4 sm:px-[18px]"
        style={{
          background: 'rgba(8, 38, 38, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1.5px solid transparent',
          boxShadow:
            '0 8px 20px rgba(0,0,0,0.25), 0 0 30px rgba(45,212,191,0.06), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Web pattern background */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 520 90"
          preserveAspectRatio="none"
          style={{ opacity: 0.1 }}
        >
          <line x1="80" y1="0" x2="110" y2="90" stroke="#2dd4bf" strokeWidth="0.6" />
          <line x1="200" y1="0" x2="175" y2="90" stroke="#2dd4bf" strokeWidth="0.6" />
          <line x1="320" y1="0" x2="345" y2="90" stroke="#2dd4bf" strokeWidth="0.6" />
          <line x1="440" y1="0" x2="415" y2="90" stroke="#2dd4bf" strokeWidth="0.6" />
          <path d="M 0 30 Q 130 20 260 30 Q 390 40 520 30" fill="none" stroke="#2dd4bf" strokeWidth="0.5" />
          <path d="M 0 60 Q 130 50 260 60 Q 390 70 520 60" fill="none" stroke="#2dd4bf" strokeWidth="0.5" />
        </svg>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-2.5 right-3 z-20 flex items-center justify-center w-6 h-6 rounded-full text-slate-500/50 hover:text-slate-400 hover:bg-white/5 transition-colors"
          aria-label="Dismiss banner"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="relative z-[1]">
          {/* Top: context + brand */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Mike&apos;s blog</span>
            <span className="text-[11px] text-slate-600/40">&middot;</span>
            <span className="text-[10px] text-teal-400 uppercase tracking-wider font-semibold">
              the web
            </span>
          </div>

          {/* Dotted web separator */}
          <div
            className="my-2.5 h-px"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(45,212,191,0.35) 1px, transparent 1px)',
              backgroundSize: '8px 1px',
              backgroundRepeat: 'repeat-x',
            }}
          />

          {/* Bottom: new badge + title */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex-shrink-0 text-[9px] text-emerald-400 uppercase tracking-widest font-bold px-1.5 py-0.5 border border-emerald-400/30 rounded">
                New
              </span>
              <span className="text-sm text-slate-200 font-medium truncate">
                {post.title}
              </span>
            </div>
            <span className="flex-shrink-0 text-xs text-teal-400 group-hover:text-teal-300 transition-colors">
              Read &rarr;
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 3: Commit**

```bash
git add src/components/WebBanner.tsx
git commit -m "feat: add WebBanner component for new blog post promotion"
```

---

### Task 2: Add WebBanner to Homepage

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Import WebBanner**

Add to the imports at the top of `src/app/page.tsx`:

```tsx
import WebBanner from '@/components/WebBanner';
```

- [ ] **Step 2: Render between About and Experience**

In the `<main>` element, after the About section and before the Experience section, add:

```tsx
          {/* The Web: new post banner */}
          <section className="md:mt-0">
            <WebBanner />
          </section>
```

This goes between the closing `</section>` of `id="about"` and the opening `<section id="experience">`.

- [ ] **Step 3: Verify it renders**

Run: `npm run dev`
Open http://localhost:3000 — banner should appear between About and Experience if a blog post was published within the last 3 days. If no fresh post exists, nothing renders (correct behavior).

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: render WebBanner on homepage between About and Experience"
```

---

### Task 3: Test Dismiss and Edge Cases

**Files:**
- Modify: `src/components/WebBanner.tsx` (if fixes needed)

- [ ] **Step 1: Test dismiss behavior**

1. Open http://localhost:3000
2. Click the X on the banner — it should disappear
3. Refresh the page — banner should stay hidden
4. Open DevTools → Application → Local Storage → look for `web-banner-dismissed-{slug}` key

- [ ] **Step 2: Test stale post behavior**

If no post is within 3 days, verify the banner doesn't render at all (no empty space, no flash).

- [ ] **Step 3: Test mobile layout**

Open DevTools → toggle device toolbar → test at 375px width:
- Banner should be full-width
- Title should truncate if too long
- X button should be tappable (adequate touch target)

- [ ] **Step 4: Test navigation**

Click the banner (not the X) — should navigate to `/the-web/{slug}`.

- [ ] **Step 5: Production build check**

Run: `npm run build`
Expected: No build errors.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: WebBanner edge cases and mobile layout"
```

(Skip this commit if no fixes were needed.)
