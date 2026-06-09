'use client';

import type { DevRepo } from '@/lib/dev/github';

export function RepoPicker({
  repos,
  hidden,
  selected,
  managing,
  onSelect,
  onHide,
  onUnhide,
}: {
  repos: DevRepo[];
  hidden: DevRepo[];
  selected: string | null; // null = All
  managing: boolean; // panel visibility, controlled by the header toggle
  onSelect: (slug: string | null) => void;
  onHide: (slug: string) => void;
  onUnhide: (slug: string) => void;
}) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onSelect(null)}
          className={`rounded-full px-3 py-1 text-xs ${
            selected === null ? 'bg-white/15 text-white' : 'bg-white/5 text-white/60'
          }`}
        >
          All
        </button>
        {repos.map((r) => (
          <button
            key={r.slug}
            onClick={() => onSelect(r.slug)}
            className={`rounded-full px-3 py-1 text-xs ${
              selected === r.slug ? 'text-white' : 'text-white/60'
            }`}
            style={{
              backgroundColor:
                selected === r.slug ? `rgba(${r.accent}, 0.25)` : 'rgba(255,255,255,0.05)',
            }}
          >
            {r.name}
          </button>
        ))}
      </div>

      {managing && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
          <p className="mb-2 text-white/50">Shown</p>
          <ul className="mb-3 space-y-1">
            {repos.map((r) => (
              <li key={r.slug} className="flex items-center justify-between">
                <span className="text-white/80">{r.name}</span>
                <button
                  onClick={() => onHide(r.slug)}
                  className="text-xs text-white/50 hover:text-white"
                >
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
      )}
    </div>
  );
}
