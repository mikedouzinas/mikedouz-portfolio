# The Web — Newsletter Subscription System

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add subscription to "The Web" blog via **email OR SMS/text**. Readers subscribe with a single smart input that auto-detects email vs phone number. Double opt-in for both channels. Notifications sent via the subscriber's chosen channel whenever a new post is published. The UI is dead simple and matches the dark/purple blog aesthetic.

**Architecture:** Subscribers stored in Supabase with both `email` and `phone` fields (both nullable, at least one required). Three new API routes handle subscribe, confirm, and unsubscribe. The existing `POST /api/the-web` publish endpoint is extended to trigger notifications to all confirmed subscribers via Resend (email) and Twilio (SMS). A `SubscribeWidget` component renders on the blog stream page with a single smart input field.

**Tech Stack (existing):** Next.js 15 App Router, Supabase PostgreSQL (admin client via service role key), Tailwind CSS, Framer Motion, Zod 4, Resend SDK (`resend` v6.3), `react-markdown`

**New dependency:** `twilio` (for SMS notifications)

**New env vars needed:**
- `TWILIO_ACCOUNT_SID` — Twilio account SID
- `TWILIO_AUTH_TOKEN` — Twilio auth token
- `TWILIO_PHONE_NUMBER` — Twilio phone number to send from (e.g. +1234567890)

**Key existing files to understand before starting:**
- `src/lib/env.ts` — env var loader (already has `RESEND_API_KEY`, `ADMIN_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
- `src/lib/supabaseAdmin.ts` — singleton Supabase admin client (service role, bypasses RLS)
- `src/lib/blog.ts` — blog data layer (types, CRUD functions)
- `src/app/api/the-web/route.ts` — GET (list posts) and POST (create post, admin-authenticated)
- `src/app/the-web/page.tsx` — blog stream page (client component)
- `src/app/api/inbox/route.ts` — reference for Resend usage pattern (sender: `inbox@iris.mikeveson.com`)

**Base URL:** `https://mikeveson.com`
**Sender email:** `theweb@iris.mikeveson.com` (uses the already-configured `iris.mikeveson.com` Resend domain)

---

### Task 1: Supabase Migration — Subscribers Table

**Files:**
- Create: `supabase/migrations/20260310_blog_subscribers.sql`

**Step 1: Write the migration SQL**

```sql
-- Blog newsletter subscribers (supports email, SMS, or both)
CREATE TABLE IF NOT EXISTS blog_subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT,                    -- nullable: subscriber might use phone only
  phone TEXT,                    -- nullable: subscriber might use email only, E.164 format (+1234567890)
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),  -- which channel this subscription is for
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'unsubscribed')),
  confirmation_token UUID DEFAULT gen_random_uuid(),
  confirmation_code TEXT,        -- 6-digit code for SMS confirmation
  unsubscribe_token UUID DEFAULT gen_random_uuid(),
  confirmed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- At least one contact method required
  CONSTRAINT email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL),
  -- Unique per channel: same person can subscribe via both email and SMS
  CONSTRAINT unique_email_sub UNIQUE (email, channel),
  CONSTRAINT unique_phone_sub UNIQUE (phone, channel)
);

-- Indexes
CREATE INDEX idx_blog_subscribers_status ON blog_subscribers(status);
CREATE INDEX idx_blog_subscribers_email ON blog_subscribers(email);
CREATE INDEX idx_blog_subscribers_phone ON blog_subscribers(phone);
CREATE INDEX idx_blog_subscribers_confirmation_token ON blog_subscribers(confirmation_token);
CREATE INDEX idx_blog_subscribers_unsubscribe_token ON blog_subscribers(unsubscribe_token);

-- Auto-update updated_at
CREATE TRIGGER trigger_blog_subscribers_updated_at
  BEFORE UPDATE ON blog_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION update_blog_posts_updated_at();
  -- Reuses the existing trigger function from the blog_posts migration
```

**Note on SMS confirmation:** Email subscribers confirm via a link in their email. SMS subscribers confirm by receiving a 6-digit code via text and entering it on the blog page (or replying with the code). The `confirmation_code` field stores this code.

**Step 2: Run the migration against Supabase**

Run this SQL in the Supabase SQL editor (or via `supabase db push` if the CLI is configured). The project uses the admin client directly, so RLS policies are not needed for this table.

---

### Task 2: Subscriber Data Layer

**Files:**
- Create: `src/lib/subscribers.ts`

This module provides typed functions for subscriber CRUD operations, following the same pattern as `src/lib/blog.ts`.

```typescript
/**
 * Subscriber data layer for "The Web" newsletter
 * Uses admin client (service role key) to bypass RLS.
 * Only use in API routes and server actions.
 */

import { getSupabaseAdmin } from './supabaseAdmin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Subscriber {
  id: string;
  email: string;
  status: 'pending' | 'confirmed' | 'unsubscribed';
  confirmation_token: string;
  unsubscribe_token: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/**
 * Create or re-activate a subscriber.
 * - New email: insert with status=pending
 * - Existing pending: return existing (resend confirmation)
 * - Existing confirmed: return as-is (already subscribed)
 * - Existing unsubscribed: reset to pending with new confirmation token
 */
export async function upsertSubscriber(email: string): Promise<{
  subscriber: Subscriber;
  action: 'created' | 'already_pending' | 'already_confirmed' | 'resubscribed';
}> {
  const supabase = getSupabaseAdmin();
  const normalized = email.toLowerCase().trim();

  // Check if subscriber already exists
  const { data: existing } = await supabase
    .from('blog_subscribers')
    .select('*')
    .eq('email', normalized)
    .single();

  if (existing) {
    if (existing.status === 'confirmed') {
      return { subscriber: existing as Subscriber, action: 'already_confirmed' };
    }
    if (existing.status === 'pending') {
      return { subscriber: existing as Subscriber, action: 'already_pending' };
    }
    // Unsubscribed: reactivate
    const { data: updated, error } = await supabase
      .from('blog_subscribers')
      .update({
        status: 'pending',
        confirmation_token: crypto.randomUUID(),
        unsubscribed_at: null,
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to reactivate subscriber: ${error.message}`);
    return { subscriber: updated as Subscriber, action: 'resubscribed' };
  }

  // New subscriber
  const { data: created, error } = await supabase
    .from('blog_subscribers')
    .insert({ email: normalized })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create subscriber: ${error.message}`);
  return { subscriber: created as Subscriber, action: 'created' };
}

/**
 * Confirm a subscriber by their confirmation token.
 * Returns null if token not found or already used.
 */
export async function confirmSubscriber(token: string): Promise<Subscriber | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('blog_subscribers')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('confirmation_token', token)
    .eq('status', 'pending')
    .select('*')
    .single();

  if (error) return null;
  return data as Subscriber;
}

/**
 * Unsubscribe by unsubscribe token.
 * Returns null if token not found.
 */
export async function unsubscribeByToken(token: string): Promise<Subscriber | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('blog_subscribers')
    .update({
      status: 'unsubscribed',
      unsubscribed_at: new Date().toISOString(),
    })
    .eq('unsubscribe_token', token)
    .in('status', ['pending', 'confirmed'])
    .select('*')
    .single();

  if (error) return null;
  return data as Subscriber;
}

/**
 * Get all confirmed subscribers. Used when sending notifications.
 */
export async function getConfirmedSubscribers(): Promise<
  Pick<Subscriber, 'email' | 'unsubscribe_token'>[]
> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('blog_subscribers')
    .select('email, unsubscribe_token')
    .eq('status', 'confirmed');

  if (error) throw new Error(`Failed to fetch confirmed subscribers: ${error.message}`);
  return data || [];
}
```

---

### Task 3: Email Templates

**Files:**
- Create: `src/lib/emailTemplates.ts`

Two email templates, both minimal and matching the blog aesthetic (dark bg, light text, purple accents). Emails should look good in all clients, so use inline styles with a simple table layout. Keep it very clean.

```typescript
/**
 * Email templates for "The Web" newsletter
 * Inline styles for email client compatibility
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://mikeveson.com';

/**
 * Confirmation email (double opt-in)
 */
export function confirmationEmail(confirmationToken: string): {
  subject: string;
  html: string;
} {
  const confirmUrl = `${BASE_URL}/api/the-web/subscribe/confirm?token=${confirmationToken}`;

  return {
    subject: 'confirm your subscription to the web',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111827;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <tr>
            <td style="padding-bottom:24px;">
              <span style="color:#9CA3AF;font-size:13px;text-transform:lowercase;letter-spacing:0.05em;">the web</span>
            </td>
          </tr>
          <tr>
            <td style="color:#F3F4F6;font-size:18px;font-weight:600;padding-bottom:16px;">
              confirm your subscription
            </td>
          </tr>
          <tr>
            <td style="color:#9CA3AF;font-size:14px;line-height:1.6;padding-bottom:28px;">
              someone (hopefully you) subscribed to the web, my blog about research, philosophy, and thinking. click below to confirm and you'll get an email whenever i publish something new.
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:28px;">
              <a href="${confirmUrl}" style="display:inline-block;background-color:#7C3AED;color:#F3F4F6;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:500;">confirm subscription</a>
            </td>
          </tr>
          <tr>
            <td style="color:#6B7280;font-size:12px;line-height:1.5;">
              if you didn't request this, just ignore this email. no action needed.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}

/**
 * New post notification email
 */
export function newPostEmail(post: {
  title: string;
  subtitle: string | null;
  slug: string;
  preview: string;
  reading_time: number;
  tags: string[];
}, unsubscribeToken: string): {
  subject: string;
  html: string;
} {
  const postUrl = `${BASE_URL}/the-web/${post.slug}`;
  const unsubscribeUrl = `${BASE_URL}/api/the-web/subscribe/unsubscribe?token=${unsubscribeToken}`;
  const tagsHtml = post.tags.length > 0
    ? post.tags.map(t => `<span style="display:inline-block;padding:2px 8px;background-color:rgba(139,92,246,0.15);color:#A78BFA;border-radius:12px;font-size:11px;margin-right:4px;">${t}</span>`).join(' ')
    : '';

  return {
    subject: `new on the web: ${post.title}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111827;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <tr>
            <td style="padding-bottom:24px;">
              <span style="color:#9CA3AF;font-size:13px;text-transform:lowercase;letter-spacing:0.05em;">the web</span>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:8px;">
              <a href="${postUrl}" style="color:#F3F4F6;font-size:20px;font-weight:600;text-decoration:none;">${post.title}</a>
            </td>
          </tr>
          ${post.subtitle ? `<tr><td style="color:#9CA3AF;font-size:14px;padding-bottom:12px;">${post.subtitle}</td></tr>` : ''}
          <tr>
            <td style="color:#6B7280;font-size:12px;padding-bottom:16px;">
              ${post.reading_time} min read${tagsHtml ? ' &middot; ' + tagsHtml : ''}
            </td>
          </tr>
          <tr>
            <td style="color:#D1D5DB;font-size:14px;line-height:1.6;padding-bottom:24px;">
              ${post.preview}
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:32px;">
              <a href="${postUrl}" style="display:inline-block;background-color:#7C3AED;color:#F3F4F6;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:500;">read the full post</a>
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid #374151;padding-top:16px;">
              <span style="color:#6B7280;font-size:11px;">
                you're receiving this because you subscribed to the web.
                <a href="${unsubscribeUrl}" style="color:#6B7280;text-decoration:underline;">unsubscribe</a>
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}
```

---

### Task 4: API Route — Subscribe

**Files:**
- Create: `src/app/api/the-web/subscribe/route.ts`

Handles `POST` requests with `{ contact: string }`. The API auto-detects whether the input is an email or phone number.

**Smart detection logic:**
- If it contains `@` → treat as email
- If it matches phone pattern (digits, optional +, dashes, parens, spaces, 10+ digits after stripping) → treat as phone
- Normalize phone to E.164 format (e.g. `(617) 555-1234` → `+16175551234`)

For email: send confirmation email via Resend.
For SMS: generate a 6-digit code, store it, send via Twilio.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { env } from '@/lib/env';
import { upsertSubscriber } from '@/lib/subscribers';
import { confirmationEmail } from '@/lib/emailTemplates';

export const runtime = 'nodejs';

const SubscribeSchema = z.object({
  contact: z.string().min(1).max(320),  // email or phone number
});

let resendClient: Resend | null = null;
function getResend(): Resend {
  if (!resendClient) resendClient = new Resend(env.resendApiKey);
  return resendClient;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = SubscribeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const { subscriber, action } = await upsertSubscriber(validation.data.email);

    if (action === 'already_confirmed') {
      return NextResponse.json({ message: 'already subscribed' });
    }

    // Send (or resend) confirmation email for pending/resubscribed
    const template = confirmationEmail(subscriber.confirmation_token);
    await getResend().emails.send({
      from: 'The Web <theweb@iris.mikeveson.com>',
      to: subscriber.email,
      subject: template.subject,
      html: template.html,
    });

    return NextResponse.json({ message: 'confirmation email sent' }, { status: 201 });
  } catch (error) {
    console.error('[Subscribe] Error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Try again later.' },
      { status: 500 }
    );
  }
}
```

---

### Task 5: API Route — Confirm

**Files:**
- Create: `src/app/api/the-web/subscribe/confirm/route.ts`

Handles `GET` requests with `?token=UUID`. Confirms the subscriber and redirects to a thank-you page.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { confirmSubscriber } from '@/lib/subscribers';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/the-web?subscribe=invalid', req.url));
  }

  const subscriber = await confirmSubscriber(token);

  if (!subscriber) {
    return NextResponse.redirect(new URL('/the-web?subscribe=invalid', req.url));
  }

  return NextResponse.redirect(new URL('/the-web?subscribe=confirmed', req.url));
}
```

---

### Task 6: API Route — Unsubscribe

**Files:**
- Create: `src/app/api/the-web/subscribe/unsubscribe/route.ts`

Handles `GET` requests with `?token=UUID`. Unsubscribes and redirects to the blog with a farewell message.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { unsubscribeByToken } from '@/lib/subscribers';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/the-web?subscribe=error', req.url));
  }

  const subscriber = await unsubscribeByToken(token);

  // Redirect regardless (even if token invalid, don't leak info)
  return NextResponse.redirect(new URL('/the-web?subscribe=removed', req.url));
}
```

---

### Task 7: Notification Sender Utility

**Files:**
- Create: `src/lib/notifySubscribers.ts`

A function that fetches all confirmed subscribers, sends notifications via the appropriate channel (Resend for email, Twilio for SMS). Called from the publish endpoint.

**SMS notification format:** Keep it short and punchy. Example:
```
new on the web: "Post Title"
mikeveson.com/the-web/post-slug

reply STOP to unsubscribe
```

```typescript
/**
 * Send new-post notification to all confirmed subscribers.
 * Uses Resend batch sending for efficiency.
 */

import { Resend } from 'resend';
import { env } from './env';
import { getConfirmedSubscribers } from './subscribers';
import { newPostEmail } from './emailTemplates';
import { generatePreview } from './blog';

let resendClient: Resend | null = null;
function getResend(): Resend {
  if (!resendClient) resendClient = new Resend(env.resendApiKey);
  return resendClient;
}

export async function notifySubscribers(post: {
  title: string;
  subtitle: string | null;
  slug: string;
  body: string;
  reading_time: number;
  tags: string[];
}): Promise<{ sent: number; errors: number }> {
  const subscribers = await getConfirmedSubscribers();

  if (subscribers.length === 0) {
    console.log('[Notify] No confirmed subscribers, skipping');
    return { sent: 0, errors: 0 };
  }

  const preview = generatePreview(post.body);
  const resend = getResend();

  let sent = 0;
  let errors = 0;

  // Resend batch API supports up to 100 emails per call.
  // Send in batches of 100.
  const BATCH_SIZE = 100;
  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);

    const emails = batch.map((sub) => {
      const template = newPostEmail(
        { ...post, preview },
        sub.unsubscribe_token
      );
      return {
        from: 'The Web <theweb@iris.mikeveson.com>',
        to: sub.email,
        subject: template.subject,
        html: template.html,
      };
    });

    try {
      await resend.batch.send(emails);
      sent += batch.length;
    } catch (err) {
      console.error(`[Notify] Batch send error (batch starting at ${i}):`, err);
      errors += batch.length;
    }
  }

  console.log(`[Notify] Sent ${sent} notifications, ${errors} errors`);
  return { sent, errors };
}
```

---

### Task 8: Integrate Notifications into Publish Endpoint

**Files:**
- Modify: `src/app/api/the-web/route.ts`

After a post is created with `status: 'published'`, fire off subscriber notifications. The notification is non-blocking (uses `waitUntil` pattern or fire-and-forget) so the publish API returns immediately.

**Changes to the POST handler:**

1. Import `notifySubscribers` from `@/lib/notifySubscribers`
2. After `const post = await createBlogPost(validation.data);` and before the return, add:

```typescript
// Send subscriber notifications (non-blocking)
if (post.status === 'published') {
  // Fire and forget - don't block the publish response
  notifySubscribers({
    title: post.title,
    subtitle: post.subtitle,
    slug: post.slug,
    body: post.body,
    reading_time: post.reading_time,
    tags: post.tags,
  }).catch((err) => console.error('[Blog] Failed to notify subscribers:', err));
}
```

**Important:** Do NOT await the `notifySubscribers` call. It should not block the API response. The `.catch()` ensures unhandled rejections are logged.

Also add notification to the PUT handler in `src/app/api/the-web/[slug]/route.ts` when a post's status changes from draft to published. Check the update payload for `status: 'published'` and the existing post was a draft.

---

### Task 9: Subscribe Widget Component

**Files:**
- Create: `src/app/the-web/components/SubscribeWidget.tsx`

A minimal, inline subscribe form that sits below the post list on the blog stream page. Not a popup, not a modal, not a banner. Just a quiet section at the bottom. **Dead simple UX: one field, one button.**

**Design spec:**
- Sits after the post list, separated by a subtle top border (`border-gray-800`)
- Small heading: "get notified" in gray-400, lowercase
- One-line description: "email or phone. that's it." in gray-500
- **Single smart input** + button row. The input accepts either email or phone number. Placeholder: `"email or phone number"`
- The input type should be `text` (not `email`) since it accepts both
- Input: `bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500`
- Button: `bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg px-4`
- States: idle, submitting, success-email ("check your email"), success-sms ("check your texts"), confirming-sms (show code input), error, already subscribed
- **SMS confirmation flow**: After submitting a phone number, show a 6-digit code input field. User enters the code they received via text.
- Framer Motion fade-in, same as the rest of the page
- Fully responsive

```tsx
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type WidgetState = "idle" | "submitting" | "success" | "already" | "error";

export default function SubscribeWidget() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<WidgetState>("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setState("submitting");
    try {
      const res = await fetch("/api/the-web/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setState("error");
        return;
      }

      if (data.message === "already subscribed") {
        setState("already");
      } else {
        setState("success");
      }
    } catch {
      setState("error");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4, duration: 0.4 }}
      className="mt-16 pt-8 border-t border-gray-800"
    >
      <h3 className="text-sm font-medium text-gray-400 lowercase mb-1">
        get notified
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        new post notifications. no spam, no tracking, unsubscribe anytime.
      </p>

      <AnimatePresence mode="wait">
        {state === "success" ? (
          <motion.p
            key="success"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-purple-400"
          >
            check your email to confirm.
          </motion.p>
        ) : state === "already" ? (
          <motion.p
            key="already"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-gray-400"
          >
            you're already subscribed.
          </motion.p>
        ) : (
          <motion.form
            key="form"
            onSubmit={handleSubmit}
            className="flex gap-2"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (state === "error") setState("idle");
              }}
              placeholder="your@email.com"
              required
              className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-colors"
            />
            <button
              type="submit"
              disabled={state === "submitting"}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              {state === "submitting" ? "..." : "subscribe"}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {state === "error" && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-red-400 mt-2"
        >
          something went wrong. try again.
        </motion.p>
      )}
    </motion.div>
  );
}
```

---

### Task 10: Add Subscribe Widget to Blog Page + Toast Notifications

**Files:**
- Modify: `src/app/the-web/page.tsx`

**Changes:**

1. Import `SubscribeWidget`:
   ```tsx
   import SubscribeWidget from "./components/SubscribeWidget";
   ```

2. Add the widget after the posts list `</div>` (the `<div className="space-y-4">` block), before the closing container div:
   ```tsx
   <SubscribeWidget />
   ```

3. Add query parameter handling for confirmation/unsubscribe toasts. Read `searchParams` from the URL and show a brief toast message:
   - `?subscribe=confirmed` → Show a temporary green toast: "you're in. you'll hear from me when i publish."
   - `?subscribe=removed` → Show a temporary gray toast: "unsubscribed. no hard feelings."
   - `?subscribe=invalid` → Show a temporary red toast: "that link didn't work. try subscribing again."

   Implement the toast as a simple `AnimatePresence` component at the top of the page that auto-dismisses after 5 seconds. Remove the query param from the URL after showing (using `window.history.replaceState`).

**Toast component approach:** Create an inline toast within `page.tsx` (no new file needed). Use a `useEffect` to read the search param, set toast state, then clear after 5s.

```tsx
// Inside BlogPage component:
const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const subscribeStatus = params.get('subscribe');
  if (subscribeStatus === 'confirmed') {
    setToast({ message: "you're in. you'll hear from me when i publish.", type: 'success' });
  } else if (subscribeStatus === 'removed') {
    setToast({ message: "unsubscribed. no hard feelings.", type: 'info' });
  } else if (subscribeStatus === 'invalid') {
    setToast({ message: "that link didn't work. try subscribing again.", type: 'error' });
  }
  if (subscribeStatus) {
    window.history.replaceState({}, '', '/the-web');
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }
}, []);
```

Toast render (inside the JSX, at the top of the page container):
```tsx
<AnimatePresence>
  {toast && (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm ${
        toast.type === 'success' ? 'bg-green-900/80 text-green-300 border border-green-700/50' :
        toast.type === 'error' ? 'bg-red-900/80 text-red-300 border border-red-700/50' :
        'bg-gray-800/80 text-gray-300 border border-gray-700/50'
      } backdrop-blur-sm`}
    >
      {toast.message}
    </motion.div>
  )}
</AnimatePresence>
```

---

### Task 11: Add `NEXT_PUBLIC_BASE_URL` to Environment

**Files:**
- Modify: `.env.local` (or wherever env vars are configured for deployment)

Add:
```
NEXT_PUBLIC_BASE_URL=https://mikeveson.com
```

This is used by the email templates to generate correct links. If not set, it defaults to `https://mikeveson.com`.

Also add it to any Vercel/deployment environment configuration.

---

## File Summary

| Action | Path |
|--------|------|
| Create | `supabase/migrations/20260310_blog_subscribers.sql` |
| Create | `src/lib/subscribers.ts` |
| Create | `src/lib/emailTemplates.ts` |
| Create | `src/lib/notifySubscribers.ts` |
| Create | `src/app/api/the-web/subscribe/route.ts` |
| Create | `src/app/api/the-web/subscribe/confirm/route.ts` |
| Create | `src/app/api/the-web/subscribe/unsubscribe/route.ts` |
| Create | `src/app/the-web/components/SubscribeWidget.tsx` |
| Modify | `src/app/api/the-web/route.ts` (add notification trigger to POST) |
| Modify | `src/app/api/the-web/[slug]/route.ts` (add notification trigger to PUT when draft->published) |
| Modify | `src/app/the-web/page.tsx` (add SubscribeWidget + toast notifications) |
| Modify | `.env.local` (add `NEXT_PUBLIC_BASE_URL`) |

---

## Implementation Prompt

Copy and paste this into a new Claude Code session in the `~/Downloads/Dev/mikedouz-portfolio/` directory:

```
Read the implementation spec at docs/plans/2026-03-10-the-web-subscribe.md and implement all tasks in order. The spec contains file paths, code patterns, and modification instructions. Some code snippets are from the original email-only version and need to be ADAPTED for the dual-channel (email + SMS) system described in the spec header and schema.

Key context:
- This adds email AND SMS subscription to "the web" blog at mikeveson.com/the-web
- **Smart input**: Single field auto-detects email vs phone number. No dropdown, no toggle. Just type and subscribe.
- **Email flow**: Double opt-in via confirmation email (Resend)
- **SMS flow**: 6-digit confirmation code sent via Twilio, user enters code on the page
- **Phone normalization**: Accept any format ((617) 555-1234, 617-555-1234, +1 617 555 1234), normalize to E.164 (+16175551234)
- Install twilio: `npm install twilio`
- Uses existing Supabase admin client (src/lib/supabaseAdmin.ts) and Resend (already in package.json)
- The Supabase migration SQL should be created as a file AND run manually in the Supabase SQL editor
- Follow existing code patterns in src/lib/blog.ts for the data layer
- All UI text should be lowercase to match the blog aesthetic
- The subscribe widget UX should be DEAD SIMPLE. One input, one button. That's it.
- After implementing, run `npm run build` to verify no TypeScript errors
- The code snippets for Tasks 2-9 show the original email-only patterns. You MUST adapt them to support the dual-channel schema (email nullable, phone nullable, channel field, confirmation_code for SMS, Twilio integration for SMS sends).

Implement each task, verify the build passes, and report what was done.
```

---

## Security Notes

- **No PII leakage:** Confirmation and unsubscribe endpoints redirect regardless of whether the token is valid. No information about subscriber existence is leaked.
- **Email normalization:** All emails are lowercased and trimmed before storage.
- **Rate limiting:** Consider adding rate limiting to the subscribe endpoint in a follow-up (the existing `rateLimit.ts` utility can be reused from the inbox system).
- **Tokens:** Both `confirmation_token` and `unsubscribe_token` are UUIDs, generated server-side by Postgres. They are not guessable.
- **No tracking pixels:** Emails contain no tracking. Just content and an unsubscribe link.

## Future Enhancements (Not in This Spec)

- Rate limiting on subscribe endpoint (reuse `src/lib/rateLimit.ts`)
- Admin dashboard to see subscriber count and channel breakdown
- Subscriber count displayed on the blog (e.g., "join 47 others")
- Welcome email/text after confirmation
- Per-tag subscription preferences
- Twilio webhook to handle STOP replies for automatic unsubscribe
- Subscribe via both channels (same person, email + phone)
