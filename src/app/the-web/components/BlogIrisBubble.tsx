'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
}

const BUBBLE_WIDTH = 290;
const BUBBLE_GAP = 12;

export default function BlogIrisBubble({ slug, selection, onClose }: BlogIrisBubbleProps) {
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
  const passageRef = useRef(selection?.text || '');
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Track passage from initial selection
  useEffect(() => {
    if (selection?.text) {
      passageRef.current = selection.text;
    }
  }, [selection?.text]);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const handleClose = useCallback(() => {
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
  const showDraft = phase === 'drafting' || phase === 'draft_ready' || phase === 'submitting' || phase === 'submitted';

  // Compute position
  const getDesktopStyle = (): React.CSSProperties => {
    const rect = selection.rect;
    const top = rect.top + window.scrollY;
    let left = rect.right + BUBBLE_GAP;

    // Flip to left if overflowing viewport
    if (left + BUBBLE_WIDTH > window.innerWidth - 16) {
      left = rect.left - BUBBLE_WIDTH - BUBBLE_GAP;
    }

    // Clamp left to at least 16px
    if (left < 16) left = 16;

    return {
      position: 'absolute',
      top,
      left,
      width: BUBBLE_WIDTH,
      zIndex: 50,
    };
  };

  const bubbleContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        {/* Passage snippet */}
        <div className="flex-1 min-w-0 text-[10px] text-white/35 italic truncate pr-2">
          &ldquo;{passageRef.current.slice(0, 60)}
          {passageRef.current.length > 60 ? '...' : ''}&rdquo;
        </div>
        <button
          onClick={handleClose}
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-3 h-3 text-white/40" />
        </button>
      </div>

      {/* Conversation area */}
      {!showDraft && (
        <BlogIrisConversation
          messages={messages}
          isStreaming={isStreaming}
          onSend={handleSend}
          disabled={isStreaming}
        />
      )}

      {/* Action pills */}
      {showActions && !showDraft && (
        <div className="mt-2">
          <BlogIrisActions
            onComment={handleComment}
            onMessage={handleMessage}
          />
        </div>
      )}

      {/* Draft area */}
      {showDraft && draftType && (
        <BlogIrisDraft
          draftType={draftType}
          draft={draft}
          passageRef={passageRef.current}
          isLoading={phase === 'drafting'}
          error={error}
          onDraftChange={setDraft}
          onSubmit={handleDraftSubmit}
        />
      )}

      {/* Error display */}
      {phase === 'error' && error && !showDraft && (
        <div className="mt-2 text-[10px] text-red-400/80">{error}</div>
      )}
    </>
  );

  // Mobile: bottom sheet
  if (isMobile) {
    return (
      <div
        ref={bubbleRef}
        className="fixed bottom-0 left-0 right-0 max-h-[70vh] z-50 rounded-t-2xl bg-[rgba(15,23,42,0.95)] backdrop-blur-[40px] border-t border-white/[0.12] shadow-2xl p-4 overflow-y-auto"
      >
        {/* Drag handle */}
        <div className="flex justify-center mb-3">
          <div className="w-8 h-1 rounded-full bg-white/20" />
        </div>
        {bubbleContent}
      </div>
    );
  }

  // Desktop: absolute positioned bubble
  return (
    <div
      ref={bubbleRef}
      style={getDesktopStyle()}
      className="bg-[rgba(15,23,42,0.9)] backdrop-blur-[40px] border border-white/[0.12] rounded-2xl shadow-xl shadow-black/30 p-3.5"
    >
      {bubbleContent}
    </div>
  );
}
