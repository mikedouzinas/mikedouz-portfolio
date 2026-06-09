'use client';

import { useState } from 'react';
import type { DevRepo, Priority, Status } from '@/lib/dev/github';

const PRIORITIES: Priority[] = ['p1', 'p2', 'p3', 'p4', 'p5'];
const STATUSES: Status[] = ['todo', 'in progress'];

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !repo) return;
    setBusy(true);
    setError('');
    const res = await fetch('/api/dev/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo, title, body, priority, status }),
    });
    setBusy(false);
    if (!res.ok) {
      setError('Failed to create issue.');
      return;
    }
    setTitle('');
    setBody('');
    setPriority('p3');
    setStatus('todo');
    onCreated();
  }

  return (
    <form onSubmit={submit} className="mb-8 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex flex-wrap gap-3">
        <select
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          className="rounded-md border border-white/15 bg-slate-900 px-2 py-1.5 text-sm"
        >
          {repos.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          className="rounded-md border border-white/15 bg-slate-900 px-2 py-1.5 text-sm"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          className="rounded-md border border-white/15 bg-slate-900 px-2 py-1.5 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="mb-2 w-full rounded-md border border-white/15 bg-slate-900 px-3 py-2 text-sm outline-none"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Description"
        rows={3}
        className="mb-3 w-full rounded-md border border-white/15 bg-slate-900 px-3 py-2 text-sm outline-none"
      />
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
      >
        {busy ? 'Filing…' : 'File it'}
      </button>
    </form>
  );
}
