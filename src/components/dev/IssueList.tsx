'use client';

import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { DevIssue, DevRepo, Priority, Status } from '@/lib/dev/github';
import { PRIORITY_META, STATUS_META, suggestTags } from '@/lib/dev/uiMeta';
import { Dropdown } from '@/components/ui/Dropdown';
import { Button } from '@/components/ui/Button';
import { CopyForClaude } from './CopyForClaude';

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

type PatchBody = { priority?: Priority; status?: Status; state?: 'open' | 'closed' };

function IssueCard({
  issue,
  repoName,
  onPatch,
}: {
  issue: DevIssue;
  repoName: string;
  onPatch: (issue: DevIssue, body: PatchBody) => void;
}) {
  const [open, setOpen] = useState(false);
  const pr = PRIORITY_META[issue.priority ?? 'p3'];
  const st = STATUS_META[issue.status ?? 'todo'];
  const tags = suggestTags(issue.title, issue.body);

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-colors hover:border-white/20"
      style={{ boxShadow: `inset 3px 0 0 ${pr.color}` }}
    >
      <button onClick={() => setOpen((o) => !o)} className="block w-full p-4 text-left">
        <div className="mb-2 flex items-center gap-2 text-[11px] text-white/40">
          <span
            className="rounded px-1.5 py-0.5 font-medium"
            style={{ backgroundColor: `${pr.color}22`, color: pr.color }}
          >
            {pr.short}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: st.color }} />
            {st.label}
          </span>
          <span className="ml-auto truncate">
            {repoName} #{issue.number}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
        <p className="font-medium leading-snug text-white/90">{issue.title}</p>
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.map((t) => (
              <span
                key={t.tag}
                className="rounded-full px-1.5 py-0.5 text-[10px]"
                style={{ backgroundColor: `${t.color}1f`, color: t.color }}
              >
                #{t.tag}
              </span>
            ))}
          </div>
        )}
      </button>

      {open && (
        <div className="border-t border-white/10 p-4 pt-3">
          {issue.body && (
            <div
              className="mb-3 rounded-lg border-l-2 p-3 text-sm text-white/70"
              style={{ borderColor: pr.color, backgroundColor: `${pr.color}0f` }}
            >
              <p className="whitespace-pre-wrap">{issue.body}</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Dropdown
              ariaLabel="Priority"
              value={issue.priority ?? 'p3'}
              options={PRIORITY_OPTS}
              onChange={(v) => onPatch(issue, { priority: v as Priority })}
            />
            <Dropdown
              ariaLabel="Status"
              value={issue.status ?? 'todo'}
              options={STATUS_OPTS}
              onChange={(v) => onPatch(issue, { status: v as Status })}
            />
            <CopyForClaude issue={issue} />
            <Button
              variant="ghost"
              glowColor="52, 211, 153"
              onClick={() => onPatch(issue, { state: 'closed' })}
              className="text-xs text-emerald-300/85"
            >
              <Check className="h-3.5 w-3.5" />
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function IssueList({
  issues,
  repos,
  onChanged,
}: {
  issues: DevIssue[];
  repos: DevRepo[];
  onChanged: () => void;
}) {
  const [error, setError] = useState('');

  function repoName(slug: string): string {
    return repos.find((r) => r.slug === slug)?.name ?? slug;
  }

  async function patch(issue: DevIssue, body: PatchBody) {
    setError('');
    try {
      const res = await fetch('/api/dev/issues', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: issue.repo, number: issue.number, ...body }),
      });
      if (!res.ok) {
        setError(`Couldn't update #${issue.number} — check the GitHub token's Issues write permission.`);
        return;
      }
      onChanged();
    } catch {
      setError('Network error updating the issue.');
    }
  }

  if (issues.length === 0) {
    return <p className="text-white/50">No open items. File one above.</p>;
  }

  return (
    <div>
      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
      <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {issues.map((issue) => (
          <IssueCard
            key={`${issue.repo}#${issue.number}`}
            issue={issue}
            repoName={repoName(issue.repo)}
            onPatch={patch}
          />
        ))}
      </div>
    </div>
  );
}
