'use client';

import { useState } from 'react';
import type { DevIssue } from '@/lib/dev/github';

export function CopyForClaude({ issue }: { issue: DevIssue }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const repoName = issue.repo.split('/')[1] ?? issue.repo;
    const text =
      `Work on this task in the ${repoName} repo ` +
      `(GitHub issue #${issue.number}, priority ${issue.priority ?? 'p3'}, status ${issue.status ?? 'todo'}).\n\n` +
      `${issue.title}\n\n${issue.body}\n\n` +
      `When complete, close issue #${issue.number}.`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={copy}
      className="rounded-md border border-white/15 px-2 py-1 text-xs text-white/70 hover:bg-white/5"
    >
      {copied ? 'Copied ✓' : 'Copy for Claude Code'}
    </button>
  );
}
