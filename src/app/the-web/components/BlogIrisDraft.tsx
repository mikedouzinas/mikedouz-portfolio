'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { getRandomBlogLoadingMessage } from '../lib/loadingMessages';

interface BlogIrisDraftProps {
  draftType: 'comment' | 'message';
  draft: string;
  passageRef: string;
  isLoading: boolean;
  isSubmitting?: boolean;
  error: string | null;
  onDraftChange: (draft: string) => void;
  onSubmit: (data: {
    draft: string;
    authorName: string;
    contact: string;
    passageRef: string;
  }) => void;
  onCancel?: () => void;
}

function validateContact(value: string): { type: 'email' | 'phone' | 'anonymous'; valid: boolean } {
  const trimmed = value.trim();
  if (!trimmed) return { type: 'anonymous', valid: true };
  if (trimmed.includes('@')) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return { type: 'email', valid: emailPattern.test(trimmed) };
  }
  if (trimmed.startsWith('+') || /^\d+$/.test(trimmed)) {
    return { type: 'phone', valid: trimmed.replace(/\D/g, '').length >= 7 };
  }
  return { type: 'anonymous', valid: true };
}

export default function BlogIrisDraft({
  draftType,
  draft,
  passageRef,
  isLoading,
  isSubmitting,
  error,
  onDraftChange,
  onSubmit,
  onCancel,
}: BlogIrisDraftProps) {
  const [authorName, setAuthorName] = useState('');
  const [contact, setContact] = useState('');
  const [loadingMsg, setLoadingMsg] = useState(() => getRandomBlogLoadingMessage());
  const [fadeIn, setFadeIn] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rotate loading messages every 3s
  useEffect(() => {
    if (!isLoading) return;
    intervalRef.current = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setLoadingMsg(getRandomBlogLoadingMessage());
        setFadeIn(true);
      }, 200);
    }, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isLoading]);

  const isComment = draftType === 'comment';
  const minChars = isComment ? 10 : 3;
  const maxChars = isComment ? 5000 : 2000;
  const canSubmit = !isSubmitting && draft.trim().length >= minChars && draft.trim().length <= maxChars;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const contactCheck = validateContact(contact);
    if (!contactCheck.valid) return;

    onSubmit({
      draft: draft.trim(),
      authorName: authorName.trim(),
      contact: contact.trim(),
      passageRef,
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2.5">
        {/* Dimmed selected pill */}
        <div className="flex items-center gap-1.5 opacity-70">
          <div className={`flex items-center px-2.5 py-1 rounded-lg text-[10px] font-medium text-white ${
            isComment ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-gradient-to-r from-sky-500 to-indigo-600'
          }`}>
            {isComment ? 'Add a comment' : 'Message Mike'}
          </div>
        </div>
        {/* Loading message */}
        <div className="flex items-center gap-2 text-[11px] text-white/50">
          <span
            className="transition-opacity duration-200"
            style={{ opacity: fadeIn ? 1 : 0 }}
          >
            {loadingMsg}
          </span>
          <span className="flex gap-0.5">
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" style={{ animationDelay: '300ms' }} />
          </span>
        </div>
      </div>
    );
  }

  // Draft ready state
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
      {/* Passage reference */}
      {passageRef && (
        <div className="border-l-2 border-blue-500/30 pl-2.5 text-[10px] text-white/40 italic leading-relaxed line-clamp-2">
          Re: &ldquo;{passageRef}&rdquo;
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-[10px] text-amber-400/80">{error}</div>
      )}

      {/* Draft textarea */}
      <textarea
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        maxLength={maxChars}
        rows={4}
        className="w-full bg-black/30 border border-white/[0.08] rounded-[10px] px-3 py-2 text-[11px] max-md:text-[16px] text-white/90 placeholder:text-white/30 outline-none focus:border-white/[0.16] transition-colors resize-none leading-relaxed"
        placeholder={isComment ? 'Your comment...' : 'Your message to Mike...'}
      />

      {/* Character count */}
      <div className="flex justify-end">
        <span className={`text-[9px] ${draft.length > maxChars ? 'text-red-400' : 'text-white/20'}`}>
          {draft.length}/{maxChars}
        </span>
      </div>

      {/* Contact fields */}
      {isComment ? (
        <div className="flex flex-col gap-1.5">
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Name (optional)"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-[11px] max-md:text-[16px] text-white/90 placeholder:text-white/30 outline-none focus:border-white/[0.16] transition-colors"
          />
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Email (optional)"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-[11px] max-md:text-[16px] text-white/90 placeholder:text-white/30 outline-none focus:border-white/[0.16] transition-colors"
          />
          <p className="text-[9px] text-white/25">or post anonymous</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Email or phone (optional)"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-[10px] px-3 py-1.5 text-[11px] max-md:text-[16px] text-white/90 placeholder:text-white/30 outline-none focus:border-white/[0.16] transition-colors"
          />
          <p className="text-[9px] text-white/25">Leave contact info to get a response</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-[10px] text-white/40 hover:text-white/70 transition-colors"
          >
            Back
          </button>
        ) : <span />}
        <button
          type="submit"
          disabled={!canSubmit}
          className={`px-4 py-1.5 rounded-xl text-xs font-medium text-white transition-all duration-200 disabled:opacity-40 ${
            isComment
              ? 'bg-gradient-to-r from-blue-500 to-emerald-500 hover:scale-105'
              : 'hover:scale-105'
          }`}
          style={
            !isComment
              ? { background: 'linear-gradient(90deg, #6B4EFF, #00A8FF)' }
              : undefined
          }
        >
          {isSubmitting ? 'Sending...' : isComment ? 'Post' : 'Send to Mike'}
        </button>
      </div>
    </form>
  );
}
