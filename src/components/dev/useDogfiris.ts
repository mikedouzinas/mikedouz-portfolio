'use client';

import { useCallback, useRef, useState } from 'react';
import type { DogfirisAction } from '@/lib/dev/dogfiris';
import type { IrisMessage } from '@/components/iris/IrisChat';

interface DogfirisState {
  messages: IrisMessage[];
  busy: boolean; // waiting on the planner
  applying: boolean; // executing confirmed actions
  actions: DogfirisAction[]; // proposed, awaiting confirm
  warnings: string[];
  error: string | null;
}

const EMPTY: DogfirisState = {
  messages: [],
  busy: false,
  applying: false,
  actions: [],
  warnings: [],
  error: null,
};

function summarize(actions: DogfirisAction[]): string {
  const creates = actions.filter((a) => a.kind === 'create').length;
  const updates = actions.length - creates;
  const parts: string[] = [];
  if (creates) parts.push(`${creates} new ${creates === 1 ? 'ticket' : 'tickets'}`);
  if (updates) parts.push(`${updates} ${updates === 1 ? 'change' : 'changes'}`);
  return `Here's what I'll do — ${parts.join(' and ')}. Review and confirm below.`;
}

/**
 * dogfiris conversation state: sends to the planner (/api/dev/iris), holds the
 * proposed actions for preview, and on confirm executes them through the
 * existing /api/dev/issues endpoints. `onApplied` refreshes the board.
 */
export function useDogfiris(onApplied: () => void) {
  const [state, setState] = useState<DogfirisState>(EMPTY);
  const messagesRef = useRef<IrisMessage[]>([]);
  const actionsRef = useRef<DogfirisAction[]>([]);
  messagesRef.current = state.messages;
  actionsRef.current = state.actions;

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
        const e = await res.json().catch(() => null);
        throw new Error(e?.error || 'dogfiris hit a problem. Try again.');
      }
      const data = (await res.json()) as { reply: string; actions: DogfirisAction[]; warnings: string[] };
      const reply = data.reply || (data.actions.length ? summarize(data.actions) : '…');
      setState((s) => ({
        ...s,
        busy: false,
        messages: [...next, { role: 'assistant', content: reply }],
        actions: data.actions,
        warnings: data.warnings ?? [],
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
    for (const a of actions) {
      try {
        let res: Response;
        if (a.kind === 'create') {
          res = await fetch('/api/dev/issues', {
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
        } else {
          const patch: Record<string, unknown> = { repo: a.repo, number: a.number };
          if (a.priority) patch.priority = a.priority;
          if (a.status) patch.status = a.status;
          if (a.size) patch.size = a.size;
          if (a.state) patch.state = a.state;
          res = await fetch('/api/dev/issues', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          });
        }
        if (!res.ok) throw new Error();
        ok++;
      } catch {
        fail++;
      }
    }

    onApplied();
    setState((s) => ({
      ...s,
      applying: false,
      actions: [],
      messages: [
        ...s.messages,
        {
          role: 'assistant',
          content: fail
            ? `Applied ${ok}, but ${fail} failed — check the GitHub token's Issues write permission.`
            : `Done — ${ok} ${ok === 1 ? 'change' : 'changes'} applied. Anything else?`,
        },
      ],
    }));
  }, [onApplied]);

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
