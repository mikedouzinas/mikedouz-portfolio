'use client';

import { useState, useEffect, useCallback, useRef, forwardRef } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { useBlogIris } from '../hooks/useBlogIris';
import BlogIrisConversation from './BlogIrisConversation';
import BlogIrisActions from './BlogIrisActions';
import BlogIrisDraft from './BlogIrisDraft';

interface TextSelection {
  text: string;
  rect: DOMRect;
}

interface BlogIrisBubbleProps {
  slug: string;
  postTitle?: string;
  selection: TextSelection | null;
  onClose: () => void;
  onLock: () => void;
  initialMessage?: string;
}

const BUBBLE_WIDTH = 290;
const BUBBLE_GAP = 12;
const BUBBLE_ESTIMATED_HEIGHT = 180;
const EXPANDED_WIDTH = 560;
const EXPANDED_MAX_HEIGHT = 520;

const BlogIrisBubble = forwardRef<HTMLDivElement, BlogIrisBubbleProps>(
  function BlogIrisBubble({ slug, postTitle, selection, onClose, onLock, initialMessage }, ref) {
    const {
      messages,
      phase,
      draft,
      draftType,
      error,
      sendMessage,
      requestDraft,
      setDraft,
      setPhase,
      setError,
      backToChat,
      reset,
    } = useBlogIris(slug);

    const [isMobile, setIsMobile] = useState(false);
    const [expanded, setExpanded] = useState(true);
    const [showDiscard, setShowDiscard] = useState(false);
    const internalRef = useRef<HTMLDivElement>(null);

    // Use forwarded ref or internal ref
    const bubbleEl = (ref && typeof ref !== 'function' ? ref : internalRef) as React.RefObject<HTMLDivElement>;

    // Track the passage text for API calls — locked when conversation starts
    const passageRef = useRef(selection?.text || '');

    // Update passage from selection while no messages exist (Phase 1: adjusting)
    // Use assignment outside useEffect so it's available in the same render cycle
    if (selection?.text && messages.length === 0) {
      passageRef.current = selection.text;
    }

    // Display text: use live selection text (always current), fall back to locked ref
    const displayPassage = (messages.length === 0 ? selection?.text : null) || passageRef.current;

    // Auto-send initial message (e.g. from Summarize button).
    // Keyed on initialMessage so Strict Mode's remount re-schedules after its own cleanup.
    // messages.length guard prevents re-sending if the prop is stable across later renders.
    useEffect(() => {
      if (!initialMessage || messages.length > 0) return;
      const t = setTimeout(() => {
        sendMessage(initialMessage, passageRef.current);
      }, 120);
      return () => clearTimeout(t);
    }, [initialMessage]); // eslint-disable-line react-hooks/exhaustive-deps

    // Lock selection and auto-expand when first message is sent
    const prevMessageCount = useRef(0);
    useEffect(() => {
      if (messages.length > 0 && prevMessageCount.current === 0) {
        onLock();
        if (!isMobile) setExpanded(true);
      }
      prevMessageCount.current = messages.length;
    }, [messages.length, onLock, isMobile]);

    // Detect mobile
    useEffect(() => {
      const check = () => setIsMobile(window.innerWidth < 768);
      check();
      window.addEventListener('resize', check);
      return () => window.removeEventListener('resize', check);
    }, []);

    // Click outside detection
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        const el = bubbleEl.current;
        if (el && !el.contains(e.target as Node)) {
          attemptClose();
        }
      };
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

    // Close on Escape
    useEffect(() => {
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          attemptClose();
        }
      };
      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
    }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

    const attemptClose = useCallback(() => {
      if (messages.length > 0) {
        setShowDiscard(true);
      } else {
        doClose();
      }
    }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-dismiss discard confirmation after 3 seconds
    useEffect(() => {
      if (!showDiscard) return;
      const timer = setTimeout(() => setShowDiscard(false), 3000);
      return () => clearTimeout(timer);
    }, [showDiscard]);

    const doClose = useCallback(() => {
      reset();
      onClose();
    }, [reset, onClose]);

    const handleSend = useCallback(
      (message: string) => {
        sendMessage(message, passageRef.current);
      },
      [sendMessage]
    );

    const handleComment = useCallback(() => {
      requestDraft('comment', passageRef.current);
    }, [requestDraft]);

    const handleMessage = useCallback(() => {
      requestDraft('message', passageRef.current);
    }, [requestDraft]);

    const handleBackToChat = useCallback(() => {
      backToChat();
    }, [backToChat]);

    const handleDraftSubmit = useCallback(
      async (data: { draft: string; authorName: string; contact: string; passageRef: string }) => {
        setPhase('submitting');
        setError(null);

        try {
          if (draftType === 'comment') {
            // Comment path: POST to comments API
            const res = await fetch(`/api/the-web/${slug}/comments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                author_name: data.authorName || 'Anonymous',
                author_email: data.contact.includes('@') ? data.contact : undefined,
                body: data.draft,
                passage_ref: data.passageRef || undefined,
              }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error || 'Failed to post comment');
            }
          } else {
            // Message path: POST to inbox API
            const contactTrimmed = data.contact.trim();
            let contactObj: { method: 'email'; value: string } | { method: 'phone'; value: string } | { method: 'anon' };
            if (contactTrimmed.includes('@')) {
              contactObj = { method: 'email', value: contactTrimmed };
            } else if (contactTrimmed && (contactTrimmed.startsWith('+') || /^\d+$/.test(contactTrimmed))) {
              contactObj = { method: 'phone', value: contactTrimmed };
            } else {
              contactObj = { method: 'anon' };
            }

            const res = await fetch('/api/inbox', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                source: 'blog-iris',
                message: data.draft,
                contact: contactObj,
                passage_ref: data.passageRef || undefined,
                post_slug: slug,
                post_title: postTitle || slug,
                iris_conversation: messages,
                nonce: crypto.randomUUID(),
                honeypot: '',
              }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error || 'Failed to send message');
            }
          }

          setPhase('submitted');
          // Notify comment section to refresh if a comment was posted
          if (draftType === 'comment') {
            window.dispatchEvent(new CustomEvent('iris-comment-posted'));
          }
          // Auto-close after brief confirmation
          setTimeout(() => doClose(), 1500);
        } catch (err) {
          setPhase('draft_ready');
          setError(err instanceof Error ? err.message : 'Something went wrong');
        }
      },
      [draftType, slug, postTitle, messages, doClose, setPhase, setError]
    );

    if (!selection) return null;

    const MAX_USER_TURNS = 3;
    const userTurnCount = messages.filter((m) => m.role === 'user').length;
    const isStreaming = phase === 'streaming';
    const chatExhausted = userTurnCount >= MAX_USER_TURNS && !isStreaming && phase === 'conversation';
    const showActions = phase === 'conversation' && messages.length > 0 && messages[messages.length - 1].role === 'assistant';
    const showDraftView = phase === 'drafting' || phase === 'draft_ready' || phase === 'submitting' || phase === 'submitted';

    // Position bubble: expanded = centered, compact = right of post body
    const getDesktopStyle = (): React.CSSProperties => {
      if (expanded) {
        return {
          position: 'fixed',
          top: (window.innerHeight - EXPANDED_MAX_HEIGHT) / 2,
          left: (window.innerWidth - EXPANDED_WIDTH) / 2,
          width: EXPANDED_WIDTH,
          maxHeight: EXPANDED_MAX_HEIGHT,
          zIndex: 50,
        };
      }

      const rect = selection.rect;
      const selectionMidY = rect.top + rect.height / 2;
      let compactTop = selectionMidY - BUBBLE_ESTIMATED_HEIGHT / 2;

      const postBody = document.querySelector('[data-post-body]');
      const containerRight = postBody ? postBody.getBoundingClientRect().right : rect.right;
      let compactLeft = containerRight + BUBBLE_GAP;

      if (compactLeft + BUBBLE_WIDTH > window.innerWidth - 16) {
        const containerLeft = postBody ? postBody.getBoundingClientRect().left : rect.left;
        compactLeft = containerLeft - BUBBLE_WIDTH - BUBBLE_GAP;
      }
      if (compactLeft < 16) compactLeft = 16;
      if (compactTop < 16) compactTop = 16;
      if (compactTop + BUBBLE_ESTIMATED_HEIGHT > window.innerHeight - 16) {
        compactTop = window.innerHeight - BUBBLE_ESTIMATED_HEIGHT - 16;
      }

      return {
        position: 'fixed',
        top: compactTop,
        left: compactLeft,
        width: BUBBLE_WIDTH,
        zIndex: 50,
      };
    };

    const bubbleContent = (
      <div className="select-none">
        {/* Discard confirmation */}
        {showDiscard && (
          <div className="flex items-center justify-between bg-white/[0.06] rounded-lg px-2.5 py-2 mb-2">
            <span className="text-[10px] text-white/50">Discard conversation?</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setShowDiscard(false)}
                className="text-[10px] text-white/40 hover:text-white/70 transition-colors px-1.5 py-0.5"
              >
                Keep
              </button>
              <button
                onClick={doClose}
                className="text-[10px] text-red-400/80 hover:text-red-400 transition-colors px-1.5 py-0.5"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1 min-w-0 text-[10px] text-white/35 italic truncate pr-2">
            &ldquo;{displayPassage.slice(0, expanded ? 120 : 60)}
            {displayPassage.length > (expanded ? 120 : 60) ? '...' : ''}&rdquo;
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {!isMobile && (
              <button
                onClick={() => setExpanded((e) => !e)}
                className={`w-5 h-5 flex items-center justify-center rounded-full transition-colors ${
                  expanded
                    ? 'bg-white/[0.08] hover:bg-white/[0.14]'
                    : 'hover:bg-white/10'
                }`}
                title={expanded ? 'Collapse' : 'Expand'}
              >
                {expanded
                  ? <Minimize2 className="w-2.5 h-2.5 text-teal-400/70" />
                  : <Maximize2 className="w-2.5 h-2.5 text-white/40" />
                }
              </button>
            )}
            <button
              onClick={attemptClose}
              className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-3 h-3 text-white/40" />
            </button>
          </div>
        </div>

        {/* Conversation area */}
        {!showDraftView && (
          <div className="select-text">
            <BlogIrisConversation
              messages={messages}
              isStreaming={isStreaming}
              onSend={handleSend}
              disabled={isStreaming}
              expanded={expanded}
              hideInput={chatExhausted}
            />
            {/* Hint below input when no messages yet */}
            {messages.length === 0 && (
              <p className="text-[9px] text-white/25 mt-1.5 leading-snug">
                share a thought and receive feedback, then Iris can help you comment or message Mike
              </p>
            )}
          </div>
        )}

        {/* Action pills */}
        {showActions && !showDraftView && (
          <div className="mt-2">
            <BlogIrisActions
              onComment={handleComment}
              onMessage={handleMessage}
            />
          </div>
        )}

        {/* Submitted confirmation */}
        {phase === 'submitted' && (
          <div className="flex flex-col items-center gap-1.5 py-4 text-center">
            <span className="text-emerald-400 text-lg">&#10003;</span>
            <span className="text-[11px] text-white/70">
              {draftType === 'comment' ? 'Comment posted' : 'Message sent'}
            </span>
          </div>
        )}

        {/* Draft area */}
        {showDraftView && phase !== 'submitted' && draftType && (
          <div>
            <BlogIrisDraft
              draftType={draftType}
              draft={draft}
              passageRef={passageRef.current}
              isLoading={phase === 'drafting'}
              isSubmitting={phase === 'submitting'}
              error={error}
              onDraftChange={setDraft}
              onSubmit={handleDraftSubmit}
              onCancel={handleBackToChat}
            />
          </div>
        )}

        {/* Error display */}
        {phase === 'error' && error && !showDraftView && (
          <div className="mt-2 text-[10px] text-red-400/80">{error}</div>
        )}
      </div>
    );

    if (isMobile) {
      return (
        <div
          ref={bubbleEl}
          className="iris-hud-enter fixed bottom-0 left-0 right-0 max-h-[85vh] z-50 rounded-t-2xl bg-teal-500/[0.08] border border-teal-400/[0.12] backdrop-blur-xl shadow-[0_-4px_24px_rgba(0,0,0,0.3)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] overflow-y-auto"
        >
          <div className="relative">
            <div className="relative">
              <div className="flex justify-center mb-3">
                <div className="w-8 h-1 rounded-full bg-white/20" />
              </div>
              {bubbleContent}
            </div>
          </div>
        </div>
      );
    }

    const glassClasses = `
      bg-teal-500/[0.08] border border-teal-400/[0.12]
      backdrop-blur-xl
      rounded-2xl overflow-y-auto
    `;

    return (
      <>
        <div
          ref={bubbleEl}
          data-has-contained-glow="true"
          style={getDesktopStyle()}
          className={`iris-hud-enter ${glassClasses} transition-[top,left,width,max-height,padding,box-shadow] duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${
            expanded
              ? 'p-5 shadow-[0_0_80px_40px_rgba(0,0,0,0.35),0_4px_24px_rgba(0,0,0,0.25)]'
              : 'p-3.5 shadow-[0_8px_48px_rgba(0,0,0,0.65),0_2px_12px_rgba(0,0,0,0.4)]'
          }`}
        >
          <div className="relative">
            {bubbleContent}
          </div>
        </div>
      </>
    );
  }
);

export default BlogIrisBubble;
