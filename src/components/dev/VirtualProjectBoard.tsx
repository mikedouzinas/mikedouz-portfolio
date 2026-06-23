'use client';

import { useState } from 'react';
import { Dropdown } from '@/components/ui/Dropdown';
import type { DevItem, DevItemStatus, DevProjectWithItems } from '@/lib/dev/items';

const LANES: { key: DevItemStatus; label: string; dot: string }[] = [
  { key: 'todo', label: 'Todo', dot: '#4285F4' },
  { key: 'in_progress', label: 'In Progress', dot: '#d4a72c' },
  { key: 'done', label: 'Done', dot: '#1DB954' },
];

const STATUS_OPTS = LANES.map((l) => ({ value: l.key, label: l.label, color: l.dot }));

function ItemCard({
  item,
  onStatusChange,
}: {
  item: DevItem;
  onStatusChange: (itemId: string, status: DevItemStatus) => void;
}) {
  return (
    <div className="rounded-lg border border-[#e7e2d4]/12 bg-[#0e0c12]/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-white/90">{item.title}</p>
        {item.size && (
          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/60 ring-1 ring-white/15">
            {item.size}
          </span>
        )}
      </div>
      {item.body && <p className="mt-1 line-clamp-3 text-xs text-white/50">{item.body}</p>}
      <div className="mt-2">
        <Dropdown
          ariaLabel="Status"
          value={item.status}
          options={STATUS_OPTS}
          onChange={(v) => {
            if (v === 'todo' || v === 'in_progress' || v === 'done') {
              onStatusChange(item.id, v);
            }
          }}
        />
      </div>
    </div>
  );
}

export function VirtualProjectBoard({
  projects,
  onStatusChange,
}: {
  projects: DevProjectWithItems[];
  onStatusChange: (itemId: string, status: DevItemStatus) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  if (projects.length === 0) return null;

  return (
    <section className="mb-8 space-y-6">
      {projects.map((p) => {
        const isCollapsed = collapsed[p.id];
        return (
          <div key={p.id} className="rounded-xl border border-[#e7e2d4]/12 p-4">
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [p.id]: !c[p.id] }))}
              className="flex w-full items-center gap-3 text-left"
            >
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#e7e2d4]/85">
                {p.name}
              </h2>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ring-1 ${
                  p.irisVisible
                    ? 'text-emerald-300 ring-emerald-400/40'
                    : 'text-white/40 ring-white/15'
                }`}
                title={p.irisVisible ? 'Visible to Iris' : 'Private (not visible to Iris)'}
              >
                {p.irisVisible ? 'iris' : 'private'}
              </span>
              <span className="ml-auto text-xs text-white/40">
                {p.items.filter((i) => i.status !== 'done').length} open
              </span>
            </button>

            {!isCollapsed && (
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                {LANES.map((lane) => {
                  const laneItems = p.items.filter((i) => i.status === lane.key);
                  return (
                    <div key={lane.key} className="space-y-2">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/45">
                        <span className="h-2 w-2 rounded-full" style={{ background: lane.dot }} />
                        {lane.label}
                        <span className="text-white/30">{laneItems.length}</span>
                      </div>
                      {laneItems.map((item) => (
                        <ItemCard key={item.id} item={item} onStatusChange={onStatusChange} />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
