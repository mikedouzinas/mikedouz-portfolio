'use client';

import { useCallback, useRef, useState } from 'react';
import type { CereAction } from '@/lib/dev/cere';
import type { DevIssue } from '@/lib/dev/github';
import type { IrisMessage } from '@/components/iris/IrisChat';

interface CereState {
  messages: IrisMessage[];
  busy: boolean; // waiting on the planner
  applying: boolean; // executing confirmed actions
  actions: CereAction[]; // proposed, awaiting confirm
  warnings: string[];
  error: string | null;
}

const EMPTY: CereState = {
  messages: [],
  busy: false,
  applying: false,
  actions: [],
  warnings: [],
  error: null,
};

/** Best-effort extraction of a server error message from a failed response. */
async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    if (typeof data?.error === 'string' && data.error) return data.error;
  } catch {
    // non-JSON body; fall through to the status
  }
  return `HTTP ${res.status}`;
}

function summarize(actions: CereAction[]): string {
  const creates = actions.filter((a) => a.kind === 'create').length;
  const updates = actions.length - creates;
  const parts: string[] = [];
  if (creates) parts.push(`${creates} new ${creates === 1 ? 'ticket' : 'tickets'}`);
  if (updates) parts.push(`${updates} ${updates === 1 ? 'change' : 'changes'}`);
  return `Here's what I'll do — ${parts.join(' and ')}. Review and confirm below.`;
}

/**
 * Cere conversation state: sends to the planner (/api/dev/iris), holds the
 * proposed actions for preview, and on confirm executes them through the
 * existing /api/dev/issues endpoints. `onApplied` refreshes the board and is
 * handed any newly-created issues so the board can optimistically insert them
 * (GitHub's list endpoint is eventually-consistent — ticket #71). `issues` is
 * the live board, used to resolve ticket titles for the per-change summary
 * (ticket #66).
 */
export function useCere(
  onApplied: (created: DevIssue[]) => void,
  issues: DevIssue[] = [],
) {
  const [state, setState] = useState<CereState>(EMPTY);
  const messagesRef = useRef<IrisMessage[]>([]);
  const actionsRef = useRef<CereAction[]>([]);
  const issuesRef = useRef<DevIssue[]>([]);
  messagesRef.current = state.messages;
  actionsRef.current = state.actions;
  issuesRef.current = issues;

  // Title for a change summary line. Creates carry their own proposed title;
  // updates/closes resolve theirs from the already-loaded board (ticket #66).
  const titleFor = useCallback((a: CereAction): string => {
    if (a.kind === 'create') return a.title;
    if (a.kind === 'config') return "Cere's memory";
    const hit = issuesRef.current.find((i) => i.repo === a.repo && i.number === a.number);
    return hit?.title ?? `ticket #${a.number}`;
  }, []);

  const send = useCallback(async (message: string) => {
    const history = messagesRef.current;
    const next: IrisMessage[] = [...history, { role: 'user', content: message }];
    setState((s) => ({ ...s, messages: next, busy: true, error: null, actions: [], warnings: [] }));
    try {
      const res = await fetch('/api/dev/iris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Your dev session expired — reload /dev and log in again.');
        }
        const e = await res.json().catch(() => null);
        throw new Error(e?.error || 'Cere hit a problem. Try again.');
      }
      const data = (await res.json()) as { reply: string; actions: CereAction[]; warnings: string[] };
      const warnings = data.warnings ?? [];
      const reply =
        data.reply ||
        (data.actions.length
          ? summarize(data.actions)
          : warnings.length
            ? "I couldn't turn that into a change to file — see the note below."
            : "I couldn't turn that into a concrete change. Want to clarify and I'll draft it?");
      setState((s) => ({
        ...s,
        busy: false,
        messages: [...next, { role: 'assistant', content: reply }],
        actions: data.actions,
        warnings,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        busy: false,
        error: (err as Error).message,
        messages: [...next, { role: 'assistant', content: `⚠️ ${(err as Error).message}` }],
      }));
    }
  }, []);

  const confirm = useCallback(async () => {
    const actions = actionsRef.current;
    if (!actions.length) return;
    setState((s) => ({ ...s, applying: true, error: null }));

    let ok = 0;
    let fail = 0;
    // Each line leads with the ticket number + title so every applied change is
    // individually identifiable, even with several in one turn (ticket #66).
    const lines: string[] = [];
    // Issues the create POST returns, threaded back so the board can insert them
    // immediately rather than waiting on GitHub's eventually-consistent list
    // endpoint (ticket #71).
    const created: DevIssue[] = [];

    for (const a of actions) {
      const title = titleFor(a);
      try {
        if (a.kind === 'create') {
          const res = await fetch('/api/dev/issues', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              repo: a.repo,
              title: a.title,
              body: a.body,
              priority: a.priority,
              status: a.status,
              size: a.size,
            }),
          });
          if (!res.ok) throw new Error(await readError(res));
          const data = (await res.json()) as { issue: DevIssue };
          created.push(data.issue);
          lines.push(`#${data.issue.number} — ${title}: filed`);
          ok++;
        } else if (a.kind === 'config') {
          const body: Record<string, unknown> = {};
          if (typeof a.notes === 'string') body.notes = a.notes;
          if (a.addAliases.length > 0) {
            body.addAliases = Object.fromEntries(a.addAliases.map((p) => [p.alias, p.repo]));
          }
          const res = await fetch('/api/dev/cere-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error(await readError(res));
          lines.push(`${title}: updated`);
          ok++;
        } else {
          const patch: Record<string, unknown> = { repo: a.repo, number: a.number };
          if (a.priority) patch.priority = a.priority;
          if (a.status) patch.status = a.status;
          if (a.size) patch.size = a.size;
          if (a.state) patch.state = a.state;
          if (typeof a.body === 'string') patch.body = a.body;
          const res = await fetch('/api/dev/issues', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          });
          if (!res.ok) throw new Error(await readError(res));
          lines.push(`#${a.number} — ${title}: updated`);
          ok++;
        }
      } catch (err) {
        const reason = (err as Error).message;
        const ref = a.kind === 'update' ? `#${a.number}` : '#?';
        lines.push(`${ref} — ${title}: failed${reason ? ` (${reason})` : ''}`);
        fail++;
      }
    }

    onApplied(created);

    const header = fail
      ? `Applied ${ok}, ${fail} failed — check the GitHub token's Issues write permission.`
      : `Done — ${ok} ${ok === 1 ? 'change' : 'changes'} applied. Anything else?`;
    setState((s) => ({
      ...s,
      applying: false,
      actions: [],
      messages: [
        ...s.messages,
        { role: 'assistant', content: `${header}\n\n${lines.map((l) => `- ${l}`).join('\n')}` },
      ],
    }));
  }, [onApplied, titleFor]);

  const discard = useCallback(() => {
    setState((s) => ({
      ...s,
      actions: [],
      messages: [...s.messages, { role: 'assistant', content: 'Discarded — nothing was filed. What would you like instead?' }],
    }));
  }, []);

  const reset = useCallback(() => {
    messagesRef.current = [];
    actionsRef.current = [];
    setState(EMPTY);
  }, []);

  return { ...state, send, confirm, discard, reset };
}
