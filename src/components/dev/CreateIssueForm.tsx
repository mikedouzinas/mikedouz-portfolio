'use client';

import { useState } from 'react';
import type { DevRepo, Priority, Status } from '@/lib/dev/github';
import { PRIORITY_META, STATUS_META } from '@/lib/dev/uiMeta';
import { Dropdown } from '@/components/ui/Dropdown';
import { Button } from '@/components/ui/Button';
import { GoogleText } from '@/components/ui/GoogleText';

const PRIORITY_OPTS = (['p1', 'p2', 'p3', 'p4', 'p5'] as Priority[]).map((p) => ({
  value: p,
  label: PRIORITY_META[p].label,
  color: PRIORITY_META[p].color,
}));
const STATUS_OPTS = (['todo', 'in progress'] as Status[]).map((s) => ({
  value: s,
  label: STATUS_META[s].label,
  color: STATUS_META[s].color,
}));

export function CreateIssueForm({
  repos,
  onCreated,
}: {
  repos: DevRepo[];
  onCreated: () => void;
}) {
  const [repo, setRepo] = useState(repos[0]?.slug ?? '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<Priority>('p3');
  const [status, setStatus] = useState<Status>('todo');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const repoOpts = repos.map((r) => ({ value: r.slug, label: r.name, color: `rgb(${r.accent})` }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !repo) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/dev/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, title, body, priority, status }),
      });
      if (!res.ok) {
        setError('Failed to create issue.');
        return;
      }
      setTitle('');
      setBody('');
      setPriority('p3');
      setStatus('todo');
      onCreated();
    } catch {
      setError('Network error creating the issue.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-8 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex flex-wrap gap-2">
        <Dropdown ariaLabel="Repo" value={repo} options={repoOpts} onChange={setRepo} />
        <Dropdown
          ariaLabel="Priority"
          value={priority}
          options={PRIORITY_OPTS}
          onChange={(v) => setPriority(v as Priority)}
        />
        <Dropdown
          ariaLabel="Status"
          value={status}
          options={STATUS_OPTS}
          onChange={(v) => setStatus(v as Status)}
        />
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="mb-2 w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/30"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Description"
        rows={3}
        className="mb-3 w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/30"
      />
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
      <Button type="submit" disabled={busy} variant="solid" glowColor="251, 188, 5" className="px-4 py-2">
        {busy ? <span className="text-white/70">Filing…</span> : <GoogleText text="File it" className="font-semibold" />}
      </Button>
    </form>
  );
}
