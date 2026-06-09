'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DevIssue, DevRepo } from '@/lib/dev/github';
import { RepoPicker } from '@/components/dev/RepoPicker';
import { CreateIssueForm } from '@/components/dev/CreateIssueForm';
import { IssueList } from '@/components/dev/IssueList';

export default function DevConsolePage() {
  const [repos, setRepos] = useState<DevRepo[]>([]);
  const [hidden, setHidden] = useState<DevRepo[]>([]);
  const [issues, setIssues] = useState<DevIssue[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadRepos = useCallback(async () => {
    const res = await fetch('/api/dev/repos');
    if (res.ok) {
      const data = (await res.json()) as { repos: DevRepo[]; hidden: DevRepo[] };
      setRepos(data.repos);
      setHidden(data.hidden);
    }
  }, []);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    const url = selected
      ? `/api/dev/issues?state=open&repo=${encodeURIComponent(selected)}`
      : '/api/dev/issues?state=open';
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as { issues: DevIssue[] };
      setIssues(data.issues);
    }
    setLoading(false);
  }, [selected]);

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);
  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  async function hide(slug: string) {
    await fetch('/api/dev/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo: slug }),
    });
    if (selected === slug) setSelected(null);
    await loadRepos();
    await loadIssues();
  }
  async function unhide(slug: string) {
    await fetch('/api/dev/repos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo: slug }),
    });
    await loadRepos();
  }

  async function logout() {
    setLoggingOut(true);
    await fetch('/api/dev/auth', { method: 'DELETE' });
    window.location.href = '/';
  }

  return (
    <div className="min-h-screen dev-workpad p-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dev Console</h1>
          <button
            onClick={logout}
            disabled={loggingOut}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/70 hover:bg-white/5"
          >
            {loggingOut ? 'Logging out…' : 'Log out'}
          </button>
        </div>

        <RepoPicker
          repos={repos}
          hidden={hidden}
          selected={selected}
          onSelect={setSelected}
          onHide={hide}
          onUnhide={unhide}
        />

        {repos.length > 0 && <CreateIssueForm repos={repos} onCreated={loadIssues} />}

        {loading ? (
          <p className="text-white/50">Loading…</p>
        ) : (
          <IssueList issues={issues} repos={repos} onChanged={loadIssues} />
        )}
      </div>
    </div>
  );
}
