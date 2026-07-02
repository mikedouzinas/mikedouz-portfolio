'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { DevItem, DevProjectWithItems } from '@/lib/dev/items';
import { HomeFadeOverlay } from '@/components/dev/entrance/HomeFadeOverlay';
import { useEntranceReveal, sub } from '@/components/dev/entrance/useEntranceReveal';

/** How long Cere's exit poof keeps the closing panel mounted (see #88 guard). */
const COMPOSER_EXIT_MS = 400;

const SORT_OPTS: { value: SortBy; label: string }[] = [
  { value: 'smart', label: 'Smart' },
  { value: 'priority', label: 'Priority' },
  { value: 'recent', label: 'Recent' },
  { value: 'size', label: 'Size' },
];

// Virtual (vault) projects appear on the board exactly like a code repo: they
// become a DevRepo (so they get a chip + a group section) and their items become
// DevIssues tagged source:'virtual' (so they render in the SAME card/lanes and
// route their mutations to /api/dev/items). Champagne accent marks them as vault.
const VIRTUAL_ACCENT = '231, 226, 212';

function projectToRepo(p: DevProjectWithItems): DevRepo {
  return {
    slug: p.id,
    name: p.name,
    accent: VIRTUAL_ACCENT,
    pushedAt: p.createdAt,
    archived: false,
    fork: false,
    private: true,
  };
}

function itemToIssue(it: DevItem): DevIssue {
  return {
    repo: it.projectId,
    number: 0, // unused for virtual items; itemId is the identity
    title: it.title,
    body: it.body,
    priority: it.priority,
    status: it.status,
    size: it.size,
    state: it.state,
    url: '',
    createdAt: it.createdAt,
    updatedAt: it.updatedAt,
    source: 'virtual',
    itemId: it.id,
  };
}

export default function DevConsolePage() {
  const router = useRouter();
  const [repos, setRepos] = useState<DevRepo[]>([]);
  const [hidden, setHidden] = useState<DevRepo[]>([]);
  const [issues, setIssues] = useState<DevIssue[]>([]);
  const [projects, setProjects] = useState<DevProjectWithItems[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Keeps the loader mounted through its fade-out after `loading` flips false,
  // so the board crossfades in cleanly instead of hard-cutting (ticket #56).
  const [showLoader, setShowLoader] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [managing, setManaging] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>('status');
  // "Smart" (composite score, #36) is the default; Priority/Recent/Size stay
  // available as explicit choices in the dropdown.
  const [sort, setSort] = useState<SortBy>('smart');
  // Session role (#53/#82/#6): visitor sessions render the read-only board —
  // no Cere, no gear, no mutating card affordances. Defaults to admin so
  // Mike's board never flashes into read-only while the role fetch resolves;
  // a visitor briefly seeing edit chrome is harmless (the API rejects writes).
  const [role, setRole] = useState<'admin' | 'visitor'>('admin');
  const readOnly = role === 'visitor';
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/dev/auth');
        if (!res.ok) return;
        const data = (await res.json()) as { role: 'admin' | 'visitor' | null };
        if (data.role === 'visitor') setRole('visitor');
      } catch {
        /* stay admin-shaped; the API is still the enforcement layer */
      }
    })();
  }, []);
  const [composerOpen, setComposerOpen] = useState(false);
  // #88 — rapid-tap guard. Poof keeps the closing panel mounted for its ~340ms
  // exit animation; re-opening during that window mounts a SECOND panel next to
  // the exiting one (the hyper-clear ghost duplicate). Lock re-opens until the
  // exit has fully played.
  const composerClosedAtRef = useRef(0);
  const openComposer = useCallback(() => {
    if (Date.now() - composerClosedAtRef.current < COMPOSER_EXIT_MS) return;
    setComposerOpen(true);
  }, []);
  const closeComposer = useCallback(() => {
    composerClosedAtRef.current = Date.now();
    setComposerOpen(false);
  }, []);
  const [entrance, setEntrance] = useState(false);
  const [homeFaded, setHomeFaded] = useState(false);
  const { t } = useEntranceReveal(entrance);
  const easeWipe = (x: number) => 1 - Math.pow(1 - x, 3);

  // Latest projects, read inside loadIssues without making it a dependency (which
  // would re-trigger the loader on every projects refresh).
  const projectsRef = useRef<DevProjectWithItems[]>([]);

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
      // A virtual (vault) project isn't a GitHub repo — when one is selected,
      // skip the issues API (it'd 400) and let the virtual items carry the view.
      if (selected && projectsRef.current.some((p) => p.id === selected)) {
        setIssues([]);
        if (!silent) setLoading(false);
        return;
      }
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

  const loadProjects = useCallback(async () => {
    const res = await fetch('/api/dev/projects', { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as { projects: DevProjectWithItems[] };
      projectsRef.current = data.projects;
      setProjects(data.projects);
    }
  }, []);

  // Refresh both sources after any mutation — a card change may have hit either
  // the GitHub issues API or the Supabase items API.
  const refreshBoard = useCallback(() => {
    void loadIssues(true);
    void loadProjects();
  }, [loadIssues, loadProjects]);

  const patchIssue = useCallback(
    async (repo: string, number: number, patch: Record<string, unknown>) => {
      await fetch('/api/dev/issues', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, number, ...patch }),
      });
      await loadIssues(true);
    },
    [loadIssues],
  );

  const patchItem = useCallback(
    async (itemId: string, body: Record<string, unknown>) => {
      await fetch(`/api/dev/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await loadProjects();
    },
    [loadProjects],
  );

  // Awaiting-review actions route by source: virtual items → items API, GitHub → issues API.
  const onApprove = useCallback(
    (i: DevIssue) =>
      i.source === 'virtual' && i.itemId
        ? patchItem(i.itemId, { state: 'closed' })
        : patchIssue(i.repo, i.number, { state: 'closed' }),
    [patchItem, patchIssue],
  );
  const onSendBack = useCallback(
    (i: DevIssue, feedback: string) =>
      i.source === 'virtual' && i.itemId
        ? patchItem(i.itemId, { feedback })
        : patchIssue(i.repo, i.number, { feedback }),
    [patchItem, patchIssue],
  );

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

  // Virtual projects → board repos + issues, merged with the GitHub board.
  const virtualRepos = useMemo(() => projects.map(projectToRepo), [projects]);
  const virtualIssues = useMemo(
    () => projects.flatMap((p) => p.items.map(itemToIssue)),
    [projects],
  );
  // When a specific repo is selected, only its items show: a virtual project's
  // items match by repo===slug; selecting a GitHub repo yields none of them.
  const visibleVirtualIssues = useMemo(
    () => (selected === null ? virtualIssues : virtualIssues.filter((i) => i.repo === selected)),
    [virtualIssues, selected],
  );
  const allRepos = useMemo(() => [...repos, ...virtualRepos], [repos, virtualRepos]);
  const allIssues = useMemo(
    () => [...issues, ...visibleVirtualIssues],
    [issues, visibleVirtualIssues],
  );

  // Data fetching on mount / when the selected repo changes. This is the
  // canonical use of an effect (sync React with an external system — the API);
  // the setState inside the loaders runs after the fetch resolves, not as
  // render-derived state. The rule can't see across the async loader boundary.
  useEffect(() => {
     
    loadRepos();
  }, [loadRepos]);
  useEffect(() => {
    // Read-once: did we just unlock? If so, play the reveal.
    if (consumeEntrance()) setEntrance(true);
     
  }, []);
  useEffect(() => {
     
    loadIssues();
  }, [loadIssues]);
  useEffect(() => {
     
    loadProjects();
  }, [loadProjects]);

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
    if (readOnly) return; // no Cere in visitor mode
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        // Same rapid-toggle guard as the portal button (#88): closing stamps the
        // clock; re-opening waits out the exit animation.
        setComposerOpen((o) => {
          if (o) {
            composerClosedAtRef.current = Date.now();
            return false;
          }
          return Date.now() - composerClosedAtRef.current < COMPOSER_EXIT_MS ? o : true;
        });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readOnly]);

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

  const openCount = allIssues.filter((i) => i.state === 'open').length;

  return (
    <div data-board-root className="min-h-screen dev-workpad text-white">
      {entrance && !homeFaded && <HomeFadeOverlay onDone={() => setHomeFaded(true)} />}
      {/* The diamond-ash disintegration EXIT is played by HarlequinTransitionHost
          (root layout) so the WebGL overlay survives the /dev → home route change.
          This page only tags its root [data-board-root] (the exit snapshots it).
          The cursor-follow argyle bloom (HarlequinReveal) was removed — it popped
          up under the cursor right as you reached for the back-diamond and
          conflated with the exit. */}
      <header
        data-suppress-reveal
        data-has-contained-glow="true"
        className={`sticky top-0 z-40 border-b border-[#e7e2d4]/15 bg-[#0e0c12]/70 backdrop-blur-md ${entrance ? 'hq-banner-enter' : ''}`}
        style={entrance ? ({ ['--hq-wipe' as string]: easeWipe(sub(t, 0.14, 0.42)) } as React.CSSProperties) : undefined}
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
                  entrance={entrance}
                />
                <div className="hidden md:block">
                  <GroupByToggle value={groupBy} onChange={setGroupBy} />
                </div>
              </div>

              {/* Row 2: repo chips left, sort + gear right */}
              <div className="flex items-center justify-between gap-3">
                <RepoChips repos={allRepos} selected={selected} onSelect={setSelected} />
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
                  {readOnly ? (
                    <span className="rounded-full border border-[#e7e2d4]/25 bg-[#e7e2d4]/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] text-[#e7e2d4]/70">
                      read-only
                    </span>
                  ) : (
                    <GearMenu
                      onManage={() => setManaging((m) => !m)}
                      onInbox={() => { window.location.href = '/admin/inbox'; }}
                      onLogout={logout}
                      loggingOut={loggingOut}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* ── right: tall Cere trigger spanning both rows ── */}
            {/* self-stretch + flex so CerePortal still fills the header height
                (its own self-stretch needs a flex parent); the entrance jump is a
                transform/opacity layer that doesn't affect the layout box. */}
            {!readOnly && (
              <div
                className={`flex self-stretch ${entrance && t >= 0.34 ? 'hq-cere-jump' : ''}`}
                style={entrance && t < 0.34 ? { opacity: 0 } : undefined}
              >
                <CerePortal onClick={openComposer} />
              </div>
            )}
          </div>

          {!readOnly && managing && repos.length > 0 && (
            <RepoManagePanel repos={repos} hidden={hidden} onHide={hide} onUnhide={unhide} />
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-6">
        <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-[#e7e2d4]/55">
          {loading ? ' ' : `${openCount} open`}
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
        <div className={`relative ${showLoader && !entrance ? 'min-h-[180px]' : ''}`}>
          {/* During entrance the board renders immediately at full opacity so
              the banner/header/card animations have content to reveal from the
              first frame. Non-entrance keeps the existing opacity-0→100 fade. */}
          <div className={entrance ? '' : `transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}>
            {(!loading || entrance) && (
              <IssueList
                issues={allIssues}
                repos={allRepos}
                groupBy={groupBy}
                sort={sort}
                onChanged={refreshBoard}
                onApprove={onApprove}
                onSendBack={onSendBack}
                entrance={entrance ? { active: true, t } : undefined}
                loading={loading}
                editable={!readOnly}
              />
            )}
          </div>
          {/* CereGameLoader is suppressed during entrance — the banner/Cere jump/
              card reveal IS the loading visual. Normal (non-entrance) path keeps
              the loader exactly as before. */}
          {showLoader && !entrance && (
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

      {!readOnly && (
        <CerePanel
          open={composerOpen}
          onClose={closeComposer}
          onApplied={onCereApplied}
          issues={issues}
        />
      )}
    </div>
  );
}
