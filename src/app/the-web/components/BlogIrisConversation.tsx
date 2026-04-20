'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { getRandomBlogLoadingMessage } from '../lib/loadingMessages';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface BlogIrisConversationProps {
  messages: Message[];
  isStreaming: boolean;
  onSend: (message: string) => void;
  disabled?: boolean;
  expanded?: boolean;
  hideInput?: boolean;
}

export default function BlogIrisConversation({
  messages,
  isStreaming,
  onSend,
  disabled,
  expanded,
  hideInput,
}: BlogIrisConversationProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [loadingMsg, setLoadingMsg] = useState(getRandomBlogLoadingMessage);

  // Rotate loading message every 3s while streaming
  useEffect(() => {
    if (!isStreaming) return;
    setLoadingMsg(getRandomBlogLoadingMessage());
    const interval = setInterval(() => {
      setLoadingMsg(getRandomBlogLoadingMessage());
    }, 3000);
    return () => clearInterval(interval);
  }, [isStreaming]);

  // Auto-scroll on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, messages[messages.length - 1]?.content]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = '0';
      el.style.height = Math.min(el.scrollHeight, 80) + 'px';
    }
  }, [input]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Show loading message when streaming and no assistant content yet
  const lastMsg = messages[messages.length - 1];
  const showLoadingMsg = isStreaming && (!lastMsg || lastMsg.role === 'user' || lastMsg.content === '');

  return (
    <div className="flex flex-col gap-2">
      {/* Messages */}
      {messages.length > 0 && (
        <div
          ref={scrollRef}
          className={`flex flex-col gap-2 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 ${expanded ? 'max-h-[360px]' : 'max-h-[200px]'}`}
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'user' ? (
                <div className={`bg-white/[0.07] text-white/90 px-2.5 py-1.5 rounded-[12px_12px_4px_12px] max-w-[85%] leading-relaxed ${expanded ? 'text-[13px]' : 'text-[11px]'}`}>
                  {msg.content}
                </div>
              ) : (
                <div className={`text-[#ccc] leading-relaxed max-w-[90%] iris-markdown ${expanded ? 'text-[13px]' : 'text-[11px]'}`}>
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="text-white/95 font-medium">{children}</strong>,
                      em: ({ children }) => <em className="text-white/70">{children}</em>,
                      ul: ({ children }) => <ul className="list-disc ml-3.5 mb-1.5 space-y-0.5">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal ml-3.5 mb-1.5 space-y-0.5">{children}</ol>,
                      li: ({ children }) => <li>{children}</li>,
                      a: ({ href, children }) => <a href={href} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                      code: ({ children }) => <code className="bg-white/[0.06] px-1 py-0.5 rounded text-[0.9em]">{children}</code>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Loading message while waiting for Iris */}
      {showLoadingMsg && (
        <div className="flex items-center gap-2 py-1">
          <div className="flex gap-1">
            <div className="w-1 h-1 rounded-full bg-emerald-400 opacity-30 animate-pulse" />
            <div className="w-1 h-1 rounded-full bg-emerald-400 opacity-60 animate-pulse" style={{ animationDelay: '150ms' }} />
            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-[10px] text-white/30 italic">{loadingMsg}</span>
        </div>
      )}

      {/* Input — hidden after max turns */}
      {!hideInput && <form onSubmit={handleSubmit} className="flex items-end gap-1.5">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={2000}
          placeholder={messages.length === 0 ? 'Questions or comments...' : 'Reply...'}
          disabled={disabled || isStreaming}
          rows={1}
          className={`flex-1 bg-white/[0.04] border border-white/[0.08] rounded-[10px] px-3 py-2 text-white/90 placeholder:text-white/30 outline-none focus:border-white/[0.16] transition-colors disabled:opacity-50 resize-none leading-relaxed ${expanded ? 'text-[13px]' : 'text-[11px] max-md:text-[16px]'}`}
          style={{ minHeight: expanded ? '40px' : '34px', maxHeight: expanded ? '120px' : '80px' }}
        />
        <button
          type="submit"
          disabled={!input.trim() || disabled || isStreaming}
          className={`flex-shrink-0 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-600 via-emerald-500 to-blue-600 text-white border border-white/20 transition-all duration-200 disabled:opacity-30 mb-0.5 ${expanded ? 'w-8 h-8' : 'w-7 h-7'}`}
        >
          <svg width={expanded ? '12' : '10'} height={expanded ? '12' : '10'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 10 4 15 9 20" />
            <path d="M20 4v7a4 4 0 0 1-4 4H4" />
          </svg>
        </button>
      </form>}
    </div>
  );
}
