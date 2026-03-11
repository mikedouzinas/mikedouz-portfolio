'use client';

import { useState, useEffect, FormEvent } from 'react';
import type { BlogComment } from '@/lib/comments';

interface CommentFormProps {
  postSlug: string;
  parentId?: string;
  parentAuthor?: string;
  onSubmit: (comment: BlogComment) => void;
  onCancel?: () => void;
}

const LS_NAME_KEY = 'the-web-comment-name';
const LS_EMAIL_KEY = 'the-web-comment-email';

export default function CommentForm({
  postSlug,
  parentId,
  parentAuthor,
  onSubmit,
  onCancel,
}: CommentFormProps) {
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [body, setBody] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore saved name/email from localStorage
  useEffect(() => {
    try {
      const savedName = localStorage.getItem(LS_NAME_KEY);
      const savedEmail = localStorage.getItem(LS_EMAIL_KEY);
      if (savedName) setAuthorName(savedName);
      if (savedEmail) setAuthorEmail(savedEmail);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const canSubmit = authorName.trim().length >= 1 && body.trim().length >= 10;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      // Persist name/email for next time
      try {
        localStorage.setItem(LS_NAME_KEY, authorName.trim());
        if (authorEmail.trim()) {
          localStorage.setItem(LS_EMAIL_KEY, authorEmail.trim());
        }
      } catch {
        // localStorage unavailable
      }

      const res = await fetch(`/api/the-web/${postSlug}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: authorName.trim(),
          author_email: authorEmail.trim() || undefined,
          body: body.trim(),
          parent_id: parentId,
          honeypot,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'something went wrong');
        return;
      }

      const data = await res.json();
      onSubmit(data.comment);
      setBody('');
    } catch {
      setError('failed to post comment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {parentAuthor && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            replying to {parentAuthor}
          </span>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              cancel
            </button>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="your name"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          maxLength={100}
          className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 outline-none transition-colors"
        />
        <input
          type="email"
          placeholder="email (optional, not displayed)"
          value={authorEmail}
          onChange={(e) => setAuthorEmail(e.target.value)}
          className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 outline-none transition-colors"
        />
      </div>

      <div>
        <textarea
          placeholder="what are you thinking?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
          rows={3}
          className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 outline-none transition-colors resize-y min-h-[80px]"
        />
        <div className="flex justify-end mt-1">
          {body.length > 0 && body.length < 10 && (
            <span className="text-xs text-gray-600">
              minimum 10 characters
            </span>
          )}
          {body.length >= 100 && (
            <span className="text-xs text-gray-600">
              {body.length} / 5000
            </span>
          )}
        </div>
      </div>

      {/* Honeypot field — visually hidden, catches bots */}
      <div
        style={{ position: 'absolute', left: '-9999px' }}
        aria-hidden="true"
      >
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? 'posting...' : 'post comment'}
        </button>
      </div>
    </form>
  );
}
