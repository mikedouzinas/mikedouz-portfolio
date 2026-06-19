'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DevIssue, DevRepo } from '@/lib/dev/github';
import { Dropdown } from '@/components/ui/Dropdown';
import { HarlequinTitle } from '@/components/dev/HarlequinTitle';
import { RepoChips, RepoManagePanel } from '@/components/dev/RepoPicker';
import { GroupByToggle } from '@/components/dev/GroupByToggle';
import { GearMenu } from '@/components/dev/GearMenu';
import { CerePortal } from '@/components/dev/CerePortal';
import { CerePanel } from '@/components/dev/CerePanel';
import { CereGameLoader } from '@/components/dev/CereGameLoader';
import { HarlequinReveal } from '@/components/dev/HarlequinReveal';
import ContainedMouseGlow from '@/components/ContainedMouseGlow';
import { IssueList, type GroupBy, type SortBy } from '@/components/dev/IssueList';

const SORT_OPTS: { value: SortBy; label: string }[] = [
  { value: 'priority', label: 'Priority' },
  { value: 'recent', label: 'Recent' },
  { value: 'size', label: 'Size' },
];

export default function DevConsolePage() {
  const [repos, setRepos] = useState<DevRepo[]>([]);
  const [hidden, setHidden] = useState<DevRepo[]>([]);
  const [issues, setIssues] = useState<DevIssue[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Keeps the loader mounted through its fade-out after `loading` flips false,
  // so the board crossfades in cleanly instead of hard-cutting (ticket #56).
  const [showLoader, setShowLoader] = useState(true);
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

  // `silent` refreshes update the list in place WITHOUT toggling `loading`, so
  // IssueList stays mounted and cards keep their state (an expanded/edited ticket
  // stays put). Used after any board mutation; only the first load + repo switch
  // show the loading state.
  const loadIssues = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      const url = selected
        ? `/api/dev/issues?state=open&repo=${encodeURIComponent(selected)}`
        : '/api/dev/issues?state=open';
      // no-store: GitHub's list endpoint is eventually-consistent and the
      // browser/Next caches make freshly-filed tickets lag further (ticket #71).
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { issues: DevIssue[] };
        setIssues(data.issues);
      }
      if (!silent) setLoading(false);
    },
    [selected],
  );

  const refreshIssues = useCallback(() => loadIssues(true), [loadIssues]);

  // Optimistic insert: merge issues Cere just created into the board immediately
  // (deduped on the card key repo#number), then silent-refetch to reconcile —
  // GitHub's list endpoint takes several reloads to surface a new issue (#71).
  const onCereApplied = useCallback(
    (created: DevIssue[]) => {
      if (created.length) {
        setIssues((prev) => {
          const seen = new Set(prev.map((i) => `${i.repo}#${i.number}`));
          const fresh = created.filter((i) => !seen.has(`${i.repo}#${i.number}`));
          return fresh.length ? [...fresh, ...prev] : prev;
        });
      }
      void loadIssues(true);
    },
    [loadIssues],
  );

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);
  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  // Mount the loader immediately when loading starts; keep it mounted for one
  // fade duration after loading ends so it can fade out over the board.
  useEffect(() => {
    if (loading) {
      setShowLoader(true);
      return;
    }
    const id = setTimeout(() => setShowLoader(false), 300);
    return () => clearTimeout(id);
  }, [loading]);

  // ⌘K (the main-site Iris is suppressed on /dev) opens Cere instead. Ignore
  // Shift so ⌘⇧K stays reserved for the portal twin and doesn't also open Cere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
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
      <HarlequinReveal />
      <header
        data-suppress-reveal
        data-has-contained-glow="true"
        className="sticky top-0 z-40 border-b border-[#e7e2d4]/15 bg-[#0e0c12]/70 backdrop-blur-md"
      >
        {/* Contained champagne light within the header bar (self-clips). */}
        <ContainedMouseGlow color="231, 226, 212" intensity={0.12} size={260} />
        <div className="relative z-10 mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <HarlequinTitle />
            <div className="flex items-center gap-3">
              <div className="hidden md:block">
                <GroupByToggle value={groupBy} onChange={setGroupBy} />
              </div>
              <CerePortal onClick={() => setComposerOpen(true)} />
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
                onInbox={() => { window.location.href = '/admin/inbox'; }}
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

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-6">
        <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-[#e7e2d4]/55">
          {loading ? ' ' : `${openCount} open`}
        </p>
        {/*
          Loader → board transition. The CereGameLoader plays a quick card game
          whose winner frame ("one card per person" + a result tag) can be live
          at the exact moment the board data arrives. A hard swap would flash
          that winner frame for an instant before the board paints (ticket #56).
          Instead: once data is ready the board fades in while the loader fades
          out on top of it, so the cutover is clean regardless of which game
          frame happens to be live. `showLoader` keeps the loader mounted for
          the fade, then unmounts it.
        */}
        <div className={`relative ${showLoader ? 'min-h-[180px]' : ''}`}>
          <div className={`transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}>
            {!loading && (
              <IssueList
                issues={issues}
                repos={repos}
                groupBy={groupBy}
                sort={sort}
                onChanged={refreshIssues}
              />
            )}
          </div>
          {showLoader && (
            <div
              className={`absolute inset-0 flex justify-center py-16 transition-opacity duration-300 ${
                loading ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              <CereGameLoader />
            </div>
          )}
        </div>
      </main>

      <CerePanel
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onApplied={onCereApplied}
        issues={issues}
      />
    </div>
  );
}
