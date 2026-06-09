'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DevIssue, DevRepo } from '@/lib/dev/github';
import { Button } from '@/components/ui/Button';
import { HarlequinTitle } from '@/components/dev/HarlequinTitle';
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
  const [managing, setManaging] = useState(false);

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
    await loadIssues();
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
          <HarlequinTitle />
          <div className="flex items-center gap-2">
            <Button variant="hatch" glowColor="52, 211, 153" onClick={() => setManaging((m) => !m)}>
              {managing ? 'Done' : 'Manage repos'}
            </Button>
            <Button variant="hatch" glowColor="234, 67, 53" onClick={logout} disabled={loggingOut}>
              {loggingOut ? 'Logging out…' : 'Log out'}
            </Button>
          </div>
        </div>

        <RepoPicker
          repos={repos}
          hidden={hidden}
          selected={selected}
          managing={managing}
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
