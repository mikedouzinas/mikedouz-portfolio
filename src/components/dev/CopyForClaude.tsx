'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { DevIssue } from '@/lib/dev/github';
import { Button } from '@/components/ui/Button';

export function CopyForClaude({ issue }: { issue: DevIssue }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const repoName = issue.repo.split('/')[1] ?? issue.repo;
    const text =
      `Work on this task in the ${repoName} repo.\n\n` +
      `Repo: ${issue.repo}\n` +
      `GitHub: https://github.com/${issue.repo}\n` +
      `Issue: #${issue.number} — ${issue.url}\n` +
      `Clone: gh repo clone ${issue.repo}   (or: git clone https://github.com/${issue.repo}.git)\n` +
      `Likely local path: ~/Downloads/Dev/${repoName}\n` +
      `Priority: ${issue.priority ?? 'p3'} · Status: ${issue.status ?? 'todo'}\n\n` +
      `${issue.title}\n\n${issue.body}\n\n` +
      `When complete, close issue #${issue.number}.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (non-secure context / denied) — no-op.
    }
  }

  return (
    <Button variant="ghost" glowColor="66, 133, 244" glowIntensity={0.18} onClick={copy} className="text-xs">
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy for Claude Code'}
    </Button>
  );
}
