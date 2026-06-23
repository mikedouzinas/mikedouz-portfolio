'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DevIssue, DevRepo } from '@/lib/dev/github';
import { Dropdown } from '@/components/ui/Dropdown';
import { HarlequinTitle } from '@/components/dev/HarlequinTitle';
import { RepoChips, RepoManagePanel } from '@/components/dev/RepoPicker';
import { GroupByToggle } from '@/components/dev/GroupByToggle';
import { GearMenu } from '@/components/dev/GearMenu';
import { CerePortal } from '@/components/dev/CerePortal';
import { CerePanel } from '@/components/dev/CerePanel';
import { CereGameLoader } from '@/components/dev/CereGameLoader';
import { requestHarlequinTransition } from '@/components/dev/transition/store';
import { consumeEntrance } from '@/components/dev/transition/entranceSignal';
import {
  captureBoardSnapshot,
  scheduleBoardSnapshot,
} from '@/components/dev/transition/boardSnapshot';
import ContainedMouseGlow from '@/components/ContainedMouseGlow';
import { IssueList, type GroupBy, type SortBy } from '@/components/dev/IssueList';

const SORT_OPTS: { value: SortBy; label: string }[] = [
  { value: 'priority', label: 'Priority' },
  { value: 'recent', label: 'Recent' },
  { value: 'size', label: 'Size' },
];

export default function DevConsolePage() {
  const router = useRouter();
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
  const [entrance, setEntrance] = useState(false);

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

  const patchIssue = useCallback(async (repo: string, number: number, patch: Record<string, unknown>) => {
    await fetch('/api/dev/issues', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo, number, ...patch }),
    });
    await loadIssues(true);
  }, [loadIssues]);

  const onApprove = useCallback((i: DevIssue) => patchIssue(i.repo, i.number, { state: 'closed' }), [patchIssue]);
  const onSendBack = useCallback((i: DevIssue, feedback: string) => patchIssue(i.repo, i.number, { feedback }), [patchIssue]);

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

  // Data fetching on mount / when the selected repo changes. This is the
  // canonical use of an effect (sync React with an external system — the API);
  // the setState inside the loaders runs after the fetch resolves, not as
  // render-derived state. The rule can't see across the async loader boundary.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- on-mount data fetch, not derived state
    loadRepos();
  }, [loadRepos]);
  useEffect(() => {
    // Read-once: did we just unlock? If so, play the reveal.
    if (consumeEntrance()) setEntrance(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on selected-repo change, not derived state
    loadIssues();
  }, [loadIssues]);

  // Eagerly pre-capture the board once it has settled, so the disintegration
  // EXIT cover is ready instantly on click (no html2canvas stall at click time —
  // that delay was the main reason the old exit "felt wrong"). Debounced, so
  // silent issue refreshes coalesce into one capture. Back-button hover refreshes
  // it again for the freshest possible frame.
  useEffect(() => {
    if (loading) return;
    scheduleBoardSnapshot(1200);
    // Warm the exit overlay chunk ahead of the click so the cover appears
    // instantly (not after a ~0.4s lazy-chunk fetch). Runtime import() keeps it
    // a separate chunk — it never enters the homepage bundle.
    void import('@/components/dev/HarlequinExit');
  }, [loading, issues]);

  // Mount the loader immediately when loading starts (handled during render via
  // prev-tracking so it's never a frame late), then keep it mounted for one fade
  // duration after loading ends so it can fade out over the board.
  const [prevLoading, setPrevLoading] = useState(loading);
  if (prevLoading !== loading) {
    setPrevLoading(loading);
    if (loading) setShowLoader(true);
  }
  useEffect(() => {
    if (loading) return;
    const id = setTimeout(() => setShowLoader(false), 300);
    return () => clearTimeout(id);
  }, [loading]);

  // Warm the exit's heavy deps the moment the board mounts. HarlequinExit lazy-
  // imports three.js (~708KB) + html2canvas (~194KB); on a cold first exit that
  // load alone outran the failsafe, so the disintegration never showed. Firing
  // the SAME dynamic imports here caches them, so by the time the user hits
  // back/logout the exit can snapshot + animate immediately. These imports stay
  // out of the homepage bundle — they only run on /dev.
  useEffect(() => {
    void import('three');
    void import('html2canvas');
    // Warm the homepage RSC so the exit's reveal (which client-navigates to /)
    // has it painted underneath almost immediately — keeps the dissolve's start
    // snappy instead of holding the board cover while / loads.
    router.prefetch('/');
  }, [router]);

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
    // Clear the session FIRST and await it, so the cookie is definitely gone
    // before we leave. Running it in parallel with the exit animation raced the
    // navigate — the page could reload to `/` before the DELETE's Set-Cookie
    // applied, leaving the session intact (you'd still be "logged in", so /dev
    // re-opened without a passcode). Clear, THEN play the exit → navigate.
    try {
      await fetch('/api/dev/auth', { method: 'DELETE' });
    } catch {
      /* leave anyway — being unable to reach the endpoint shouldn't trap you */
    }
    requestHarlequinTransition('exit');
  }

  const openCount = issues.filter((i) => i.state === 'open').length;

  return (
    <div data-board-root className="min-h-screen dev-workpad text-white">
      {/* The diamond-ash disintegration EXIT is played by HarlequinTransitionHost
          (root layout) so the WebGL overlay survives the /dev → home route change.
          This page only tags its root [data-board-root] (the exit snapshots it).
          The cursor-follow argyle bloom (HarlequinReveal) was removed — it popped
          up under the cursor right as you reached for the back-diamond and
          conflated with the exit. */}
      <header
        data-suppress-reveal
        data-has-contained-glow="true"
        className="sticky top-0 z-40 border-b border-[#e7e2d4]/15 bg-[#0e0c12]/70 backdrop-blur-md"
      >
        {/* Contained champagne light within the header bar (self-clips). */}
        <ContainedMouseGlow color="231, 226, 212" intensity={0.12} size={260} />
        <div className="relative z-10 mx-auto max-w-6xl px-6 py-4">
          {/*
            Header layout: left column holds both control rows; CerePortal is a
            tall right sibling. `items-stretch` makes CerePortal fill the full
            height of the left column — spanning from the group-by row top all
            the way down to the gear icon row bottom.
          */}
          <div className="flex items-stretch gap-4">
            {/* ── left column: title + controls ── */}
            <div className="flex flex-1 flex-col gap-3 min-w-0">
              {/* Row 1: title left, group-by right */}
              <div className="flex items-center justify-between gap-4">
                <HarlequinTitle
                  onBack={() => requestHarlequinTransition('exit')}
                  onBackHover={() => {
                    void captureBoardSnapshot();
                    void import('@/components/dev/HarlequinExit');
                  }}
                />
                <div className="hidden md:block">
                  <GroupByToggle value={groupBy} onChange={setGroupBy} />
                </div>
              </div>

              {/* Row 2: repo chips left, sort + gear right */}
              <div className="flex items-center justify-between gap-3">
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
            </div>

            {/* ── right: tall Cere trigger spanning both rows ── */}
            <CerePortal onClick={() => setComposerOpen(true)} />
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
                onApprove={onApprove}
                onSendBack={onSendBack}
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
