'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface BlogIrisConversationProps {
  messages: Message[];
  isStreaming: boolean;
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function BlogIrisConversation({
  messages,
  isStreaming,
  onSend,
  disabled,
}: BlogIrisConversationProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, messages[messages.length - 1]?.content]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput('');
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Messages */}
      {messages.length > 0 && (
        <div
          ref={scrollRef}
          className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10"
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'user' ? (
                <div className="bg-white/[0.07] text-[11px] text-white/90 px-2.5 py-1.5 rounded-[12px_12px_4px_12px] max-w-[85%] leading-relaxed">
                  {msg.content}
                </div>
              ) : (
                <div className="text-[11px] text-[#ccc] leading-relaxed max-w-[90%]">
                  {msg.content}
                  {isStreaming && i === messages.length - 1 && (
                    <span className="inline-flex ml-0.5">
                      <span className="animate-pulse">...</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Reply..."
          disabled={disabled || isStreaming}
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-[10px] px-3 py-2 text-[11px] text-white/90 placeholder:text-white/30 outline-none focus:border-white/[0.16] transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || disabled || isStreaming}
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-r from-blue-500 to-emerald-500 text-white transition-opacity disabled:opacity-30"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="rotate-90"
          >
            <path
              d="M6 10V2M6 2L2.5 5.5M6 2L9.5 5.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </form>
    </div>
  );
}
