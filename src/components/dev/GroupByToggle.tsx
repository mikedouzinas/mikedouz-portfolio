'use client';

import type { GroupBy } from './IssueList';

const OPTS: { value: GroupBy; label: string }[] = [
  { value: 'status', label: 'Status' },
  { value: 'repo', label: 'Repo' },
];

/** Segmented control choosing the board's primary organizing axis. */
export function GroupByToggle({
  value,
  onChange,
}: {
  value: GroupBy;
  onChange: (v: GroupBy) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 text-[11px]">
      <span className="mr-1 uppercase tracking-[0.15em] text-white/30">group by</span>
      <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
        {OPTS.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              value === o.value
                ? 'bg-[#e7e2d4]/15 text-[#e7e2d4]'
                : 'text-white/55 hover:text-white/85'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
