'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { DevIssue } from '@/lib/dev/github';
import { buildClaudePrompt } from '@/lib/dev/copy';
import { Button } from '@/components/ui/Button';

export function CopyForClaude({ issue }: { issue: DevIssue }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    // Whole-ticket prompt — includes the body's subtask checklist automatically.
    try {
      await navigator.clipboard.writeText(buildClaudePrompt(issue));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (non-secure context / denied) — no-op.
    }
  }

  return (
    <Button variant="ghost" glowColor="66, 133, 244" glowIntensity={0.18} onClick={copy} className="text-xs">
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}
