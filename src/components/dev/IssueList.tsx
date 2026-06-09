'use client';

import { useState } from 'react';
import type { DevIssue, DevRepo, Priority, Status } from '@/lib/dev/github';
import { CopyForClaude } from './CopyForClaude';

const PRIORITIES: Priority[] = ['p1', 'p2', 'p3', 'p4', 'p5'];
const STATUSES: Status[] = ['todo', 'in progress'];

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

  async function patch(
    issue: DevIssue,
    body: { priority?: Priority; status?: Status; state?: 'open' | 'closed' },
  ) {
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
    <ul className="space-y-3">
      {error && <li className="text-xs text-red-400">{error}</li>}
      {issues.map((issue) => (
        <li
          key={`${issue.repo}#${issue.number}`}
          className="rounded-xl border border-white/10 bg-white/5 p-4"
        >
          <div className="mb-1 flex items-center gap-2 text-xs text-white/40">
            <span>{repoName(issue.repo)}</span>
            <span>#{issue.number}</span>
          </div>
          <p className="mb-2 font-medium text-white">{issue.title}</p>
          {issue.body && (
            <p className="mb-3 whitespace-pre-wrap text-sm text-white/60">{issue.body}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={issue.priority ?? 'p3'}
              onChange={(e) => patch(issue, { priority: e.target.value as Priority })}
              className="rounded-md border border-white/15 bg-slate-900 px-2 py-1 text-xs"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              value={issue.status ?? 'todo'}
              onChange={(e) => patch(issue, { status: e.target.value as Status })}
              className="rounded-md border border-white/15 bg-slate-900 px-2 py-1 text-xs"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <CopyForClaude issue={issue} />
            <button
              onClick={() => patch(issue, { state: 'closed' })}
              className="rounded-md border border-white/15 px-2 py-1 text-xs text-emerald-300/80 hover:bg-emerald-500/10"
            >
              Done
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
