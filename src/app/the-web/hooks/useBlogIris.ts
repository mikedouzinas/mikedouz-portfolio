'use client';

import { useState, useCallback, useRef } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type Phase = 'idle' | 'conversation' | 'streaming' | 'drafting' | 'draft_ready' | 'submitting' | 'submitted' | 'error';

interface BlogIrisState {
  messages: Message[];
  phase: Phase;
  draft: string;
  draftType: 'comment' | 'message' | null;
  error: string | null;
}

export function useBlogIris(slug: string) {
  const [state, setState] = useState<BlogIrisState>({
    messages: [],
    phase: 'idle',
    draft: '',
    draftType: null,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Message[]>([]);

  messagesRef.current = state.messages;

  const sendMessage = useCallback(async (message: string, passage: string) => {
    const newMessages: Message[] = [...messagesRef.current, { role: 'user', content: message }];
    setState((s) => ({ ...s, messages: newMessages, phase: 'streaming', error: null }));

    try {
      abortRef.current = new AbortController();
      const res = await fetch(`/api/the-web/${slug}/iris`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          passage,
          mode: 'conversation',
          history: messagesRef.current.slice(0, -1),
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error('API error');
      if (!res.body) throw new Error('No stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              assistantContent += parsed.content;
              setState((s) => ({
                ...s,
                messages: [...newMessages, { role: 'assistant', content: assistantContent }],
              }));
            }
          } catch { /* skip malformed */ }
        }
      }

      setState((s) => ({
        ...s,
        messages: [...newMessages, { role: 'assistant', content: assistantContent }],
        phase: 'conversation',
      }));
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setState((s) => ({ ...s, phase: 'error', error: 'Something went wrong. Try again.' }));
      }
    }
  }, [slug]);

  const requestDraft = useCallback(async (type: 'comment' | 'message', passage: string) => {
    setState((s) => ({ ...s, phase: 'drafting', draftType: type }));
    const lastUserMsg = messagesRef.current.filter((m) => m.role === 'user').pop()?.content || '';

    try {
      const res = await fetch(`/api/the-web/${slug}/iris`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: lastUserMsg,
          passage,
          mode: type === 'comment' ? 'draft_comment' : 'draft_message',
          history: messagesRef.current,
        }),
      });

      const data = await res.json();
      setState((s) => ({ ...s, phase: 'draft_ready', draft: data.draft || lastUserMsg }));
    } catch {
      setState((s) => ({
        ...s,
        phase: 'draft_ready',
        draft: lastUserMsg,
        error: "Couldn't generate a draft — you can write your own below",
      }));
    }
  }, [slug]);

  const setDraft = useCallback((draft: string) => {
    setState((s) => ({ ...s, draft }));
  }, []);

  const backToChat = useCallback(() => {
    setState((s) => ({ ...s, phase: 'conversation', draft: '', draftType: null, error: null }));
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ messages: [], phase: 'idle', draft: '', draftType: null, error: null });
  }, []);

  return { ...state, sendMessage, requestDraft, setDraft, backToChat, reset };
}
