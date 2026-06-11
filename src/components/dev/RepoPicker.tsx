'use client';

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
            <button onClick={() => onHide(r.slug)} className="text-xs text-white/50 hover:text-white">
              Hide
            </button>
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
