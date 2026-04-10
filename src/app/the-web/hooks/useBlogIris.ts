'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

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
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesRef = useRef<Message[]>([]);

  messagesRef.current = state.messages;

  // Abort in-flight stream on unmount (e.g., navigating away from the post)
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (revealTimerRef.current) {
        clearInterval(revealTimerRef.current);
      }
    };
  }, []);

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
          history: messagesRef.current,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || 'Something went wrong. Try again.');
      }
      if (!res.body) throw new Error('Something went wrong. Try again.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let revealedLength = 0;
      revealTimerRef.current = null;

      const startReveal = () => {
        if (revealTimerRef.current) return;
        revealTimerRef.current = setInterval(() => {
          if (revealedLength >= assistantContent.length) return;
          let next = revealedLength;
          while (next < assistantContent.length && assistantContent[next] !== ' ' && assistantContent[next] !== '\n') next++;
          while (next < assistantContent.length && (assistantContent[next] === ' ' || assistantContent[next] === '\n')) next++;
          revealedLength = next;
          setState((s) => ({
            ...s,
            messages: [...newMessages, { role: 'assistant', content: assistantContent.slice(0, revealedLength) }],
          }));
        }, 30);
      };

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
              startReveal();
            }
          } catch { /* skip malformed */ }
        }
      }

      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;

      // Drain remaining words
      const finishReveal = () => {
        if (revealedLength >= assistantContent.length) {
          setState((s) => ({
            ...s,
            messages: [...newMessages, { role: 'assistant', content: assistantContent }],
            phase: 'conversation',
          }));
          return;
        }
        let next = revealedLength;
        while (next < assistantContent.length && assistantContent[next] !== ' ' && assistantContent[next] !== '\n') next++;
        while (next < assistantContent.length && (assistantContent[next] === ' ' || assistantContent[next] === '\n')) next++;
        revealedLength = next;
        setState((s) => ({
          ...s,
          messages: [...newMessages, { role: 'assistant', content: assistantContent.slice(0, revealedLength) }],
        }));
        requestAnimationFrame(finishReveal);
      };
      finishReveal();
    } catch (err) {
      if (revealTimerRef.current) {
        clearInterval(revealTimerRef.current);
        revealTimerRef.current = null;
      }
      if ((err as Error).name !== 'AbortError') {
        const message = (err as Error).message || 'Something went wrong. Try again.';
        setState((s) => ({ ...s, phase: 'error', error: message }));
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
      // Fallback to user's message if draft is too short (<10 chars)
      const finalDraft = data.draft && data.draft.length >= 10 ? data.draft : lastUserMsg;
      setState((s) => ({ ...s, phase: 'draft_ready', draft: finalDraft }));
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

  const setPhase = useCallback((phase: Phase) => {
    setState((s) => ({ ...s, phase }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((s) => ({ ...s, error }));
  }, []);

  const backToChat = useCallback(() => {
    setState((s) => ({ ...s, phase: 'conversation', draft: '', draftType: null, error: null }));
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    setState({ messages: [], phase: 'idle', draft: '', draftType: null, error: null });
  }, []);

  return { ...state, sendMessage, requestDraft, setDraft, setPhase, setError, backToChat, reset };
}
