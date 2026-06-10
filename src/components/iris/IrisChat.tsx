'use client';

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type Ref,
} from 'react';
import ReactMarkdown from 'react-markdown';

export interface IrisMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Shared Iris conversation surface: a scrollable message list (markdown
 * assistant bubbles, plain user bubbles) plus an auto-growing composer. Theme
 * via `accent` (send button) and slot extra UI between the list and the
 * composer with `belowMessages`. Used by Cere and the blog assistant.
 */
/** Imperative handle for parents that need to focus the composer (e.g. after a
 *  cancelled close-confirmation). */
export interface IrisChatHandle {
  focusInput: () => void;
}

export function IrisChat({
  messages,
  busy = false,
  onSend,
  placeholder = 'Type a message…',
  busyLabel = 'Thinking…',
  emptyHint,
  belowMessages,
  thinkingSlot,
  accent = '52, 211, 153',
  sendVariant = 'plain',
  className = '',
  onInputChange,
  handleRef,
}: {
  messages: IrisMessage[];
  busy?: boolean;
  onSend: (message: string) => void;
  placeholder?: string;
  busyLabel?: string;
  emptyHint?: ReactNode;
  belowMessages?: ReactNode;
  /** Replaces the default pulse-dots while thinking (e.g. Cere's harlequin loader). */
  thinkingSlot?: ReactNode;
  /** Send button accent as "R, G, B". */
  accent?: string;
  /** 'harlequin' = Google-palette diamond send button; 'plain' = solid accent. */
  sendVariant?: 'plain' | 'harlequin';
  className?: string;
  /** Notified with the live (untrimmed) composer value — lets a parent guard
   *  dismissal when there's unsent text. */
  onInputChange?: (value: string) => void;
  /** Imperative handle to focus the composer (used to restore focus after a
   *  cancelled close-confirmation). */
  handleRef?: Ref<IrisChatHandle>;
}) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(handleRef, () => ({
    focusInput: () => textareaRef.current?.focus(),
  }), []);

  // Update the input and notify the parent (for dirty-input dismissal guards).
  function updateInput(value: string) {
    setInput(value);
    onInputChange?.(value);
  }

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
    updateInput('');
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

        {showThinking &&
          (thinkingSlot ?? (
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
          ))}
      </div>

      {belowMessages}

      <form onSubmit={submit} className="mt-3 flex items-end gap-1.5">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => updateInput(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={4000}
          placeholder={placeholder}
          disabled={busy}
          rows={1}
          className="flex-1 resize-none rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[13px] leading-relaxed text-white/90 outline-none transition-colors placeholder:text-white/30 focus:border-white/[0.16] disabled:opacity-50"
          style={{ minHeight: '40px', maxHeight: '140px' }}
        />
        {/* A fixed one-line-tall box keeps the send button centered against the
            single-line textarea, even with the diamond's rotated bounding box. */}
        <div className="flex h-10 shrink-0 items-center">
          {sendVariant === 'harlequin' ? (
            // THE HARLEQUIN send: a champagne glass diamond (the Cere-panel
            // material) ringed by the full Google-palette conic gradient — the
            // rainbow kept as a border accent, not a flat slab. The arrow and
            // fill stay metal; the ring is the only place the palette lives here.
            <button
              type="submit"
              disabled={!input.trim() || busy}
              className="flex h-7 w-7 rotate-45 items-center justify-center rounded-[7px] text-[#E7E2D4] backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_3px_12px_rgba(0,0,0,0.45)] transition-all duration-200 hover:scale-110 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_0_14px_rgba(231,226,212,0.18)] active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
              style={{
                border: '1.5px solid transparent',
                background:
                  'linear-gradient(rgba(231,226,212,0.10), rgba(231,226,212,0.10)) padding-box, conic-gradient(from 135deg, #4285F4, #EA4335, #FBBC05, #34A853, #4285F4) border-box',
              }}
              aria-label="Send"
            >
              <span className="-rotate-45 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 10 4 15 9 20" />
                  <path d="M20 4v7a4 4 0 0 1-4 4H4" />
                </svg>
              </span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || busy}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white transition-all duration-200 disabled:opacity-30"
              style={{ backgroundColor: `rgb(${accent})` }}
              aria-label="Send"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 10 4 15 9 20" />
                <path d="M20 4v7a4 4 0 0 1-4 4H4" />
              </svg>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
