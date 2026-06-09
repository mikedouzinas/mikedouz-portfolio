'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';

export interface IrisMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Shared Iris conversation surface: a scrollable message list (markdown
 * assistant bubbles, plain user bubbles) plus an auto-growing composer. Theme
 * via `accent` (send button) and slot extra UI between the list and the
 * composer with `belowMessages`. Used by dogfiris and the blog assistant.
 */
export function IrisChat({
  messages,
  busy = false,
  onSend,
  placeholder = 'Type a message…',
  busyLabel = 'Thinking…',
  emptyHint,
  belowMessages,
  accent = '52, 211, 153',
  className = '',
}: {
  messages: IrisMessage[];
  busy?: boolean;
  onSend: (message: string) => void;
  placeholder?: string;
  busyLabel?: string;
  emptyHint?: ReactNode;
  belowMessages?: ReactNode;
  /** Send button accent as "R, G, B". */
  accent?: string;
  className?: string;
}) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll as content streams in.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, messages[messages.length - 1]?.content, busy]);

  // Auto-focus the composer on mount.
  useEffect(() => {
    const t = setTimeout(() => textareaRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  // Auto-resize the textarea.
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = '0';
      el.style.height = Math.min(el.scrollHeight, 140) + 'px';
    }
  }, [input]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || busy) return;
    onSend(trimmed);
    setInput('');
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(e);
    }
  }

  const last = messages[messages.length - 1];
  const showThinking = busy && (!last || last.role === 'user' || last.content === '');

  return (
    <div className={`flex h-full min-h-0 flex-col ${className}`}>
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 && emptyHint}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'user' ? (
              <div className="max-w-[85%] rounded-[12px_12px_4px_12px] bg-white/[0.08] px-3 py-1.5 text-[13px] leading-relaxed text-white/90">
                {msg.content}
              </div>
            ) : (
              <div className="iris-markdown max-w-[92%] text-[13px] leading-relaxed text-white/75">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="font-medium text-white/95">{children}</strong>,
                    em: ({ children }) => <em className="text-white/60">{children}</em>,
                    ul: ({ children }) => <ul className="mb-1.5 ml-3.5 list-disc space-y-0.5">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-1.5 ml-3.5 list-decimal space-y-0.5">{children}</ol>,
                    li: ({ children }) => <li>{children}</li>,
                    code: ({ children }) => (
                      <code className="rounded bg-white/[0.06] px-1 py-0.5 text-[0.9em]">{children}</code>
                    ),
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        ))}

        {showThinking && (
          <div className="flex items-center gap-2 py-1">
            <div className="flex gap-1">
              {[0, 150, 300].map((d) => (
                <div
                  key={d}
                  className="h-1 w-1 rounded-full animate-pulse"
                  style={{ backgroundColor: `rgb(${accent})`, animationDelay: `${d}ms` }}
                />
              ))}
            </div>
            <span className="text-[11px] italic text-white/30">{busyLabel}</span>
          </div>
        )}
      </div>

      {belowMessages}

      <form onSubmit={submit} className="mt-3 flex items-end gap-1.5">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={4000}
          placeholder={placeholder}
          disabled={busy}
          rows={1}
          className="flex-1 resize-none rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[13px] leading-relaxed text-white/90 outline-none transition-colors placeholder:text-white/30 focus:border-white/[0.16] disabled:opacity-50"
          style={{ minHeight: '40px', maxHeight: '140px' }}
        />
        <button
          type="submit"
          disabled={!input.trim() || busy}
          className="mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/20 text-white transition-all duration-200 disabled:opacity-30"
          style={{ backgroundColor: `rgb(${accent})` }}
          aria-label="Send"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 10 4 15 9 20" />
            <path d="M20 4v7a4 4 0 0 1-4 4H4" />
          </svg>
        </button>
      </form>
    </div>
  );
}
