# The Web Comments System

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a threaded comment system to blog posts on "the web" (mikeveson.com/the-web). Open to anyone (no auth required), discussion-oriented, with admin moderation. Should feel native to the existing dark/minimal aesthetic.

**Architecture:** Comments stored in Supabase `blog_comments` table with self-referencing `parent_id` for one-level threading. Public API routes for reading/creating comments, admin-protected routes for moderation. Client-side React components with optimistic updates and Framer Motion animations. Anti-spam via honeypot field, rate limiting, and minimum character length.

**Tech Stack:** Next.js 15 (App Router), Supabase (PostgreSQL), Tailwind CSS, Framer Motion, Zod validation, Resend (admin notification emails)

**Existing patterns to follow:**
- API routes at `src/app/api/the-web/`
- Blog data layer in `src/lib/blog.ts`
- Admin auth via `x-admin-key` header checked against `env.adminApiKey`
- Supabase admin client from `src/lib/supabaseAdmin.ts` (service role, bypasses RLS)
- Blog post page is a server component at `src/app/the-web/[slug]/page.tsx`
- Blog components live in `src/app/the-web/components/`

---

## Database Schema

### Migration SQL

Create file: `supabase/migrations/20260310_blog_comments.sql`

```sql
-- Blog comments table
CREATE TABLE IF NOT EXISTS blog_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES blog_comments(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT,           -- optional, never displayed publicly, used for gravatar-style avatar only
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_admin BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,  -- soft delete for moderation (preserves thread structure)
  ip_hash TEXT,                -- hashed IP for rate limiting, never stored raw

  -- Constraints
  CONSTRAINT body_min_length CHECK (char_length(body) >= 10),
  CONSTRAINT body_max_length CHECK (char_length(body) <= 5000),
  CONSTRAINT author_name_length CHECK (char_length(author_name) >= 1 AND char_length(author_name) <= 100),
  CONSTRAINT single_nesting CHECK (
    parent_id IS NULL OR
    NOT EXISTS (
      SELECT 1 FROM blog_comments pc WHERE pc.id = parent_id AND pc.parent_id IS NOT NULL
    )
  )
);

-- Indexes
CREATE INDEX idx_blog_comments_post_id ON blog_comments(post_id);
CREATE INDEX idx_blog_comments_parent_id ON blog_comments(parent_id);
CREATE INDEX idx_blog_comments_created_at ON blog_comments(created_at DESC);
CREATE INDEX idx_blog_comments_ip_hash ON blog_comments(ip_hash);

-- Add comment_count to blog_posts for efficient display
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;

-- Function to update comment_count on blog_posts
CREATE OR REPLACE FUNCTION update_blog_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE blog_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.is_deleted = FALSE AND NEW.is_deleted = TRUE THEN
    UPDATE blog_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = NEW.post_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.is_deleted = TRUE AND NEW.is_deleted = FALSE THEN
    UPDATE blog_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_blog_comment_count
  AFTER INSERT OR UPDATE OF is_deleted ON blog_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_blog_post_comment_count();
```

**Note on the `single_nesting` constraint:** This CHECK constraint prevents replies to replies at the database level. However, Postgres CHECK constraints that reference other rows are not reliable under concurrent writes. The API layer MUST also enforce this. The constraint serves as a safety net, not the primary enforcement.

**Alternative approach if the CHECK constraint causes issues:** Remove the `single_nesting` constraint and rely solely on the API layer validation. Add a comment in the migration noting the API is the source of truth for nesting depth.

---

## Data Layer

### File: `src/lib/comments.ts`

New file alongside `src/lib/blog.ts`. Contains types and Supabase query functions.

```typescript
// Types

export interface BlogComment {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
  is_admin: boolean;
  is_deleted: boolean;
  replies?: BlogComment[];  // populated client-side by nesting logic
}

export interface CreateCommentInput {
  post_id: string;
  parent_id?: string;
  author_name: string;
  author_email?: string;
  body: string;
  ip_hash?: string;
}

// Query functions needed:

// getCommentsForPost(postId: string): Promise<BlogComment[]>
//   - Fetches all non-deleted comments for a post, ordered by created_at ASC
//   - Returns flat array (client-side nesting)
//   - Select: id, post_id, parent_id, author_name, body, created_at, is_admin, is_deleted

// createComment(input: CreateCommentInput): Promise<BlogComment>
//   - Inserts a new comment
//   - If parent_id is provided, validate the parent exists AND has no parent_id itself (single nesting)
//   - Returns the created comment

// deleteComment(commentId: string): Promise<void>
//   - Soft delete: sets is_deleted = true
//   - Admin only (checked in API route)

// getCommentCount(postId: string): Promise<number>
//   - Returns count from blog_posts.comment_count column
//   - Used for post list display

// checkRateLimit(ipHash: string): Promise<boolean>
//   - Count comments from this ipHash in the last 5 minutes
//   - Return true if under limit (max 3 comments per 5 minutes)
//   - Query: SELECT COUNT(*) FROM blog_comments WHERE ip_hash = $1 AND created_at > NOW() - INTERVAL '5 minutes'
```

### IP Hashing

Hash the client IP before storing. Use Node's `crypto` module:

```typescript
import { createHash } from 'crypto';

export function hashIP(ip: string): string {
  return createHash('sha256')
    .update(ip + (process.env.IP_HASH_SALT || 'the-web-comments'))
    .digest('hex')
    .slice(0, 16);  // truncate, we don't need full hash
}
```

Get the IP from the request using `req.headers.get('x-forwarded-for')` (Vercel sets this) or `req.ip`.

---

## API Routes

### 1. `src/app/api/the-web/[slug]/comments/route.ts`

**GET** `/api/the-web/[slug]/comments` (public)
- Look up the post by slug to get the `post_id`
- Fetch all comments for that post via `getCommentsForPost(postId)`
- Return `{ comments: BlogComment[] }`

**POST** `/api/the-web/[slug]/comments` (public, rate-limited)
- Zod validation schema:

```typescript
const CreateCommentSchema = z.object({
  author_name: z.string().min(1).max(100).trim(),
  author_email: z.string().email().optional().or(z.literal('')),
  body: z.string().min(10, 'Comment must be at least 10 characters').max(5000).trim(),
  parent_id: z.string().uuid().optional(),
  honeypot: z.string().max(0).optional(),  // must be empty
});
```

- **Anti-spam checks (in order):**
  1. Honeypot field: if `honeypot` is non-empty, return 200 with fake success (don't tip off bots)
  2. Rate limit: hash IP, check `checkRateLimit(ipHash)`. If exceeded, return 429
  3. Body length: Zod handles min 10 chars
  4. Parent nesting: if `parent_id` provided, verify parent exists and has no parent_id itself

- On success:
  1. Insert comment
  2. Send notification email to Mike via Resend (non-blocking, don't fail the request if email fails)
  3. Return `{ comment: BlogComment }` with status 201

- **Notification email format:**

```
Subject: New comment on "Post Title"
Body:
{author_name} commented on "{post_title}":

"{body}"

{if reply: "In reply to {parent_author_name}'s comment"}

View: https://mikeveson.com/the-web/{slug}#comment-{comment_id}
Delete: (include admin delete curl command for quick moderation)
```

### 2. `src/app/api/the-web/comments/[id]/route.ts`

**DELETE** `/api/the-web/comments/[id]` (admin only)
- Check `x-admin-key` header
- Soft delete the comment (set `is_deleted = true`)
- Return `{ success: true }`

---

## Component Architecture

### File tree (new files)

```
src/app/the-web/components/
  CommentSection.tsx      -- main wrapper, fetches + displays comments
  CommentForm.tsx         -- the input form (name, email, body, honeypot)
  CommentThread.tsx       -- renders a single top-level comment + its replies
  CommentCard.tsx         -- renders a single comment (used by CommentThread)
```

### CommentSection.tsx

Client component (`'use client'`). Placed in the post page below the article body, above the prev/next navigation.

```
Props: { postSlug: string; postId: string }
```

**Behavior:**
- Fetches comments from `/api/the-web/{slug}/comments` on mount
- Nests replies under parents client-side (group by parent_id)
- Displays comment count header: "3 comments" or "join the discussion"
- Renders `CommentForm` for new top-level comments
- Renders list of `CommentThread` components
- Handles optimistic insert: when a comment is submitted, add it to the local state immediately, then reconcile with the server response

**State:**
```typescript
const [comments, setComments] = useState<BlogComment[]>([]);
const [loading, setLoading] = useState(true);
const [replyingTo, setReplyingTo] = useState<string | null>(null);  // comment ID being replied to
```

**Nesting logic:**
```typescript
function nestComments(flat: BlogComment[]): BlogComment[] {
  const topLevel: BlogComment[] = [];
  const replyMap = new Map<string, BlogComment[]>();

  for (const c of flat) {
    if (c.parent_id) {
      const replies = replyMap.get(c.parent_id) || [];
      replies.push(c);
      replyMap.set(c.parent_id, replies);
    } else {
      topLevel.push(c);
    }
  }

  return topLevel.map(c => ({
    ...c,
    replies: replyMap.get(c.id) || [],
  }));
}
```

### CommentForm.tsx

Client component.

```
Props: {
  postSlug: string;
  parentId?: string;           // set when replying
  parentAuthor?: string;       // "replying to {name}"
  onSubmit: (comment: BlogComment) => void;
  onCancel?: () => void;       // for reply forms
}
```

**Fields:**
- `author_name` (text input, required, placeholder: "your name")
- `author_email` (text input, optional, placeholder: "email (optional, not displayed)")
- `body` (textarea, required, min 10 chars, placeholder: "what are you thinking?")
- `honeypot` (hidden input, `tabindex="-1"`, `autocomplete="off"`, `aria-hidden="true"`, CSS `position: absolute; left: -9999px`)

**Behavior:**
- Character count indicator below textarea (shows "X / 5000" when over 100 chars, shows "minimum 10 characters" when under 10)
- Submit button disabled until name filled and body >= 10 chars
- On submit: POST to `/api/the-web/{slug}/comments`, call `onSubmit` with result
- Show inline error messages for validation failures and rate limiting
- Remember `author_name` and `author_email` in localStorage for repeat commenters
- Loading state on submit button: "posting..." with disabled state

**Styling:**
- Inputs: `bg-gray-800/50 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20`
- Submit button: `bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg px-4 py-2 text-sm`
- Reply form is slightly indented and has a "replying to {name}" label with a cancel button

### CommentThread.tsx

```
Props: {
  comment: BlogComment;         // top-level comment with replies[]
  onReply: (commentId: string, authorName: string) => void;
  replyingTo: string | null;
  postSlug: string;
  onCommentAdded: (comment: BlogComment) => void;
}
```

Renders the top-level `CommentCard`, then maps over `comment.replies` rendering indented `CommentCard`s. If `replyingTo` matches this comment's ID, shows a `CommentForm` after the comment.

### CommentCard.tsx

```
Props: {
  comment: BlogComment;
  isReply?: boolean;
  onReply?: (commentId: string, authorName: string) => void;
}
```

**Layout:**
```
[Avatar Circle]  Author Name  ·  time ago
Comment body text here spanning
multiple lines if needed.
                              [reply]
```

**Styling details:**
- Avatar: colored circle with first letter of author_name. Color derived from hash of author_name (deterministic). Size: 32px for top-level, 28px for replies.
- Author name: `text-sm font-medium text-gray-200`. If `is_admin`, show "Mike" with a small purple dot or "author" badge next to the name.
- Timestamp: relative time ("2 hours ago", "yesterday", "Mar 8"). Use a simple `timeAgo()` utility function.
- Body: `text-sm text-gray-300 leading-relaxed whitespace-pre-wrap` (preserve line breaks)
- Reply button: `text-xs text-gray-500 hover:text-purple-400 transition-colors`
- If `is_deleted`: show "this comment was removed" in italic gray-500, no reply button
- Replies are indented with `ml-10` (top-level) and have a subtle left border: `border-l border-gray-800`
- Framer Motion: `initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}`

### Integration into Post Page

Modify `src/app/the-web/[slug]/page.tsx`:

```tsx
// After the MarkdownRenderer, before the prev/next nav:

{/* Comments */}
<div className="mt-16 pt-8 border-t border-gray-800">
  <CommentSection postSlug={slug} postId={post.id} />
</div>
```

The `CommentSection` is a client component imported into the server-rendered post page. It fetches comments client-side on mount.

### Integration into Post Cards (comment count)

Modify the blog data layer to include `comment_count` in the preview query. Update `BlogPostPreview` type to include `comment_count: number`. Display on PostCard as "X comments" next to reading time.

---

## Anti-Spam Strategy

| Layer | Mechanism | Details |
|-------|-----------|---------|
| **Honeypot** | Hidden form field | If filled, silently accept (200) but don't store. Catches simple bots. |
| **Rate Limit** | IP-based, in-DB | Max 3 comments per 5 minutes per IP hash. Returns 429 with "slow down" message. |
| **Min Length** | Zod + DB constraint | Body must be >= 10 characters. Prevents drive-by low-effort spam. |
| **Max Length** | Zod + DB constraint | Body capped at 5000 characters. |
| **No Links (optional, Phase 2)** | Regex check | If a comment contains more than 2 URLs, flag or reject. Not in initial build. |
| **Admin Email** | Resend notification | Mike gets notified of every comment and can delete via curl from the email. |

---

## Admin Moderation

Mike moderates from two places:

1. **Email notifications:** Every comment triggers a Resend email with a direct `curl` delete command Mike can run from terminal or Claude Code.

2. **API:** `DELETE /api/the-web/comments/[id]` with `x-admin-key` header. Soft-deletes the comment.

No admin UI needed initially. If volume grows, build a `/admin/comments` page later.

### Admin Comments

When Mike wants to reply to a comment, he can either:
- Use the public form with his name (comments from "Mike" are just regular comments)
- Or POST via API with `x-admin-key` header, which sets `is_admin: true` and adds the author badge

The API route should check: if `x-admin-key` is present and valid, set `is_admin = true` on the comment. This lets Mike comment through the normal form or via API.

---

## File Summary

| File | Type | Description |
|------|------|-------------|
| `supabase/migrations/20260310_blog_comments.sql` | Migration | Comments table, indexes, triggers |
| `src/lib/comments.ts` | Data layer | Types, Supabase queries, IP hashing |
| `src/app/api/the-web/[slug]/comments/route.ts` | API | GET (public list) + POST (public create) |
| `src/app/api/the-web/comments/[id]/route.ts` | API | DELETE (admin moderation) |
| `src/app/the-web/components/CommentSection.tsx` | Component | Main wrapper, fetch + state |
| `src/app/the-web/components/CommentForm.tsx` | Component | Input form with validation |
| `src/app/the-web/components/CommentThread.tsx` | Component | Top-level comment + replies |
| `src/app/the-web/components/CommentCard.tsx` | Component | Single comment display |
| `src/app/the-web/[slug]/page.tsx` | Modified | Add CommentSection below article |
| `src/lib/blog.ts` | Modified | Add comment_count to preview type/query |

---

## Implementation Prompt

Copy this into a new Claude Code session in the `~/Downloads/Dev/mikedouz-portfolio/` directory:

```
Implement the blog comments system described in docs/plans/2026-03-10-the-web-comments.md.

Read the full spec first. Then implement task by task:

1. **Database migration** — Create supabase/migrations/20260310_blog_comments.sql with the exact SQL from the spec. NOTE: Remove the single_nesting CHECK constraint (it references other rows, which Postgres CHECK constraints can't reliably do under concurrency). Enforce nesting depth in the API layer only.

2. **Data layer** — Create src/lib/comments.ts with all types and query functions described in the spec. Follow the same patterns as src/lib/blog.ts (uses getSupabaseAdmin(), typed returns, error handling with console.error + throw).

3. **API routes** — Create both routes:
   - src/app/api/the-web/[slug]/comments/route.ts (GET + POST)
   - src/app/api/the-web/comments/[id]/route.ts (DELETE, admin only)
   Follow the exact same patterns as src/app/api/the-web/[slug]/route.ts for params handling, admin auth, error responses. Use Zod for POST validation. Include honeypot check, rate limit check, and Resend notification email on new comment.

4. **Components** — Create all four components in src/app/the-web/components/:
   - CommentSection.tsx (client component, fetches comments, manages state)
   - CommentForm.tsx (form with honeypot, localStorage for name/email, character count)
   - CommentThread.tsx (top-level comment + indented replies)
   - CommentCard.tsx (single comment with avatar, relative time, reply button)
   Match the existing blog aesthetic: gray-900 bg, gray-100 text, purple accents (#a78bfa / purple-400/500). Use Framer Motion for enter animations. Look at the existing components in src/app/the-web/components/ for style reference.

5. **Integration** — Modify src/app/the-web/[slug]/page.tsx to render CommentSection below the article body, above the prev/next nav. Modify src/lib/blog.ts to include comment_count in BlogPostPreview type and the preview query.

Important implementation details:
- The honeypot field must be visually hidden with CSS (position absolute, off-screen), not display:none (bots detect that)
- Rate limiting is checked in the database (count recent comments by ip_hash), not in-memory
- Comments are fetched client-side (CommentSection is a client component in a server-rendered page)
- Soft delete: is_deleted comments show "this comment was removed" placeholder, preserving thread structure
- Admin badge: if is_admin is true, show a small "author" label next to the name in purple
- localStorage keys: "the-web-comment-name" and "the-web-comment-email"
- Resend email: use the existing env.resendApiKey. From address: "the-web@mikeveson.com". To: env.inboxRecipientEmail. Non-blocking (fire and forget with .catch()).

After implementing, run the dev server and verify the build compiles without errors. Do NOT run the Supabase migration (Mike will do that manually).
```

---

## Future Enhancements (Not in Initial Build)

- **Email subscriptions:** Let commenters opt in to email replies on their comment
- **Markdown in comments:** Allow basic markdown (bold, italic, links) with sanitization
- **Admin UI:** `/admin/comments` page with bulk moderation
- **Reaction emoji:** Simple thumbs up / thinking face reactions on comments
- **Anti-spam escalation:** If spam volume grows, add Turnstile (Cloudflare) challenge on comment submit
