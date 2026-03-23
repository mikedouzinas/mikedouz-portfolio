# Blog Iris Interaction System + Site Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix sidebar overflow, redesign Spotify panel with glassmorphic Studio Green, and build a blog Iris interaction system where readers highlight text, converse with Iris, and leave comments or message Mike.

**Architecture:** Three independent features sharing no dependencies. Sidebar fix and Spotify redesign are CSS/layout changes. Blog Iris is a new subsystem: text selection → bubble UI → Iris API → draft generation → comment/message submission. Blog Iris uses existing Iris infrastructure (OpenAI, SSE streaming) with a new blog-specific endpoint and per-post context documents.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Framer Motion, OpenAI GPT-4o-mini, Supabase PostgreSQL, Resend email, Zod validation

**Spec:** `docs/superpowers/specs/2026-03-22-blog-iris-and-site-fixes-design.md`

---

## File Structure

### Feature 1: Sidebar Overflow Fix
- Modify: `src/app/sidebar_content.tsx` — flex layout restructure
- Modify: `src/components/spotify/SpotifyBubble.tsx` — responsive collapsed state

### Feature 2: Spotify Glassmorphic Redesign
- Modify: `src/components/spotify/SpotifyBubble.tsx` — background, border, shadow (3 locations)
- Modify: `src/components/spotify/SpotifyCard.tsx` — text colors (if needed)

### Feature 3: Blog Iris Interaction System
- Create: `supabase/migrations/20260322_blog_iris.sql` — add `passage_ref` to comments, `iris_context` to posts
- Modify: `src/lib/comments.ts` — add `passage_ref` field, anonymous default
- Modify: `src/lib/types.ts` — add `blog-iris` source, new inbox fields
- Modify: `src/lib/blog.ts` — add `iris_context` field
- Modify: `src/app/api/the-web/[slug]/comments/route.ts` — accept `passage_ref` in schema
- Create: `src/app/api/the-web/[slug]/iris/route.ts` — blog Iris API (conversation + draft modes)
- Create: `src/app/the-web/lib/loadingMessages.ts` — blog-specific loading messages
- Create: `src/app/the-web/lib/blogIrisPrompt.ts` — system prompts for conversation and draft modes
- Create: `src/app/the-web/components/BlogIrisBubble.tsx` — main bubble popup component
- Create: `src/app/the-web/components/BlogIrisConversation.tsx` — conversation UI inside bubble
- Create: `src/app/the-web/components/BlogIrisDraft.tsx` — draft comment/message UI
- Create: `src/app/the-web/components/BlogIrisActions.tsx` — quick action pills
- Create: `src/app/the-web/hooks/useTextSelection.ts` — text selection detection hook
- Create: `src/app/the-web/hooks/useBlogIris.ts` — blog Iris conversation state management
- Modify: `src/app/the-web/[slug]/page.tsx` — integrate BlogIrisBubble
- Modify: `src/app/the-web/components/CommentCard.tsx` — render passage_ref
- Modify: `src/app/the-web/components/CommentForm.tsx` — support passage_ref, anonymous default
- Modify: `src/app/api/inbox/route.ts` — update Resend email template for `blog-iris` source

### Feature 4: MessageComposer Consistency Refactor
- Modify: `src/components/iris/MessageComposer.tsx` — single smart contact field

---

## Task 1: Sidebar Overflow Fix

**Files:**
- Modify: `src/app/sidebar_content.tsx:69-145`
- Modify: `src/components/spotify/SpotifyBubble.tsx:94-146`

- [ ] **Step 1: Restructure sidebar flex layout**

In `src/app/sidebar_content.tsx`, change the outer container and wrap PlaygroundButton + social icons in a bottom group:

```tsx
// Line 69: Change from
<div className="flex flex-col h-full justify-between p-8 text-center md:text-center">
// To
<div className="flex flex-col h-full p-8 text-center md:text-center">
```

The top section (`<div>` containing HomeContent + nav) gets `flex-shrink-0`.

The SpotifyBubble gets wrapped in a flex-1 min-h-0 overflow-hidden container:
```tsx
{/* Spotify music timeline (deep mode only) */}
<div className="flex-1 min-h-0 overflow-hidden flex items-center">
  <SpotifyBubble />
</div>
```

The bottom section (PlaygroundButton + social icons) gets `flex-shrink-0`:
```tsx
<div className="w-48 mx-auto flex-shrink-0">
  <PlaygroundButton />
  <div className="flex space-x-4 justify-center md:justify-start">
    {/* social icons unchanged */}
  </div>
</div>
```

- [ ] **Step 2: Add responsive collapsed state to SpotifyBubble**

In `SpotifyBubble.tsx`, add a `ResizeObserver` to detect when the container is too short to show preview songs. Add a ref to the outer container and track available height:

```tsx
const containerRef = useRef<HTMLDivElement>(null);
const [compact, setCompact] = useState(false);

useEffect(() => {
  const el = containerRef.current;
  if (!el) return;
  const observer = new ResizeObserver((entries) => {
    const height = entries[0]?.contentRect.height ?? Infinity;
    setCompact(height < 140); // header (~40px) + 3 songs (~90px) + padding
  });
  observer.observe(el);
  return () => observer.disconnect();
}, []);
```

Wrap the outer `<div>` with `ref={containerRef}`. Conditionally hide preview songs when `compact`:

```tsx
{!compact && (
  <div className="px-3 pb-3 space-y-1">
    {recentMoments.map(/* ... */)}
    {/* remaining count */}
  </div>
)}
```

- [ ] **Step 3: Test on different viewport heights**

Run: `npm run dev`
- Resize browser to ~600px height → verify only header bar shows, social icons visible
- Resize to normal height → verify songs reappear
- Test expanded overlay still works at all heights

- [ ] **Step 4: Commit**

```bash
git add src/app/sidebar_content.tsx src/components/spotify/SpotifyBubble.tsx
git commit -m "fix: sidebar overflow — protect social icons on short viewports"
```

---

## Task 2: Spotify Glassmorphic Redesign

**Files:**
- Modify: `src/components/spotify/SpotifyBubble.tsx:100,158,164,190`

- [ ] **Step 1: Update collapsed view background**

In `SpotifyBubble.tsx` line ~100, change:
```tsx
backgroundColor: '#1a1a2e',
```
To:
```tsx
background: 'rgba(15,31,26,0.85)',
backdropFilter: 'blur(20px)',
WebkitBackdropFilter: 'blur(20px)',
border: '1px solid rgba(29,185,84,0.2)',
boxShadow: '0 8px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
```

Remove the existing `shadow-lg shadow-black/20` Tailwind classes from the className since we're using inline boxShadow now.

- [ ] **Step 2: Update expanded view background**

In `SpotifyBubble.tsx` line ~164, change:
```tsx
backgroundColor: '#1a1a2e',
```
To:
```tsx
background: 'rgba(15,31,26,0.92)',
backdropFilter: 'blur(30px)',
WebkitBackdropFilter: 'blur(30px)',
border: '1px solid rgba(29,185,84,0.2)',
boxShadow: '0 8px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
```

Remove existing `shadow-2xl shadow-black/40` Tailwind classes.

- [ ] **Step 3: Update sticky month label background**

In `SpotifyBubble.tsx` line ~190, change:
```tsx
style={{ color: '#1DB954', backgroundColor: '#1a1a2e' }}
```
To:
```tsx
style={{ color: '#1DB954', backgroundColor: 'rgba(15,31,26,0.95)' }}
```

- [ ] **Step 4: Update text colors in header**

In `SpotifyBubble.tsx`, update the "Mike's Music" header color:
```tsx
// Line ~109: Change from
style={{ color: '#9ca3af' }}
// To
style={{ color: '#86efac' }}
```

- [ ] **Step 5: Visual test**

Run: `npm run dev`
- Enter deep mode (click profile photo)
- Verify collapsed Spotify panel has green-tinted glassmorphic look
- Verify expanded panel matches
- Verify month labels don't flash a different color while scrolling
- Verify text is readable against the new background

- [ ] **Step 6: Commit**

```bash
git add src/components/spotify/SpotifyBubble.tsx
git commit -m "feat: spotify panel glassmorphic redesign — studio green"
```

---

## Task 3: Database Migrations for Blog Iris

**Files:**
- Create: `supabase/migrations/20260322_blog_iris.sql`

- [ ] **Step 1: Write migration**

```sql
-- Add passage_ref to blog_comments (optional — for highlight-anchored comments)
ALTER TABLE blog_comments ADD COLUMN IF NOT EXISTS passage_ref TEXT;

-- Add iris_context to blog_posts (optional — author's behind-the-scenes notes)
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS iris_context TEXT;

-- Update author_name default for anonymous comments
-- Drop and re-add constraint to ensure min 1 char with default
ALTER TABLE blog_comments DROP CONSTRAINT IF EXISTS author_name_length;
ALTER TABLE blog_comments ALTER COLUMN author_name SET DEFAULT 'Anonymous';
ALTER TABLE blog_comments ADD CONSTRAINT author_name_length CHECK (char_length(author_name) >= 1);
```

- [ ] **Step 2: Apply migration locally**

Run: `npx supabase db push` (or apply via Supabase dashboard if using remote)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260322_blog_iris.sql
git commit -m "feat: add passage_ref and iris_context columns for blog iris"
```

---

## Task 4: Update Data Layer — Comments, Inbox, Blog

**Files:**
- Modify: `src/lib/comments.ts:16-36,57-58`
- Modify: `src/lib/types.ts:7-19`
- Modify: `src/lib/blog.ts:22-36,52-62,179-203,236-268,274-312`

- [ ] **Step 1: Update BlogComment and CreateCommentInput in comments.ts**

In `src/lib/comments.ts`, add `passage_ref` to `BlogComment` interface (around line 26):
```typescript
passage_ref?: string | null;
```

Add `passage_ref` to `CreateCommentInput` interface (around line 36):
```typescript
passage_ref?: string;
```

Update `COMMENT_COLUMNS` (line ~57) to include `passage_ref` (do NOT add `author_email` — it's deliberately excluded for privacy):
```typescript
const COMMENT_COLUMNS =
  'id, post_id, parent_id, author_name, body, passage_ref, created_at, is_admin, is_deleted';
```

In `createComment()` (line ~88), include `passage_ref` in the insert data:
```typescript
const { data, error } = await supabase
  .from('blog_comments')
  .insert({
    post_id: input.post_id,
    parent_id: input.parent_id || null,
    author_name: input.author_name?.trim() || 'Anonymous',
    author_email: input.author_email?.trim() || null,
    body: input.body.trim(),
    passage_ref: input.passage_ref?.trim() || null,
    ip_hash: input.ip_hash,
  })
  // ...
```

- [ ] **Step 2: Update InboxPayload in types.ts**

In `src/lib/types.ts`, update the `InboxPayload` Zod schema (line ~7):

Add `'blog-iris'` to the source enum:
```typescript
source: z.enum(['iris-explicit', 'iris-suggested', 'auto-insufficient', 'blog-iris']),
```

Add optional blog context fields after the existing fields:
```typescript
passage_ref: z.string().max(500).optional(),
post_slug: z.string().max(200).optional(),
post_title: z.string().max(300).optional(),
iris_conversation: z.array(z.object({
  role: z.string(),
  content: z.string(),
})).optional(),
```

Also update the `InboxMessage` interface (line ~30) to include the new optional fields:
```typescript
passage_ref?: string;
post_slug?: string;
post_title?: string;
iris_conversation?: Array<{ role: string; content: string }>;
```

And update the Resend email template in `src/app/api/inbox/route.ts` — when `source === 'blog-iris'`, include the passage reference and post title in the email HTML so Mike has full context.

- [ ] **Step 3: Update blog.ts — add iris_context**

In `src/lib/blog.ts`, add `iris_context` to `BlogPost` interface (around line 36):
```typescript
iris_context?: string | null;
```

Add `iris_context` to `CreateBlogPostInput` (around line 62):
```typescript
iris_context?: string;
```

In `getPostBySlug()` (line ~184), append `, iris_context` to the select string:
```typescript
// Current: 'id, slug, title, subtitle, body, tags, published_at, updated_at, status, reading_time, cover_image, images, theme'
// New:     'id, slug, title, subtitle, body, tags, published_at, updated_at, status, reading_time, cover_image, images, theme, iris_context'
```

In `createBlogPost()` (line ~255) and `updateBlogPost()` (line ~299), both have their own select strings — append `, iris_context` to each one as well. Also include `iris_context` in the insert/update data objects when the field is present in the input.

- [ ] **Step 4: Update comments API route**

In `src/app/api/the-web/[slug]/comments/route.ts`, update `CreateCommentSchema` (line ~42) to accept `passage_ref`:
```typescript
passage_ref: z.string().max(500).optional(),
```

Update `author_name` to allow empty (will default):
```typescript
author_name: z.string().max(100).default('Anonymous'),
```

Pass `passage_ref` through to `createComment()` in the POST handler.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: No TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/comments.ts src/lib/types.ts src/lib/blog.ts src/app/api/the-web/\[slug\]/comments/route.ts
git commit -m "feat: data layer updates for blog iris — passage_ref, iris_context, blog-iris source"
```

---

## Task 5: Blog-Specific Loading Messages

**Files:**
- Create: `src/app/the-web/lib/loadingMessages.ts`

- [ ] **Step 1: Create the loading messages file**

```typescript
/**
 * Loading messages for Blog Iris interactions.
 * Lowercase sentence fragments matching WebLoader tone.
 * Web/thread metaphors fitting the blog's spider-web identity.
 */

const BLOG_IRIS_LOADING_MESSAGES = [
  "weaving thoughts together...",
  "spinning up the web...",
  "pulling threads...",
  "following the signal...",
  "untangling the web...",
  "loading thoughts...",
  "sorting meaning from noise...",
  "the web is wide. give me a moment.",
  "connecting the dots...",
  "tracing the thread...",
  "okay, let's do this one more time...",
  "that's all it is. a leap of faith.",
  "smoothing out the rough edges...",
  "one sec, thinking...",
] as const;

export function getRandomBlogLoadingMessage(): string {
  return BLOG_IRIS_LOADING_MESSAGES[
    Math.floor(Math.random() * BLOG_IRIS_LOADING_MESSAGES.length)
  ];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/the-web/lib/loadingMessages.ts
git commit -m "feat: blog-specific loading messages for iris interactions"
```

---

## Task 6: Blog Iris System Prompts

**Files:**
- Create: `src/app/the-web/lib/blogIrisPrompt.ts`

- [ ] **Step 1: Create the prompts file**

```typescript
/**
 * System prompts for the Blog Iris interaction system.
 * Three modes: conversation, draft_comment, draft_message.
 */

export function getConversationPrompt(postTitle: string, postBody: string, irisContext: string | null, passage: string): string {
  const contextSection = irisContext
    ? `\n\nAUTHOR'S BEHIND-THE-SCENES NOTES:\n${irisContext}`
    : '';

  return `You are Iris, an AI assistant on Mike Veson's blog "the web" at mikeveson.com. A reader has highlighted a passage from the post "${postTitle}" and wants to discuss it.

HIGHLIGHTED PASSAGE:
"${passage}"

POST CONTENT:
${postBody}${contextSection}

RULES:
- You represent Mike's perspective. Clarify and expand on his ideas when readers ask.
- If the author's notes address the reader's question, use that context.
- NEVER fabricate Mike's opinions. If you don't know what Mike thinks about something, say so.
- If the reader's question is unrelated to the post or Mike's work, politely redirect: "This post is about [topic] — if you want to ask Mike about that, you can message him directly."
- Be concise (2-4 sentences). Match the conversational tone of the blog.
- Do NOT use emojis.
- Do NOT include URLs in your response text.`;
}

export function getDraftCommentPrompt(): string {
  return `Based on the conversation below, draft a concise public comment (1-3 sentences) that captures the reader's main point. Write in the reader's voice, not yours. The comment should be thoughtful and engage with the ideas in the post. Do not add any preamble — just output the comment text.`;
}

export function getDraftMessagePrompt(postTitle: string): string {
  return `Based on the conversation below, draft a direct message from the reader to Mike about the post "${postTitle}". Include context about which passage sparked the discussion. Write in the reader's voice, conversational tone. Keep it under 3 sentences. Do not add any preamble — just output the message text.`;
}

/**
 * Truncate text to fit within a token budget.
 * Rough estimate: 1 token ≈ 4 characters.
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '...';
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/the-web/lib/blogIrisPrompt.ts
git commit -m "feat: blog iris system prompts for conversation and draft modes"
```

---

## Task 7: Blog Iris API Endpoint

**Files:**
- Create: `src/app/api/the-web/[slug]/iris/route.ts`

- [ ] **Step 1: Create the API route**

This endpoint handles three modes: `conversation` (SSE stream), `draft_comment` (JSON), `draft_message` (JSON).

```typescript
import { NextRequest } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';
import { getPostBySlug } from '@/lib/blog';
import { checkRateLimit } from '@/lib/rateLimit';
import {
  getConversationPrompt,
  getDraftCommentPrompt,
  getDraftMessagePrompt,
  truncateToTokens,
} from '@/app/the-web/lib/blogIrisPrompt';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const RequestSchema = z.object({
  message: z.string().min(1).max(500),
  passage: z.string().min(1).max(500),
  mode: z.enum(['conversation', 'draft_comment', 'draft_message']),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).max(20).optional().default([]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Rate limit: 20 requests per IP per hour
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rateLimitResult = await checkRateLimit(ip, 'blog-iris', 20, 3600);
  if (!rateLimitResult.allowed) {
    return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // Parse and validate
  let body;
  try {
    body = RequestSchema.parse(await request.json());
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Load post
  const post = await getPostBySlug(slug);
  if (!post) {
    return Response.json({ error: 'Post not found' }, { status: 404 });
  }

  const { message, passage, mode, history } = body;

  // Build context with token budgets
  const postBody = truncateToTokens(post.body, 3000);
  const irisContext = post.iris_context
    ? truncateToTokens(post.iris_context, 2000)
    : null;

  if (mode === 'conversation') {
    // SSE streaming response
    const systemPrompt = getConversationPrompt(post.title, postBody, irisContext, passage);
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user', content: message },
    ];

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 400,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  // Draft modes — return JSON
  const draftPrompt = mode === 'draft_comment'
    ? getDraftCommentPrompt()
    : getDraftMessagePrompt(post.title);

  const conversationContext = history
    .map((h) => `${h.role === 'user' ? 'Reader' : 'Iris'}: ${h.content}`)
    .join('\n');

  const draftMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: draftPrompt },
    {
      role: 'user',
      content: `Post: "${post.title}"\nPassage: "${passage}"\n\nConversation:\n${conversationContext}\nReader: ${message}`,
    },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: draftMessages,
      temperature: 0.7,
      max_tokens: 300,
    });

    const draft = completion.choices[0]?.message?.content?.trim() || message;
    return Response.json({ draft });
  } catch {
    return Response.json({ draft: message }); // Fallback: use reader's own message
  }
}
```

- [ ] **Step 2: Test endpoint manually**

Run: `npm run dev`

```bash
curl -X POST http://localhost:3000/api/the-web/YOUR_SLUG/iris \
  -H "Content-Type: application/json" \
  -d '{"message":"What do you mean by this?","passage":"test passage","mode":"conversation","history":[]}'
```

Expected: SSE stream with Iris response chunks.

```bash
curl -X POST http://localhost:3000/api/the-web/YOUR_SLUG/iris \
  -H "Content-Type: application/json" \
  -d '{"message":"I disagree with this","passage":"test passage","mode":"draft_comment","history":[]}'
```

Expected: JSON `{ "draft": "..." }`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/the-web/\[slug\]/iris/route.ts
git commit -m "feat: blog iris API endpoint — conversation streaming + draft generation"
```

---

## Task 8: Text Selection Hook

**Files:**
- Create: `src/app/the-web/hooks/useTextSelection.ts`

- [ ] **Step 1: Create the hook**

```typescript
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface TextSelection {
  text: string;
  rect: DOMRect;  // viewport-relative bounding rect
}

/**
 * Detects text selection within a specific container element.
 * Returns the selected text and its bounding rect for bubble positioning.
 */
export function useTextSelection(containerRef: React.RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const activeConversation = useRef(false);

  /** Mark that a conversation is active (prevents auto-close on selection clear) */
  const setConversationActive = useCallback((active: boolean) => {
    activeConversation.current = active;
  }, []);

  /** Manually dismiss the selection */
  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        // Selection cleared — only close if no active conversation
        if (!activeConversation.current) {
          setSelection(null);
        }
        return;
      }

      // Check if selection is within the post body container
      const anchor = sel.anchorNode;
      if (!anchor || !containerRef.current?.contains(anchor)) {
        return; // Selection is outside the post body
      }

      const range = sel.getRangeAt(0);
      const text = sel.toString().trim();
      if (text.length < 3) return; // Ignore tiny selections

      const rect = range.getBoundingClientRect();
      setSelection({ text, rect });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [containerRef]);

  return { selection, clearSelection, setConversationActive };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/the-web/hooks/useTextSelection.ts
git commit -m "feat: useTextSelection hook for blog iris bubble trigger"
```

---

## Task 9: Blog Iris Conversation State Hook

**Files:**
- Create: `src/app/the-web/hooks/useBlogIris.ts`

- [ ] **Step 1: Create the state management hook**

```typescript
'use client';

import { useState, useCallback, useRef } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type Phase = 'idle' | 'conversation' | 'drafting' | 'draft_ready' | 'submitting' | 'submitted' | 'error';

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
  const messagesRef = useRef<Message[]>([]); // Ref to avoid stale closures during streaming

  // Keep ref in sync
  messagesRef.current = state.messages;

  const sendMessage = useCallback(async (message: string, passage: string) => {
    const newMessages: Message[] = [...messagesRef.current, { role: 'user', content: message }];
    setState((s) => ({ ...s, messages: newMessages, phase: 'conversation', error: null }));

    try {
      abortRef.current = new AbortController();
      const res = await fetch(`/api/the-web/${slug}/iris`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          passage,
          mode: 'conversation',
          history: messagesRef.current.slice(0, -1), // Send history before this message
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error('API error');
      if (!res.body) throw new Error('No stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

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
              setState((s) => ({
                ...s,
                messages: [...newMessages, { role: 'assistant', content: assistantContent }],
              }));
            }
          } catch { /* skip malformed */ }
        }
      }

      setState((s) => ({
        ...s,
        messages: [...newMessages, { role: 'assistant', content: assistantContent }],
        phase: 'conversation',
      }));
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setState((s) => ({ ...s, phase: 'error', error: 'Something went wrong. Try again.' }));
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
      setState((s) => ({ ...s, phase: 'draft_ready', draft: data.draft || lastUserMsg }));
    } catch {
      // Fallback: use reader's own message
      setState((s) => ({ ...s, phase: 'draft_ready', draft: lastUserMsg, error: "Couldn't generate a draft — you can write your own below" }));
    }
  }, [slug]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ messages: [], phase: 'idle', draft: '', draftType: null, error: null });
  }, []);

  return { ...state, sendMessage, requestDraft, reset };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/the-web/hooks/useBlogIris.ts
git commit -m "feat: useBlogIris hook — conversation state + draft generation"
```

---

## Task 10: Blog Iris UI Components

**Files:**
- Create: `src/app/the-web/components/BlogIrisBubble.tsx`
- Create: `src/app/the-web/components/BlogIrisConversation.tsx`
- Create: `src/app/the-web/components/BlogIrisDraft.tsx`
- Create: `src/app/the-web/components/BlogIrisActions.tsx`

This is the largest task. Each component should be built and committed individually.

- [ ] **Step 1: Create BlogIrisActions.tsx (quick action pills)**

```typescript
'use client';

import { MessageSquare, Send } from 'lucide-react';

interface BlogIrisActionsProps {
  onComment: () => void;
  onMessage: () => void;
  disabled?: boolean;
}

export default function BlogIrisActions({ onComment, onMessage, disabled }: BlogIrisActionsProps) {
  return (
    <div className="flex gap-1.5 flex-wrap mb-2.5">
      <button
        onClick={onComment}
        disabled={disabled}
        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 transform bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:scale-105 disabled:opacity-50 disabled:scale-100"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        Leave a comment
      </button>
      <button
        onClick={onMessage}
        disabled={disabled}
        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 transform bg-gradient-to-r from-sky-500 to-indigo-600 text-white hover:scale-105 disabled:opacity-50 disabled:scale-100"
      >
        <Send className="w-3.5 h-3.5" />
        Message Mike
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create BlogIrisDraft.tsx (draft comment or message)**

This component handles both draft paths: the editable textarea, name/email or contact field, and the submit button. See spec for exact styling. Key points:
- `draftType === 'comment'`: name + email fields, "Post" button with Iris gradient
- `draftType === 'message'`: single contact field, "Send to Mike" button with purple→blue gradient
- Contact field auto-detects email vs phone
- Both support anonymous

- [ ] **Step 3: Create BlogIrisConversation.tsx (chat messages)**

Renders the conversation messages inside the bubble:
- User messages: right-aligned, `bg-white/[0.07]`, rounded
- Assistant messages: left-aligned, plain text, Iris response styling
- Streaming indicator while response is loading
- Input field at bottom with return button

- [ ] **Step 4: Create BlogIrisBubble.tsx (main container)**

The main bubble component that:
- Positions itself to the right of the selection (desktop) or as bottom sheet (mobile)
- Uses `getBoundingClientRect()` + `scrollY` for positioning
- Handles viewport overflow (flips to left if no room on right)
- Contains passage reference, conversation, actions, and draft
- Glassmorphic styling matching cmd+K palette
- Closes on Escape, click outside (with discard confirmation if conversation active)

**Desktop positioning logic:**
```typescript
const rect = selection.rect; // from useTextSelection
const top = rect.top + window.scrollY;
const left = rect.right + 12; // 12px gap
// If bubble would overflow right edge, flip to left
const bubbleWidth = 300;
if (left + bubbleWidth > window.innerWidth - 16) {
  left = rect.left - bubbleWidth - 12;
}
```

**Mobile bottom sheet:** Use `window.innerWidth < 768` to detect mobile. Render as fixed bottom sheet with:
- `position: fixed; bottom: 0; left: 0; right: 0; max-height: 70vh`
- Drag handle: 32px wide, 4px tall, `bg-white/20`, centered, rounded
- Touch tracking: `onTouchStart` records start Y, `onTouchMove` calculates delta, `onTouchEnd` checks if delta > 100px or velocity > 500px/s → dismiss
- `touch-action: none` on the sheet handle area to prevent browser pull-to-refresh

**Discard confirmation:** When conversation has messages and user tries to close (Escape, click outside, drag dismiss), show a small confirmation inline at the top of the bubble: "Discard conversation?" with "Discard" / "Keep" buttons. Auto-dismiss after 3 seconds if no action.

- [ ] **Step 5: Verify all components render**

Run: `npm run build`
Expected: No TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/the-web/components/BlogIris*.tsx
git commit -m "feat: blog iris UI components — bubble, conversation, actions, draft"
```

---

## Task 11: Integrate Blog Iris into Post Page

**Files:**
- Modify: `src/app/the-web/[slug]/page.tsx`
- Modify: `src/app/the-web/components/CommentCard.tsx`
- Modify: `src/app/the-web/components/CommentForm.tsx`

- [ ] **Step 1: Add BlogIrisBubble to the post page**

In `src/app/the-web/[slug]/page.tsx`, the post body needs a `data-post-body` attribute and a ref. Since this is a server component, we need a client wrapper for the interactive parts. Create a client component that wraps the post body and renders the bubble:

Add the bubble integration alongside the existing `CommentSection` at the bottom of the post.

- [ ] **Step 2: Update CommentCard to show passage_ref**

In `src/app/the-web/components/CommentCard.tsx`, add a passage reference block above the comment body when `passage_ref` exists:

```tsx
{comment.passage_ref && (
  <div className="text-xs text-gray-500 dark:text-gray-500 italic border-l-2 border-blue-500/30 pl-2 mb-2 line-clamp-2">
    Re: &ldquo;{comment.passage_ref}&rdquo;
  </div>
)}
```

- [ ] **Step 3: Update CommentForm to support passage_ref and anonymous**

In `src/app/the-web/components/CommentForm.tsx`:
- Accept optional `passageRef?: string` prop
- Include `passage_ref` in the POST body when present
- Allow empty `authorName` (submit as "Anonymous")
- Update `canSubmit` to remove the `authorName.trim().length >= 1` requirement

- [ ] **Step 4: End-to-end test**

Run: `npm run dev`
- Navigate to a blog post
- Highlight text → verify bubble appears to the right
- Type a message → verify Iris responds via streaming
- Click "Leave a comment" → verify draft loads
- Edit and post → verify comment appears at bottom with passage reference
- Test "Message Mike" path → verify message goes to inbox

- [ ] **Step 5: Commit**

```bash
git add src/app/the-web/\[slug\]/page.tsx src/app/the-web/components/CommentCard.tsx src/app/the-web/components/CommentForm.tsx
git commit -m "feat: integrate blog iris bubble into post page with passage-ref comments"
```

---

## Task 12: MessageComposer Consistency Refactor

**Files:**
- Modify: `src/components/iris/MessageComposer.tsx:362-466`

- [ ] **Step 1: Replace contact method toggle with single smart field**

In `MessageComposer.tsx`, replace the Email/Phone/Anonymous toggle section (lines ~362-466) with a single input field:

```tsx
{/* Smart contact field — auto-detects email vs phone */}
<div className="mb-2 sm:mb-3">
  <input
    type="text"
    value={contact}
    onChange={(e) => setContact(e.target.value)}
    disabled={locked || isSubmitting}
    placeholder="Email or phone (optional)"
    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-0 disabled:opacity-50 text-sm sm:text-base"
  />
  <p className="text-xs text-white/30 mt-1">Leave contact info to get a response</p>
  {contactError && <p className="text-xs text-red-400 mt-1">{contactError}</p>}
</div>
```

Add auto-detection logic:
```typescript
function detectContactType(value: string): 'email' | 'phone' | 'anon' {
  if (!value.trim()) return 'anon';
  if (value.includes('@')) return 'email';
  if (/^[+\d\s\-()]+$/.test(value)) return 'phone';
  return 'email'; // default assumption
}
```

Update the submit handler to use `detectContactType(contact)` instead of the manual toggle.

- [ ] **Step 2: Test**

Run: `npm run dev`
- Open Iris (⌘K) → trigger Message Mike
- Test empty (anonymous) → should submit
- Test email → should validate
- Test phone (+1 234 567 8900) → should validate
- Test invalid → should show error

- [ ] **Step 3: Commit**

```bash
git add src/components/iris/MessageComposer.tsx
git commit -m "refactor: MessageComposer — single smart contact field, anonymous default"
```

---

## Task 13: Final Build and Verification

- [ ] **Step 1: Full production build**

Run: `npm run build`
Expected: Clean build, no errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: No new lint errors.

- [ ] **Step 3: Manual QA checklist**

- [ ] Sidebar: social icons visible on short viewport (resize to ~600px height)
- [ ] Sidebar: Spotify songs reappear on normal height
- [ ] Spotify: glassmorphic green background on collapsed state
- [ ] Spotify: glassmorphic green background on expanded state
- [ ] Spotify: month labels match new background
- [ ] Blog Iris: highlight text → bubble appears to the right
- [ ] Blog Iris: type message → Iris streams response
- [ ] Blog Iris: "Leave a comment" → draft loads with fun message
- [ ] Blog Iris: edit and post comment → appears at bottom with passage ref
- [ ] Blog Iris: "Message Mike" → draft loads → sends to inbox
- [ ] Blog Iris: anonymous comment works
- [ ] Blog Iris: Escape closes bubble
- [ ] Blog Iris: click outside closes bubble
- [ ] MessageComposer: single contact field works (email, phone, anonymous)
