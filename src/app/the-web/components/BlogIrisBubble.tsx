'use client';

import { useState, useEffect, useCallback, useRef, forwardRef } from 'react';
import { X } from 'lucide-react';
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
  selection: TextSelection | null;
  onClose: () => void;
  onLock: () => void;
}

const BUBBLE_WIDTH = 290;
const BUBBLE_GAP = 12;
const BUBBLE_ESTIMATED_HEIGHT = 180;

const BlogIrisBubble = forwardRef<HTMLDivElement, BlogIrisBubbleProps>(
  function BlogIrisBubble({ slug, selection, onClose, onLock }, ref) {
    const {
      messages,
      phase,
      draft,
      draftType,
      error,
      sendMessage,
      requestDraft,
      setDraft,
      reset,
    } = useBlogIris(slug);

    const [isMobile, setIsMobile] = useState(false);
    const [showDiscard, setShowDiscard] = useState(false);
    const internalRef = useRef<HTMLDivElement>(null);

    // Use forwarded ref or internal ref
    const bubbleEl = (ref && typeof ref !== 'function' ? ref : internalRef) as React.RefObject<HTMLDivElement>;

    // Track the passage text — updates with selection until locked
    const passageRef = useRef(selection?.text || '');

    // Update passage from selection while no messages exist (Phase 1: adjusting)
    useEffect(() => {
      if (selection?.text && messages.length === 0) {
        passageRef.current = selection.text;
      }
    }, [selection?.text, messages.length]);

    // Lock selection when first message is sent (Phase 2: locked)
    const prevMessageCount = useRef(0);
    useEffect(() => {
      if (messages.length > 0 && prevMessageCount.current === 0) {
        onLock();
      }
      prevMessageCount.current = messages.length;
    }, [messages.length, onLock]);

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
      reset();
    }, [reset]);

    const handleDraftSubmit = useCallback(
      (data: { draft: string; authorName: string; contact: string; passageRef: string }) => {
        // TODO: Wire up to submit API
        console.log('Submit draft:', data);
      },
      []
    );

    if (!selection) return null;

    const isStreaming = phase === 'streaming';
    const showActions = phase === 'conversation' && messages.length > 0 && messages[messages.length - 1].role === 'assistant';
    const showDraftView = phase === 'drafting' || phase === 'draft_ready' || phase === 'submitting' || phase === 'submitted';

    // Position bubble: right of content area, vertically centered on selection
    const getDesktopStyle = (): React.CSSProperties => {
      const rect = selection.rect;
      // Vertical: center bubble on the selection midpoint
      const selectionMidY = rect.top + rect.height / 2;
      let top = selectionMidY - BUBBLE_ESTIMATED_HEIGHT / 2;

      // Find the post body container to get its right edge
      const postBody = document.querySelector('[data-post-body]');
      const containerRight = postBody
        ? postBody.getBoundingClientRect().right
        : rect.right;

      let left = containerRight + BUBBLE_GAP;

      if (left + BUBBLE_WIDTH > window.innerWidth - 16) {
        const containerLeft = postBody
          ? postBody.getBoundingClientRect().left
          : rect.left;
        left = containerLeft - BUBBLE_WIDTH - BUBBLE_GAP;
      }
      if (left < 16) left = 16;
      if (top < 16) top = 16;
      // Don't let it go below viewport either
      if (top + BUBBLE_ESTIMATED_HEIGHT > window.innerHeight - 16) {
        top = window.innerHeight - BUBBLE_ESTIMATED_HEIGHT - 16;
      }

      return {
        position: 'fixed',
        top,
        left,
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
            &ldquo;{passageRef.current.slice(0, 60)}
            {passageRef.current.length > 60 ? '...' : ''}&rdquo;
          </div>
          <button
            onClick={attemptClose}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-3 h-3 text-white/40" />
          </button>
        </div>

        {/* Conversation area */}
        {!showDraftView && (
          <div className="select-text">
            <BlogIrisConversation
              messages={messages}
              isStreaming={isStreaming}
              onSend={handleSend}
              disabled={isStreaming}
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

        {/* Draft area */}
        {showDraftView && draftType && (
          <div>
            <BlogIrisDraft
              draftType={draftType}
              draft={draft}
              passageRef={passageRef.current}
              isLoading={phase === 'drafting'}
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
          className="fixed bottom-0 left-0 right-0 max-h-[70vh] z-50 rounded-t-2xl bg-[rgba(15,23,42,0.95)] backdrop-blur-[40px] border-t border-white/[0.12] shadow-2xl p-4 overflow-y-auto"
        >
          <div className="flex justify-center mb-3">
            <div className="w-8 h-1 rounded-full bg-white/20" />
          </div>
          {bubbleContent}
        </div>
      );
    }

    return (
      <div
        ref={bubbleEl}
        style={getDesktopStyle()}
        className="bg-[rgba(15,23,42,0.9)] backdrop-blur-[40px] border border-white/[0.12] rounded-2xl shadow-xl shadow-black/30 p-3.5"
      >
        {bubbleContent}
      </div>
    );
  }
);

export default BlogIrisBubble;
