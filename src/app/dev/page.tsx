'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DevIssue, DevRepo } from '@/lib/dev/github';
import { Button } from '@/components/ui/Button';
import { Dropdown } from '@/components/ui/Dropdown';
import { GoogleText } from '@/components/ui/GoogleText';
import { HarlequinTitle } from '@/components/dev/HarlequinTitle';
import { RepoChips, RepoManagePanel } from '@/components/dev/RepoPicker';
import { GroupByToggle } from '@/components/dev/GroupByToggle';
import { GearMenu } from '@/components/dev/GearMenu';
import { DogfirisPanel } from '@/components/dev/DogfirisPanel';
import { IssueList, type GroupBy, type SortBy } from '@/components/dev/IssueList';

const SORT_OPTS: { value: SortBy; label: string }[] = [
  { value: 'priority', label: 'Priority' },
  { value: 'recent', label: 'Recent' },
];

export default function DevConsolePage() {
  const [repos, setRepos] = useState<DevRepo[]>([]);
  const [hidden, setHidden] = useState<DevRepo[]>([]);
  const [issues, setIssues] = useState<DevIssue[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [managing, setManaging] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>('status');
  const [sort, setSort] = useState<SortBy>('priority');
  const [composerOpen, setComposerOpen] = useState(false);

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

  // ⌘K (the main-site Iris is suppressed on /dev) opens dogfiris instead.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setComposerOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  const openCount = issues.filter((i) => i.state === 'open').length;

  return (
    <div className="min-h-screen dev-workpad text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070b12]/85 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <HarlequinTitle />
            <div className="flex items-center gap-3">
              <div className="hidden md:block">
                <GroupByToggle value={groupBy} onChange={setGroupBy} />
              </div>
              <Button
                variant="hatch-google"
                glowColor="66, 133, 244"
                onClick={() => setComposerOpen(true)}
              >
                <span className="text-base leading-none">＋</span>
                <GoogleText text="dogfiris" className="font-semibold" />
                <kbd className="ml-1 hidden rounded border border-white/20 px-1 text-[10px] font-normal text-white/50 sm:inline">
                  ⌘K
                </kbd>
              </Button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <RepoChips repos={repos} selected={selected} onSelect={setSelected} />
            <div className="flex shrink-0 items-center gap-2">
              <div className="md:hidden">
                <GroupByToggle value={groupBy} onChange={setGroupBy} />
              </div>
              <Dropdown
                ariaLabel="Sort"
                value={sort}
                options={SORT_OPTS}
                onChange={(v) => setSort(v as SortBy)}
              />
              <GearMenu
                onManage={() => setManaging((m) => !m)}
                onLogout={logout}
                loggingOut={loggingOut}
              />
            </div>
          </div>

          {managing && repos.length > 0 && (
            <RepoManagePanel repos={repos} hidden={hidden} onHide={hide} onUnhide={unhide} />
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-white/35">
          {loading ? 'Loading…' : `${openCount} open`}
        </p>
        {!loading && (
          <IssueList
            issues={issues}
            repos={repos}
            groupBy={groupBy}
            sort={sort}
            onChanged={loadIssues}
          />
        )}
      </main>

      <DogfirisPanel
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        repos={repos}
        onCreated={loadIssues}
      />
    </div>
  );
}
