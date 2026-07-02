'use client';

import { useState } from 'react';
import type { DevRepo } from '@/lib/dev/github';

/** Repo filter chips for the board's sticky repo bar. `null` = All. */
export function RepoChips({
  repos,
  selected,
  onSelect,
}: {
  repos: DevRepo[];
  selected: string | null;
  onSelect: (slug: string | null) => void;
}) {
  return (
    <div className="no-scrollbar flex flex-nowrap items-center gap-2 overflow-x-auto">
      <button
        onClick={() => onSelect(null)}
        className={`shrink-0 rounded-full border px-3 py-1 text-xs transition-colors ${
          selected === null
            ? 'border-[#e7e2d4]/30 bg-[#e7e2d4]/15 text-[#e7e2d4]'
            : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white/85'
        }`}
      >
        All
      </button>
      {repos.map((r) => (
        <button
          key={r.slug}
          onClick={() => onSelect(r.slug)}
          className={`shrink-0 rounded-full border px-3 py-1 text-xs transition-colors ${
            selected === r.slug ? 'text-white' : 'text-white/60 hover:text-white/85'
          }`}
          style={{
            backgroundColor:
              selected === r.slug ? `rgba(${r.accent}, 0.22)` : 'rgba(255,255,255,0.03)',
            borderColor:
              selected === r.slug ? `rgba(${r.accent}, 0.45)` : 'rgba(255,255,255,0.10)',
          }}
        >
          {r.name}
        </button>
      ))}
    </div>
  );
}

/**
 * Per-repo guest link (#6): mints a scoped, expiring share URL and puts it on
 * the clipboard. Self-contained — the token API is admin-gated server-side.
 */
function ShareLinkButton({ repo }: { repo: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'copied' | 'error'>('idle');
  async function share() {
    setState('busy');
    try {
      const res = await fetch('/api/dev/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo }),
      });
      if (!res.ok) throw new Error();
      const { url } = (await res.json()) as { url: string };
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('error');
    }
    setTimeout(() => setState('idle'), 2000);
  }
  return (
    <button
      onClick={share}
      disabled={state === 'busy'}
      className="text-xs text-sky-300/60 transition-colors hover:text-sky-300 disabled:opacity-50"
      title="Copy a read-only guest link to this repo's board (expires in 14 days)"
    >
      {state === 'copied' ? 'Link copied' : state === 'error' ? 'Failed' : 'Share'}
    </button>
  );
}

/** Show/hide management for repos — drops out of the gear menu's "Manage repos". */
export function RepoManagePanel({
  repos,
  hidden,
  onHide,
  onUnhide,
}: {
  repos: DevRepo[];
  hidden: DevRepo[];
  onHide: (slug: string) => void;
  onUnhide: (slug: string) => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
      <p className="mb-2 text-white/50">Shown</p>
      <ul className="mb-3 space-y-1">
        {repos.map((r) => (
          <li key={r.slug} className="flex items-center justify-between">
            <span className="text-white/80">{r.name}</span>
            <span className="flex items-center gap-3">
              <ShareLinkButton repo={r.slug} />
              <button onClick={() => onHide(r.slug)} className="text-xs text-white/50 hover:text-white">
                Hide
              </button>
            </span>
          </li>
        ))}
      </ul>
      {hidden.length > 0 && (
        <>
          <p className="mb-2 text-white/50">Hidden</p>
          <ul className="space-y-1">
            {hidden.map((r) => (
              <li key={r.slug} className="flex items-center justify-between">
                <span className="text-white/40">{r.name}</span>
                <button
                  onClick={() => onUnhide(r.slug)}
                  className="text-xs text-emerald-300/70 hover:text-emerald-300"
                >
                  Unhide
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
