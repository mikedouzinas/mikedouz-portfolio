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
