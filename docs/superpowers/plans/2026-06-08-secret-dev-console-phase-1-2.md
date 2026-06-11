# Secret Dev Console — Phases 1–2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a hidden, server-secured dev console on mikeveson.com with an animated portal login (Phase 1) and a cross-repo GitHub Issues board with priority labels + "Copy for Claude Code" export (Phase 2).

**Architecture:** A `src/middleware.ts` edge guard enforces a signed session cookie on `/dev/*` and `/api/dev/*` (404 for pages, 401 for APIs when absent). Login: password → `POST /api/dev/auth` (Node runtime) verifies a scrypt hash, rate-limits via Redis, and sets an `httpOnly` session cookie carrying a `jose` HS256 JWT with a 2h absolute expiry + 30m idle window. The board reads/writes GitHub Issues across an allow-listed set of repos via the existing `GITHUB_TOKEN`. Priority is a `p1`–`p5` label. Export builds a clipboard prompt client-side.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript (strict), `jose` (edge JWT), `node:crypto` scrypt (password hash, Node runtime only), `@upstash/redis` (rate limit), `framer-motion` (portal animation), `zod` (API boundaries). No unit-test framework exists — verification uses `tsx` assertion scripts (matching repo convention) plus `curl`/browser checks with exact expected output.

**Critical constraint — edge vs node split:** `middleware.ts` runs on the Edge runtime and CANNOT import `node:crypto`. Therefore session JWT logic (`src/lib/dev/session.ts`, uses `jose`) is kept SEPARATE from password hashing (`src/lib/dev/password.ts`, uses `node:crypto`). Middleware imports only `session.ts`. The auth route (Node runtime) imports both.

---

## File Structure

**Phase 1 (auth + portal)**
- Create `src/lib/dev/session.ts` — sign/verify session JWT (jose, isomorphic). Cookie name + options.
- Create `src/lib/dev/password.ts` — scrypt hash/verify (node:crypto, Node runtime only).
- Create `src/lib/dev/rateLimit.ts` — Redis fixed-window limiter for the auth endpoint.
- Create `src/app/api/dev/auth/route.ts` — `POST` login, `DELETE` logout (Node runtime).
- Create `src/middleware.ts` — edge guard for `/dev/*` and `/api/dev/*`.
- Create `src/components/dev/DevPortal.tsx` — hover (desktop) / long-press (touch) portal + password field.
- Create `src/app/dev/page.tsx` — authed console shell + logout (extended in Phase 2).
- Create `scripts/test_dev_console.ts` — tsx assertion test for session + password.
- Create `scripts/gen_dev_password.ts` — one-off hash generator.
- Modify `src/app/layout.tsx` — mount `<DevPortal />`.
- Modify `src/lib/env.ts` — surface `devConsolePasswordHash`, `devSessionSecret`.
- Modify `package.json` — add `jose` dep + `test:dev` script.

**Phase 2 (board + export)**
- Create `supabase/migrations/20260608000001_dev_hidden_repos.sql` — persisted repo-hide list.
- Create `src/lib/dev/hidden.ts` — read/add/remove hidden repo slugs (Supabase service-role).
- Create `src/lib/dev/github.ts` — discover repos; list/create/update issues; ensure colored `p1`–`p5` + `status:` labels; deterministic accent.
- Create `src/app/api/dev/repos/route.ts` — `GET` discovered (minus hidden) + hidden list; `POST` hide; `DELETE` unhide (Node runtime).
- Create `src/app/api/dev/issues/route.ts` — `GET`/`POST`/`PATCH` issues incl. priority + status (Node runtime).
- Create `src/components/dev/RepoPicker.tsx` — repo filter chips + hide/unhide management.
- Create `src/components/dev/CreateIssueForm.tsx` — file a new item (repo / priority / status).
- Create `src/components/dev/IssueList.tsx` — cross-repo list; priority + status change; close (= Done); export.
- Create `src/components/dev/CopyForClaude.tsx` — clipboard export.
- Modify `src/app/dev/page.tsx` — render the board with the repo picker.

---

# PHASE 1 — Secure auth + portal

### Task 1: Add `jose`, env wiring, and the password-hash generator

**Files:**
- Modify: `package.json`
- Modify: `src/lib/env.ts`
- Create: `scripts/gen_dev_password.ts`

- [ ] **Step 1: Install jose**

Run:
```bash
npm install jose
```
Expected: `jose` appears under `dependencies` in `package.json`, install succeeds.

- [ ] **Step 2: Add the `test:dev` script**

In `package.json`, inside `"scripts"`, add this line after the `"test:iris:automated"` entry:
```json
    "test:dev": "tsx scripts/test_dev_console.ts",
```

- [ ] **Step 3: Surface the two new env vars in `src/lib/env.ts`**

In `src/lib/env.ts`, inside the exported `env` object (after the `elevenLabsVoiceId` line, before the closing `} as const;`), add:
```ts
  // Secret dev console
  devConsolePasswordHash: process.env.DEV_CONSOLE_PASSWORD_HASH || '',
  devSessionSecret: process.env.DEV_SESSION_SECRET || '',
```
(Do NOT add these to `requiredEnvVars` — that would log a warning on environments that don't need the console.)

- [ ] **Step 4: Create the hash generator script**

Create `scripts/gen_dev_password.ts`:
```ts
/**
 * One-off: generate a scrypt hash for the dev console password.
 * Usage: npx tsx scripts/gen_dev_password.ts '<your password>'
 * Put the printed value in DEV_CONSOLE_PASSWORD_HASH (Vercel env + .env.local).
 */
import { hashPassword } from '../src/lib/dev/password';

const pw = process.argv[2];
if (!pw) {
  console.error("usage: npx tsx scripts/gen_dev_password.ts '<password>'");
  process.exit(1);
}
console.log(hashPassword(pw));
```
(This imports `password.ts`, created in Task 3 — that's fine; we don't run it until then.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/env.ts scripts/gen_dev_password.ts
git commit -m "feat(dev-console): add jose dep, env vars, password-hash generator"
```

---

### Task 2: Session JWT helpers (`session.ts`) — edge-safe

**Files:**
- Create: `src/lib/dev/session.ts`
- Create: `scripts/test_dev_console.ts`

- [ ] **Step 1: Write the failing test (session portion)**

Create `scripts/test_dev_console.ts`:
```ts
import assert from 'node:assert';

// Must be set before importing the session module.
process.env.DEV_SESSION_SECRET = 'test-secret-please-change-0123456789';

import { signSession, verifySession } from '../src/lib/dev/session';

async function main() {
  const now = 1_700_000_000_000; // fixed clock (ms)

  const tok = await signSession(now);

  const fresh = await verifySession(tok, now + 1000);
  assert.equal(fresh.valid, true, 'fresh session is valid');
  assert.ok(fresh.refreshed, 'fresh session returns a refreshed token');

  const idle = await verifySession(tok, now + 31 * 60 * 1000);
  assert.equal(idle.valid, false, 'session past 30m idle is rejected');

  const expired = await verifySession(tok, now + 3 * 60 * 60 * 1000);
  assert.equal(expired.valid, false, 'session past 2h absolute expiry is rejected');

  const tampered = await verifySession(tok.slice(0, -2) + 'xx', now + 1000);
  assert.equal(tampered.valid, false, 'tampered token is rejected');

  console.log('✓ dev console auth tests passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npx tsx scripts/test_dev_console.ts
```
Expected: FAIL — cannot resolve `../src/lib/dev/session` (module not yet created).

- [ ] **Step 3: Implement `session.ts`**

Create `src/lib/dev/session.ts`:
```ts
/**
 * Dev-console session token (edge-safe).
 *
 * Uses `jose` so it runs in BOTH the Node auth route and the Edge middleware.
 * MUST NOT import node:crypto or anything Node-only — middleware runs on edge.
 *
 * Security model:
 *  - HS256 JWT signed with DEV_SESSION_SECRET.
 *  - exp = 2h absolute cap (never extended).
 *  - lastSeen claim = idle anchor; rejected after 30m of inactivity.
 *  - verifySession returns a `refreshed` token (new lastSeen, same exp) on success.
 */
import { SignJWT, jwtVerify } from 'jose';

export const DEV_SESSION_COOKIE = 'dev_session';

const ABSOLUTE_TTL_S = 2 * 60 * 60; // 2 hours
const IDLE_TTL_S = 30 * 60; // 30 minutes

/** Session cookie options. `secure` only in prod so localhost http works. */
export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  // No maxAge → browser session cookie (cleared on browser close).
};

function secretKey(): Uint8Array {
  const s = process.env.DEV_SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('DEV_SESSION_SECRET not configured (min 16 chars)');
  }
  return new TextEncoder().encode(s);
}

/** Mint a new session token. `nowMs` injectable for tests. */
export async function signSession(nowMs: number): Promise<string> {
  const iat = Math.floor(nowMs / 1000);
  return new SignJWT({ lastSeen: iat })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(iat)
    .setExpirationTime(iat + ABSOLUTE_TTL_S)
    .sign(secretKey());
}

export interface VerifyResult {
  valid: boolean;
  /** New token with refreshed lastSeen (same exp). Present only when valid. */
  refreshed?: string;
}

/** Verify a token against absolute exp + idle window. `nowMs` injectable. */
export async function verifySession(token: string, nowMs: number): Promise<VerifyResult> {
  try {
    const { payload } = await jwtVerify(token, secretKey()); // throws on bad sig / past exp
    const nowS = Math.floor(nowMs / 1000);
    const lastSeen = typeof payload.lastSeen === 'number' ? payload.lastSeen : 0;
    if (nowS - lastSeen > IDLE_TTL_S) {
      return { valid: false };
    }
    const exp = typeof payload.exp === 'number' ? payload.exp : nowS;
    const refreshed = await new SignJWT({ lastSeen: nowS })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(nowS)
      .setExpirationTime(exp) // keep the original absolute cap
      .sign(secretKey());
    return { valid: true, refreshed };
  } catch {
    return { valid: false };
  }
}
```

- [ ] **Step 4: Run the test — session assertions should now pass**

Run:
```bash
npx tsx scripts/test_dev_console.ts
```
Expected: PASS — prints `✓ dev console auth tests passed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dev/session.ts scripts/test_dev_console.ts
git commit -m "feat(dev-console): edge-safe session JWT (jose) with idle + absolute expiry"
```

---

### Task 3: Password hashing (`password.ts`) — Node only

**Files:**
- Create: `src/lib/dev/password.ts`
- Modify: `scripts/test_dev_console.ts`

- [ ] **Step 1: Add the failing password assertions**

In `scripts/test_dev_console.ts`, add this import after the existing `session` import:
```ts
import { hashPassword, verifyPassword } from '../src/lib/dev/password';
```
And inside `main()`, add these lines at the very top of the function body (before `const now`):
```ts
  const hash = hashPassword('hunter2');
  assert.equal(verifyPassword('hunter2', hash), true, 'correct password verifies');
  assert.equal(verifyPassword('wrong', hash), false, 'wrong password is rejected');
  assert.equal(verifyPassword('hunter2', 'garbage'), false, 'malformed hash is rejected');
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npx tsx scripts/test_dev_console.ts
```
Expected: FAIL — cannot resolve `../src/lib/dev/password`.

- [ ] **Step 3: Implement `password.ts`**

Create `src/lib/dev/password.ts`:
```ts
/**
 * Dev-console password hashing (Node runtime ONLY).
 *
 * Uses node:crypto scrypt. Do NOT import this from middleware (edge).
 * Format: scrypt$<saltHex>$<hashHex>
 */
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEYLEN);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, saltHex, hashHex] = parts;
  if (!saltHex || !hashHex) return false;
  let expected: Buffer;
  try {
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (expected.length === 0) return false;
  const derived = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
```

- [ ] **Step 4: Run the test — all assertions pass**

Run:
```bash
npx tsx scripts/test_dev_console.ts
```
Expected: PASS — prints `✓ dev console auth tests passed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dev/password.ts scripts/test_dev_console.ts
git commit -m "feat(dev-console): scrypt password hash/verify (node-only)"
```

---

### Task 4: Redis rate limiter for the auth endpoint

**Files:**
- Create: `src/lib/dev/rateLimit.ts`

- [ ] **Step 1: Implement the limiter**

Create `src/lib/dev/rateLimit.ts`:
```ts
/**
 * Fixed-window brute-force limiter for /api/dev/auth.
 * Uses the existing @upstash/redis client. 5 attempts / 15 min per IP.
 * Fails OPEN only when Redis is unconfigured (local dev); prod has Redis.
 */
import { Redis } from '@upstash/redis';

const MAX_ATTEMPTS = 5;
const WINDOW_S = 15 * 60;

let client: Redis | null = null;

function getRedis(): Redis | null {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  client = new Redis({ url, token });
  return client;
}

export async function checkAuthRateLimit(ip: string): Promise<{ allowed: boolean }> {
  const redis = getRedis();
  if (!redis) return { allowed: true }; // dev, no redis
  const key = `dev:auth:rl:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_S);
  }
  return { allowed: count <= MAX_ATTEMPTS };
}
```

- [ ] **Step 2: Type-check**

Run:
```bash
npx tsc --noEmit
```
Expected: PASS (no errors from the new file).

- [ ] **Step 3: Commit**

```bash
git add src/lib/dev/rateLimit.ts
git commit -m "feat(dev-console): redis fixed-window auth rate limiter"
```

---

### Task 5: Auth route (`/api/dev/auth`)

**Files:**
- Create: `src/app/api/dev/auth/route.ts`

- [ ] **Step 1: Implement the route**

Create `src/app/api/dev/auth/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/dev/password';
import { signSession, DEV_SESSION_COOKIE, sessionCookieOptions } from '@/lib/dev/session';
import { checkAuthRateLimit } from '@/lib/dev/rateLimit';
import { getClientIp } from '@/lib/rateLimit';

export const runtime = 'nodejs';

/** POST { password } → sets session cookie on success. */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkAuthRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'too many attempts' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === 'string' ? body.password : '';
  const hash = process.env.DEV_CONSOLE_PASSWORD_HASH || '';

  if (!password || !hash || !verifyPassword(password, hash)) {
    return NextResponse.json({ error: 'invalid credentials' }, { status: 401 });
  }

  const token = await signSession(Date.now());
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEV_SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}

/** DELETE → clears the session cookie (logout). */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEV_SESSION_COOKIE, '', { ...sessionCookieOptions, maxAge: 0 });
  return res;
}
```

- [ ] **Step 2: Type-check**

Run:
```bash
npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/dev/auth/route.ts
git commit -m "feat(dev-console): POST/DELETE /api/dev/auth (login + logout)"
```

---

### Task 6: Edge middleware guard

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Implement the middleware**

Create `src/middleware.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import {
  DEV_SESSION_COOKIE,
  sessionCookieOptions,
  verifySession,
} from '@/lib/dev/session';

export const config = {
  // Include bare `/dev` explicitly — `:path*` can miss the base segment.
  matcher: ['/dev', '/dev/:path*', '/api/dev/:path*'],
};

export async function middleware(req: NextRequest) {
  // The auth endpoint must be reachable while unauthenticated (login/logout).
  if (req.nextUrl.pathname === '/api/dev/auth') {
    return NextResponse.next();
  }

  const token = req.cookies.get(DEV_SESSION_COOKIE)?.value;
  const result = token ? await verifySession(token, Date.now()) : { valid: false as const };

  if (!result.valid) {
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    // Don't admit the page exists.
    return new NextResponse(null, { status: 404 });
  }

  const res = NextResponse.next();
  if (result.refreshed) {
    res.cookies.set(DEV_SESSION_COOKIE, result.refreshed, sessionCookieOptions);
  }
  return res;
}
```

- [ ] **Step 2: Verify the guard blocks unauthenticated access**

Start the dev server in one terminal:
```bash
npm run dev
```
In another terminal:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dev
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/dev/issues
```
Expected: `404` for `/dev`, `401` for `/api/dev/issues`.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(dev-console): edge middleware guarding /dev and /api/dev"
```

---

### Task 7: The portal component + global mount

**Files:**
- Create: `src/components/dev/DevPortal.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Implement `DevPortal.tsx`**

Create `src/components/dev/DevPortal.tsx`:
```tsx
'use client';

import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Secret login trigger. Desktop: hover the dot to open the portal.
 * Touch: long-press (~600ms) the dot to open it as a centered modal.
 * The animation is cosmetic — real auth is server-side (cookie + middleware).
 */
export function DevPortal() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openPortal = useCallback(() => setOpen(true), []);
  const closePortal = useCallback(() => {
    setOpen(false);
    setPassword('');
    setError('');
  }, []);

  const onTouchStart = () => {
    pressTimer.current = setTimeout(openPortal, 600);
  };
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/dev/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) {
      window.location.href = '/dev';
      return;
    }
    setError(res.status === 429 ? 'Too many attempts. Try later.' : 'Nope.');
    setPassword('');
  }

  return (
    <div className="flex justify-center py-8">
      <span
        aria-hidden
        onMouseEnter={openPortal}
        onTouchStart={onTouchStart}
        onTouchEnd={cancelPress}
        onTouchMove={cancelPress}
        className="cursor-default select-none text-xs text-white/10 transition-colors hover:text-white/25"
      >
        ·
      </span>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseLeave={closePortal}
            onClick={(e) => {
              if (e.target === e.currentTarget) closePortal();
            }}
          >
            <motion.form
              onSubmit={submit}
              initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0, filter: 'blur(8px)' }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="rounded-2xl border border-white/15 bg-slate-900/90 p-6 shadow-2xl"
            >
              <input
                autoFocus
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="·····"
                disabled={busy}
                className="w-40 bg-transparent text-center text-lg tracking-widest text-white outline-none placeholder-white/30"
              />
              {error && <p className="mt-3 text-center text-xs text-red-400">{error}</p>}
              <button type="submit" className="sr-only">
                Enter
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Mount it globally in `src/app/layout.tsx`**

In `src/app/layout.tsx`, add the import near the other imports:
```tsx
import { DevPortal } from '@/components/dev/DevPortal';
```
Then place `<DevPortal />` immediately after `{children}` inside the `AdminModeProvider`:
```tsx
              {children}
              <DevPortal />
```

- [ ] **Step 3: Visual check**

With `npm run dev` running, open `http://localhost:3000`. Scroll to the bottom: a faint `·` sits centered. Hover it → the portal springs open with a password field. Move the mouse off the overlay → it poofs closed.

- [ ] **Step 4: Commit**

```bash
git add src/components/dev/DevPortal.tsx src/app/layout.tsx
git commit -m "feat(dev-console): animated portal login (hover + long-press) mounted globally"
```

---

### Task 8: Authed console shell + end-to-end auth verification

**Files:**
- Modify: `src/styles/globals.css`
- Create: `src/app/dev/page.tsx`

- [ ] **Step 0: Add the "workpad" backdrop utility**

Append to `src/styles/globals.css` a faint blueprint-grid utility (Iron-Man-workspace feel — modern, restrained, no animation). The `/dev` console root uses `dev-workpad` instead of a flat background:
```css
/* Dev console "workpad" backdrop — layered engineering grid, low-opacity cyan on near-black. */
.dev-workpad {
  background-color: #070b12;
  background-image:
    linear-gradient(rgba(56, 189, 248, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(56, 189, 248, 0.05) 1px, transparent 1px),
    linear-gradient(rgba(56, 189, 248, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(56, 189, 248, 0.025) 1px, transparent 1px);
  background-size: 80px 80px, 80px 80px, 16px 16px, 16px 16px;
  background-position: -1px -1px, -1px -1px, -1px -1px, -1px -1px;
}
```

- [ ] **Step 1: Implement a minimal authed shell**

Create `src/app/dev/page.tsx`:
```tsx
'use client';

import { useState } from 'react';

export default function DevConsolePage() {
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch('/api/dev/auth', { method: 'DELETE' });
    window.location.href = '/';
  }

  return (
    <div className="min-h-screen dev-workpad p-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dev Console</h1>
          <button
            onClick={logout}
            disabled={loggingOut}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/70 hover:bg-white/5"
          >
            {loggingOut ? 'Logging out…' : 'Log out'}
          </button>
        </div>
        <p className="text-white/50">Board coming in Phase 2.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Generate a password hash and set env**

Run (replace with your real password):
```bash
npx tsx scripts/gen_dev_password.ts 'choose-a-strong-passphrase'
```
Copy the printed `scrypt$…` line. In `.env.local`, add:
```
DEV_CONSOLE_PASSWORD_HASH=scrypt$...the printed value...
DEV_SESSION_SECRET=<paste 32+ random chars, e.g. `openssl rand -hex 24`>
```
Restart `npm run dev` so the new env loads.

- [ ] **Step 3: End-to-end auth verification**

```bash
# wrong password → 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/dev/auth \
  -H 'Content-Type: application/json' -d '{"password":"wrong"}'

# correct password → 200 and a Set-Cookie: dev_session=...
curl -s -i -X POST http://localhost:3000/api/dev/auth \
  -H 'Content-Type: application/json' -d '{"password":"choose-a-strong-passphrase"}' \
  | grep -i -E "HTTP/|set-cookie"

# use the cookie to reach the guarded API → 200
curl -s -c /tmp/dev.jar -X POST http://localhost:3000/api/dev/auth \
  -H 'Content-Type: application/json' -d '{"password":"choose-a-strong-passphrase"}' > /dev/null
curl -s -b /tmp/dev.jar -o /dev/null -w "%{http_code}\n" http://localhost:3000/dev
```
Expected: `401`, then a line containing `HTTP/1.1 200` and a `set-cookie: dev_session=…; HttpOnly; SameSite=Strict`, then `200` for `/dev`.

- [ ] **Step 4: Browser check of the full loop**

Open `http://localhost:3000`, hover the `·`, enter the password → lands on `/dev` showing "Dev Console". Click "Log out" → returns home; revisiting `/dev` directly now renders the 404.

- [ ] **Step 5: Commit**

```bash
git add src/styles/globals.css src/app/dev/page.tsx
git commit -m "feat(dev-console): workpad backdrop + authed console shell + logout"
```

**PHASE 1 COMPLETE** — checkpoint: portal opens, password gates a server-enforced session, `/dev` is 404 without it, logout works, `npm run test:dev` is green.

---

# PHASE 2 — Board + export

### Task 9: Persisted repo-hide table + `hidden.ts`

**Files:**
- Create: `supabase/migrations/20260608000001_dev_hidden_repos.sql`
- Create: `src/lib/dev/hidden.ts`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260608000001_dev_hidden_repos.sql`:
```sql
-- 20260608000001_dev_hidden_repos.sql
-- Repos Mike has hidden from the secret dev-console board.

create table if not exists public.dev_hidden_repos (
  repo_slug text primary key,           -- "owner/name"
  hidden_at timestamptz not null default now()
);

-- Row-Level Security on; accessed only via the SERVICE_ROLE key (bypasses RLS).
alter table public.dev_hidden_repos enable row level security;

comment on table public.dev_hidden_repos is 'Repos hidden from the secret dev-console board.';
```

- [ ] **Step 2: Apply the migration**

Apply via the same path you use for other migrations (Supabase SQL editor, or `supabase db push` if linked). Verify the table exists:
```bash
# If using the Supabase CLI linked to the project:
supabase db push
```
Expected: `dev_hidden_repos` created. (If you apply by hand in the dashboard, just paste the SQL.)

- [ ] **Step 3: Implement `hidden.ts`**

Create `src/lib/dev/hidden.ts`:
```ts
/**
 * Persisted set of repos hidden from the dev-console board.
 * Stored in Supabase (dev_hidden_repos), accessed via the service-role client.
 */
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const TABLE = 'dev_hidden_repos';

export async function getHiddenRepos(): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin().from(TABLE).select('repo_slug');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.repo_slug as string);
}

export async function hideRepo(slug: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from(TABLE).upsert({ repo_slug: slug });
  if (error) throw new Error(error.message);
}

export async function unhideRepo(slug: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from(TABLE).delete().eq('repo_slug', slug);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: Type-check**

Run:
```bash
npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260608000001_dev_hidden_repos.sql src/lib/dev/hidden.ts
git commit -m "feat(dev-console): persisted repo-hide table + hidden.ts"
```

---

### Task 10: GitHub library — repo discovery, colored labels, issues

**Files:**
- Create: `src/lib/dev/github.ts`

- [ ] **Step 1: Implement the library**

Create `src/lib/dev/github.ts`:
```ts
/**
 * GitHub access for the dev-console board.
 * - Repos are DISCOVERED live (no hardcoded list); owned repos are the security boundary.
 * - Priority = label p1..p5. Status = label "status: todo" | "status: in progress".
 *   Done = a closed issue (no Done label).
 * - Priority/status labels are ensured WITH COLORS (idempotent) per repo.
 * Uses GITHUB_TOKEN (server-only).
 */
const GH = 'https://api.github.com';

export type Priority = 'p1' | 'p2' | 'p3' | 'p4' | 'p5';
export type Status = 'todo' | 'in progress';

const PRIORITY_RE = /^p[1-5]$/;
const STATUS_RE = /^status:\s*(todo|in progress)$/i;
const STATUS_LABEL: Record<Status, string> = {
  todo: 'status: todo',
  'in progress': 'status: in progress',
};

/** Label color definitions (hex, no #). */
const LABEL_DEFS: { name: string; color: string }[] = [
  { name: 'p1', color: 'b60205' }, // red — highest
  { name: 'p2', color: 'd93f0b' }, // orange
  { name: 'p3', color: 'fbca04' }, // yellow
  { name: 'p4', color: '0e8a16' }, // green
  { name: 'p5', color: 'c5def5' }, // light blue — lowest
  { name: 'status: todo', color: 'ededed' }, // gray
  { name: 'status: in progress', color: 'd4a72c' }, // amber
];

const ACCENTS = [
  '147, 197, 253', '52, 211, 153', '168, 85, 247', '251, 146, 60',
  '244, 114, 182', '45, 212, 191', '250, 204, 21', '129, 140, 248',
];

export interface DevRepo {
  slug: string; // "owner/name"
  name: string;
  accent: string; // "R, G, B"
  pushedAt: string;
  archived: boolean;
  fork: boolean;
  private: boolean;
}

export interface DevIssue {
  repo: string;
  number: number;
  title: string;
  body: string;
  priority: Priority | null;
  status: Status | null;
  state: 'open' | 'closed';
  url: string;
  updatedAt: string;
}

function ghHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not configured');
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'mikeveson-dev-console',
  };
}

function accentFor(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

interface GhLabel { name: string }
interface GhRepo {
  full_name: string;
  name: string;
  pushed_at: string;
  archived: boolean;
  fork: boolean;
  private: boolean;
}
interface GhIssue {
  number: number;
  title: string;
  body: string | null;
  labels: GhLabel[];
  state: 'open' | 'closed';
  html_url: string;
  updated_at: string;
  pull_request?: unknown;
}

function priorityOf(labels: GhLabel[]): Priority | null {
  const hit = labels.map((l) => l.name).find((n) => PRIORITY_RE.test(n));
  return (hit as Priority) ?? null;
}
function statusOf(labels: GhLabel[]): Status | null {
  for (const l of labels) {
    const m = l.name.match(STATUS_RE);
    if (m) return m[1].toLowerCase() as Status;
  }
  return null;
}

// ---- Repo discovery (cached) ----
interface RepoCache { data: DevRepo[]; expiry: number }
declare global {
  // eslint-disable-next-line no-var
  var __devRepoCache: RepoCache | undefined;
}
const REPO_TTL_MS = 10 * 60 * 1000;

export async function listRepos(nowMs = Date.now()): Promise<DevRepo[]> {
  const cache = globalThis.__devRepoCache;
  if (cache && nowMs < cache.expiry) return cache.data;

  const repos: DevRepo[] = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(
      `${GH}/user/repos?per_page=100&page=${page}&affiliation=owner&sort=pushed`,
      { headers: ghHeaders() },
    );
    if (!res.ok) throw new Error(`GitHub repos: ${res.status}`);
    const arr = (await res.json()) as GhRepo[];
    for (const r of arr) {
      repos.push({
        slug: r.full_name,
        name: r.name,
        accent: accentFor(r.full_name),
        pushedAt: r.pushed_at,
        archived: r.archived,
        fork: r.fork,
        private: r.private,
      });
    }
    if (arr.length < 100) break;
  }
  globalThis.__devRepoCache = { data: repos, expiry: nowMs + REPO_TTL_MS };
  return repos;
}

/** Security boundary: a repo is writable only if Mike owns it. */
export async function isOwnedRepo(slug: string): Promise<boolean> {
  return (await listRepos()).some((r) => r.slug === slug);
}

// ---- Labels (idempotent ensure with colors) ----
const ensured = new Set<string>();

async function ensureLabels(repo: string): Promise<void> {
  if (ensured.has(repo)) return;
  await Promise.all(
    LABEL_DEFS.map(async (def) => {
      const create = await fetch(`${GH}/repos/${repo}/labels`, {
        method: 'POST',
        headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: def.name, color: def.color }),
      });
      if (create.status === 422) {
        // Already exists — sync its color.
        await fetch(`${GH}/repos/${repo}/labels/${encodeURIComponent(def.name)}`, {
          method: 'PATCH',
          headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ color: def.color }),
        });
      }
    }),
  );
  ensured.add(repo);
}

// ---- Issues ----
export async function listIssues(
  repos: string[],
  state: 'open' | 'closed' | 'all' = 'open',
): Promise<DevIssue[]> {
  const perRepo = await Promise.all(
    repos.map(async (repo) => {
      const res = await fetch(`${GH}/repos/${repo}/issues?state=${state}&per_page=100`, {
        headers: ghHeaders(),
      });
      if (!res.ok) throw new Error(`GitHub list ${repo}: ${res.status}`);
      const arr = (await res.json()) as GhIssue[];
      return arr
        .filter((i) => !i.pull_request)
        .map<DevIssue>((i) => ({
          repo,
          number: i.number,
          title: i.title,
          body: i.body ?? '',
          priority: priorityOf(i.labels ?? []),
          status: statusOf(i.labels ?? []),
          state: i.state,
          url: i.html_url,
          updatedAt: i.updated_at,
        }));
    }),
  );
  return perRepo
    .flat()
    .sort(
      (a, b) =>
        (a.priority ?? 'p9').localeCompare(b.priority ?? 'p9') ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
}

export async function createIssue(
  repo: string,
  title: string,
  body: string,
  priority: Priority,
  status: Status,
): Promise<DevIssue> {
  await ensureLabels(repo);
  const res = await fetch(`${GH}/repos/${repo}/issues`, {
    method: 'POST',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body, labels: [priority, STATUS_LABEL[status]] }),
  });
  if (!res.ok) throw new Error(`GitHub create ${repo}: ${res.status} ${await res.text()}`);
  const i = (await res.json()) as GhIssue;
  return {
    repo,
    number: i.number,
    title: i.title,
    body: i.body ?? '',
    priority,
    status,
    state: i.state,
    url: i.html_url,
    updatedAt: i.updated_at,
  };
}

export async function updateIssue(
  repo: string,
  number: number,
  patch: { priority?: Priority; status?: Status; state?: 'open' | 'closed' },
): Promise<void> {
  await ensureLabels(repo);
  const payload: Record<string, unknown> = {};

  if (patch.priority || patch.status) {
    const cur = await fetch(`${GH}/repos/${repo}/issues/${number}`, { headers: ghHeaders() });
    if (!cur.ok) throw new Error(`GitHub get ${repo}#${number}: ${cur.status}`);
    const issue = (await cur.json()) as GhIssue;
    let names = (issue.labels ?? []).map((l) => l.name);
    if (patch.priority) names = names.filter((n) => !PRIORITY_RE.test(n)).concat(patch.priority);
    if (patch.status) names = names.filter((n) => !STATUS_RE.test(n)).concat(STATUS_LABEL[patch.status]);
    payload.labels = names;
  }
  if (patch.state) payload.state = patch.state;
  if (Object.keys(payload).length === 0) return;

  const res = await fetch(`${GH}/repos/${repo}/issues/${number}`, {
    method: 'PATCH',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`GitHub patch ${repo}#${number}: ${res.status}`);
}
```

- [ ] **Step 2: Type-check**

Run:
```bash
npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/dev/github.ts
git commit -m "feat(dev-console): GitHub lib — repo discovery, colored priority+status labels, issues"
```

---

### Task 11: Repos API (`/api/dev/repos`)

**Files:**
- Create: `src/app/api/dev/repos/route.ts`

- [ ] **Step 1: Implement GET / POST / DELETE**

Create `src/app/api/dev/repos/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { listRepos, isOwnedRepo } from '@/lib/dev/github';
import { getHiddenRepos, hideRepo, unhideRepo } from '@/lib/dev/hidden';

export const runtime = 'nodejs';

/** GET → { repos: visible[], hidden: hidden[] } */
export async function GET() {
  try {
    const [all, hidden] = await Promise.all([listRepos(), getHiddenRepos()]);
    const hiddenSet = new Set(hidden);
    return NextResponse.json({
      repos: all.filter((r) => !hiddenSet.has(r.slug)),
      hidden: all.filter((r) => hiddenSet.has(r.slug)),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

const RepoSchema = z.object({ repo: z.string() });

/** POST { repo } → hide it. */
export async function POST(req: NextRequest) {
  const parsed = RepoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  if (!(await isOwnedRepo(parsed.data.repo))) {
    return NextResponse.json({ error: 'repo not allowed' }, { status: 400 });
  }
  try {
    await hideRepo(parsed.data.repo);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

/** DELETE { repo } → unhide it. */
export async function DELETE(req: NextRequest) {
  const parsed = RepoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  try {
    await unhideRepo(parsed.data.repo);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
```

- [ ] **Step 2: Verify with the session cookie**

With `npm run dev` running and `/tmp/dev.jar` from Phase 1 (re-auth if expired):
```bash
# discover repos → 200 with { repos: [...], hidden: [] }
curl -s -b /tmp/dev.jar "http://localhost:3000/api/dev/repos" | head -c 400; echo

# hide one → 200, then it moves to the hidden list
curl -s -b /tmp/dev.jar -X POST http://localhost:3000/api/dev/repos \
  -H 'Content-Type: application/json' -d '{"repo":"mikedouzinas/mikedouz-portfolio"}'
curl -s -b /tmp/dev.jar "http://localhost:3000/api/dev/repos" | grep -o '"hidden":\[[^]]*' | head -c 200; echo

# unhide → 200
curl -s -b /tmp/dev.jar -X DELETE http://localhost:3000/api/dev/repos \
  -H 'Content-Type: application/json' -d '{"repo":"mikedouzinas/mikedouz-portfolio"}'
```
Expected: a repos array containing your repos; after POST the slug appears under `hidden`; after DELETE it's back. (Use a real slug from the first response.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/dev/repos/route.ts
git commit -m "feat(dev-console): /api/dev/repos (discover + hide/unhide)"
```

---

### Task 12: Issues API (`/api/dev/issues`)

**Files:**
- Create: `src/app/api/dev/issues/route.ts`

- [ ] **Step 1: Implement GET / POST / PATCH (priority + status)**

Create `src/app/api/dev/issues/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { listIssues, createIssue, updateIssue, listRepos, isOwnedRepo } from '@/lib/dev/github';
import { getHiddenRepos } from '@/lib/dev/hidden';

export const runtime = 'nodejs';

const PRIORITY = z.enum(['p1', 'p2', 'p3', 'p4', 'p5']);
const STATUS = z.enum(['todo', 'in progress']);

async function visibleRepoSlugs(): Promise<string[]> {
  const [all, hidden] = await Promise.all([listRepos(), getHiddenRepos()]);
  const hiddenSet = new Set(hidden);
  return all.filter((r) => !hiddenSet.has(r.slug)).map((r) => r.slug);
}

export async function GET(req: NextRequest) {
  const stateParam = req.nextUrl.searchParams.get('state') ?? 'open';
  const state = (['open', 'closed', 'all'] as const).includes(stateParam as never)
    ? (stateParam as 'open' | 'closed' | 'all')
    : 'open';
  const repoParam = req.nextUrl.searchParams.get('repo');

  try {
    let repos: string[];
    if (repoParam) {
      if (!(await isOwnedRepo(repoParam))) {
        return NextResponse.json({ error: 'repo not allowed' }, { status: 400 });
      }
      repos = [repoParam];
    } else {
      repos = await visibleRepoSlugs();
    }
    const issues = await listIssues(repos, state);
    return NextResponse.json({ issues });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

const CreateSchema = z.object({
  repo: z.string(),
  title: z.string().min(1),
  body: z.string().default(''),
  priority: PRIORITY.default('p3'),
  status: STATUS.default('todo'),
});

export async function POST(req: NextRequest) {
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  if (!(await isOwnedRepo(parsed.data.repo))) {
    return NextResponse.json({ error: 'repo not allowed' }, { status: 400 });
  }
  try {
    const issue = await createIssue(
      parsed.data.repo,
      parsed.data.title,
      parsed.data.body,
      parsed.data.priority,
      parsed.data.status,
    );
    return NextResponse.json({ issue });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

const PatchSchema = z.object({
  repo: z.string(),
  number: z.number().int().positive(),
  priority: PRIORITY.optional(),
  status: STATUS.optional(),
  state: z.enum(['open', 'closed']).optional(),
});

export async function PATCH(req: NextRequest) {
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  if (!(await isOwnedRepo(parsed.data.repo))) {
    return NextResponse.json({ error: 'repo not allowed' }, { status: 400 });
  }
  try {
    await updateIssue(parsed.data.repo, parsed.data.number, {
      priority: parsed.data.priority,
      status: parsed.data.status,
      state: parsed.data.state,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
```

- [ ] **Step 2: Verify with the session cookie**

Use a real owned slug from Task 11's repos response (referred to below as `<repo>`):
```bash
# list across visible repos → 200
curl -s -b /tmp/dev.jar -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/dev/issues?state=open"

# create with status → 200, returns issue with priority + status
curl -s -b /tmp/dev.jar -X POST http://localhost:3000/api/dev/issues \
  -H 'Content-Type: application/json' \
  -d '{"repo":"<repo>","title":"dev console smoke test","body":"delete me","priority":"p4","status":"todo"}'

# move to in progress (use the returned number N) → 200
curl -s -b /tmp/dev.jar -X PATCH http://localhost:3000/api/dev/issues \
  -H 'Content-Type: application/json' -d '{"repo":"<repo>","number":N,"status":"in progress"}'

# disallowed repo → 400
curl -s -o /dev/null -w "%{http_code}\n" -b /tmp/dev.jar -X POST http://localhost:3000/api/dev/issues \
  -H 'Content-Type: application/json' -d '{"repo":"evil/repo","title":"x"}'
```
Expected: `200`; a JSON issue with `"priority":"p4","status":"todo"`; `200` on the status patch; `400` for the disallowed repo. Close the smoke-test issue from the UI later.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/dev/issues/route.ts
git commit -m "feat(dev-console): /api/dev/issues GET/POST/PATCH with priority + status + owned-repo guard"
```

---

### Task 13: Copy-for-Claude export component

**Files:**
- Create: `src/components/dev/CopyForClaude.tsx`

- [ ] **Step 1: Implement it**

Create `src/components/dev/CopyForClaude.tsx`:
```tsx
'use client';

import { useState } from 'react';
import type { DevIssue } from '@/lib/dev/github';

export function CopyForClaude({ issue }: { issue: DevIssue }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const repoName = issue.repo.split('/')[1] ?? issue.repo;
    const text =
      `Work on this task in the ${repoName} repo ` +
      `(GitHub issue #${issue.number}, priority ${issue.priority ?? 'p3'}, status ${issue.status ?? 'todo'}).\n\n` +
      `${issue.title}\n\n${issue.body}\n\n` +
      `When complete, close issue #${issue.number}.`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={copy}
      className="rounded-md border border-white/15 px-2 py-1 text-xs text-white/70 hover:bg-white/5"
    >
      {copied ? 'Copied ✓' : 'Copy for Claude Code'}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dev/CopyForClaude.tsx
git commit -m "feat(dev-console): Copy-for-Claude clipboard export"
```

---

### Task 14: Repo picker (filter + hide/unhide)

**Files:**
- Create: `src/components/dev/RepoPicker.tsx`

- [ ] **Step 1: Implement it (presentational; parent owns data)**

Create `src/components/dev/RepoPicker.tsx`:
```tsx
'use client';

import { useState } from 'react';
import type { DevRepo } from '@/lib/dev/github';

export function RepoPicker({
  repos,
  hidden,
  selected,
  onSelect,
  onHide,
  onUnhide,
}: {
  repos: DevRepo[];
  hidden: DevRepo[];
  selected: string | null; // null = All
  onSelect: (slug: string | null) => void;
  onHide: (slug: string) => void;
  onUnhide: (slug: string) => void;
}) {
  const [managing, setManaging] = useState(false);

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onSelect(null)}
          className={`rounded-full px-3 py-1 text-xs ${
            selected === null ? 'bg-white/15 text-white' : 'bg-white/5 text-white/60'
          }`}
        >
          All
        </button>
        {repos.map((r) => (
          <button
            key={r.slug}
            onClick={() => onSelect(r.slug)}
            className={`rounded-full px-3 py-1 text-xs ${
              selected === r.slug ? 'text-white' : 'text-white/60'
            }`}
            style={{
              backgroundColor:
                selected === r.slug ? `rgba(${r.accent}, 0.25)` : 'rgba(255,255,255,0.05)',
            }}
          >
            {r.name}
          </button>
        ))}
        <button
          onClick={() => setManaging((m) => !m)}
          className="ml-auto rounded-md border border-white/10 px-2 py-1 text-xs text-white/50 hover:bg-white/5"
        >
          {managing ? 'Done' : 'Manage repos'}
        </button>
      </div>

      {managing && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
          <p className="mb-2 text-white/50">Shown</p>
          <ul className="mb-3 space-y-1">
            {repos.map((r) => (
              <li key={r.slug} className="flex items-center justify-between">
                <span className="text-white/80">{r.name}</span>
                <button
                  onClick={() => onHide(r.slug)}
                  className="text-xs text-white/50 hover:text-white"
                >
                  Hide
                </button>
              </li>
            ))}
          </ul>
          {hidden.length > 0 && (
            <>
              <p className="mb-2 text-white/50">Hidden</p>
              <ul className="space-y-1">
                {hidden.map((r) => (
                  <li key={r.slug} className="flex items-center justify-between">
                    <span className="text-white/40">{r.name}</span>
                    <button
                      onClick={() => onUnhide(r.slug)}
                      className="text-xs text-emerald-300/70 hover:text-emerald-300"
                    >
                      Unhide
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dev/RepoPicker.tsx
git commit -m "feat(dev-console): repo picker with filter + hide/unhide management"
```

---

### Task 15: Board UI (create form + list) wired into `/dev`

**Files:**
- Create: `src/components/dev/CreateIssueForm.tsx`
- Create: `src/components/dev/IssueList.tsx`
- Modify: `src/app/dev/page.tsx`

- [ ] **Step 1: Implement the create form**

Create `src/components/dev/CreateIssueForm.tsx`:
```tsx
'use client';

import { useState } from 'react';
import type { DevRepo, Priority, Status } from '@/lib/dev/github';

const PRIORITIES: Priority[] = ['p1', 'p2', 'p3', 'p4', 'p5'];
const STATUSES: Status[] = ['todo', 'in progress'];

export function CreateIssueForm({
  repos,
  onCreated,
}: {
  repos: DevRepo[];
  onCreated: () => void;
}) {
  const [repo, setRepo] = useState(repos[0]?.slug ?? '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<Priority>('p3');
  const [status, setStatus] = useState<Status>('todo');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !repo) return;
    setBusy(true);
    setError('');
    const res = await fetch('/api/dev/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo, title, body, priority, status }),
    });
    setBusy(false);
    if (!res.ok) {
      setError('Failed to create issue.');
      return;
    }
    setTitle('');
    setBody('');
    setPriority('p3');
    setStatus('todo');
    onCreated();
  }

  return (
    <form onSubmit={submit} className="mb-8 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex flex-wrap gap-3">
        <select
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          className="rounded-md border border-white/15 bg-slate-900 px-2 py-1.5 text-sm"
        >
          {repos.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          className="rounded-md border border-white/15 bg-slate-900 px-2 py-1.5 text-sm"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          className="rounded-md border border-white/15 bg-slate-900 px-2 py-1.5 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="mb-2 w-full rounded-md border border-white/15 bg-slate-900 px-3 py-2 text-sm outline-none"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Description"
        rows={3}
        className="mb-3 w-full rounded-md border border-white/15 bg-slate-900 px-3 py-2 text-sm outline-none"
      />
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
      >
        {busy ? 'Filing…' : 'File it'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Implement the list**

Create `src/components/dev/IssueList.tsx`:
```tsx
'use client';

import type { DevIssue, DevRepo, Priority, Status } from '@/lib/dev/github';
import { CopyForClaude } from './CopyForClaude';

const PRIORITIES: Priority[] = ['p1', 'p2', 'p3', 'p4', 'p5'];
const STATUSES: Status[] = ['todo', 'in progress'];

export function IssueList({
  issues,
  repos,
  onChanged,
}: {
  issues: DevIssue[];
  repos: DevRepo[];
  onChanged: () => void;
}) {
  function repoName(slug: string): string {
    return repos.find((r) => r.slug === slug)?.name ?? slug;
  }

  async function patch(
    issue: DevIssue,
    body: { priority?: Priority; status?: Status; state?: 'open' | 'closed' },
  ) {
    await fetch('/api/dev/issues', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo: issue.repo, number: issue.number, ...body }),
    });
    onChanged();
  }

  if (issues.length === 0) {
    return <p className="text-white/50">No open items. File one above.</p>;
  }

  return (
    <ul className="space-y-3">
      {issues.map((issue) => (
        <li
          key={`${issue.repo}#${issue.number}`}
          className="rounded-xl border border-white/10 bg-white/5 p-4"
        >
          <div className="mb-1 flex items-center gap-2 text-xs text-white/40">
            <span>{repoName(issue.repo)}</span>
            <span>#{issue.number}</span>
          </div>
          <p className="mb-2 font-medium text-white">{issue.title}</p>
          {issue.body && (
            <p className="mb-3 whitespace-pre-wrap text-sm text-white/60">{issue.body}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={issue.priority ?? 'p3'}
              onChange={(e) => patch(issue, { priority: e.target.value as Priority })}
              className="rounded-md border border-white/15 bg-slate-900 px-2 py-1 text-xs"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              value={issue.status ?? 'todo'}
              onChange={(e) => patch(issue, { status: e.target.value as Status })}
              className="rounded-md border border-white/15 bg-slate-900 px-2 py-1 text-xs"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <CopyForClaude issue={issue} />
            <button
              onClick={() => patch(issue, { state: 'closed' })}
              className="rounded-md border border-white/15 px-2 py-1 text-xs text-emerald-300/80 hover:bg-emerald-500/10"
            >
              Done
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Wire the board into `src/app/dev/page.tsx`**

Replace the entire contents of `src/app/dev/page.tsx` with:
```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DevIssue, DevRepo } from '@/lib/dev/github';
import { RepoPicker } from '@/components/dev/RepoPicker';
import { CreateIssueForm } from '@/components/dev/CreateIssueForm';
import { IssueList } from '@/components/dev/IssueList';

export default function DevConsolePage() {
  const [repos, setRepos] = useState<DevRepo[]>([]);
  const [hidden, setHidden] = useState<DevRepo[]>([]);
  const [issues, setIssues] = useState<DevIssue[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadRepos = useCallback(async () => {
    const res = await fetch('/api/dev/repos');
    if (res.ok) {
      const data = (await res.json()) as { repos: DevRepo[]; hidden: DevRepo[] };
      setRepos(data.repos);
      setHidden(data.hidden);
    }
  }, []);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    const url = selected
      ? `/api/dev/issues?state=open&repo=${encodeURIComponent(selected)}`
      : '/api/dev/issues?state=open';
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as { issues: DevIssue[] };
      setIssues(data.issues);
    }
    setLoading(false);
  }, [selected]);

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);
  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  async function hide(slug: string) {
    await fetch('/api/dev/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo: slug }),
    });
    if (selected === slug) setSelected(null);
    await loadRepos();
    await loadIssues();
  }
  async function unhide(slug: string) {
    await fetch('/api/dev/repos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo: slug }),
    });
    await loadRepos();
  }

  async function logout() {
    setLoggingOut(true);
    await fetch('/api/dev/auth', { method: 'DELETE' });
    window.location.href = '/';
  }

  return (
    <div className="min-h-screen dev-workpad p-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dev Console</h1>
          <button
            onClick={logout}
            disabled={loggingOut}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/70 hover:bg-white/5"
          >
            {loggingOut ? 'Logging out…' : 'Log out'}
          </button>
        </div>

        <RepoPicker
          repos={repos}
          hidden={hidden}
          selected={selected}
          onSelect={setSelected}
          onHide={hide}
          onUnhide={unhide}
        />

        {repos.length > 0 && <CreateIssueForm repos={repos} onCreated={loadIssues} />}

        {loading ? (
          <p className="text-white/50">Loading…</p>
        ) : (
          <IssueList issues={issues} repos={repos} onChanged={loadIssues} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Full board verification in the browser**

With `npm run dev` running and authenticated: on `/dev`, the repo picker shows your discovered repos. File a `p4` / `todo` item against one → it appears. Change its **status** dropdown to "in progress" and its **priority** → both persist (reload to confirm; check the colored labels on GitHub). Click "Done" → it closes and leaves the open list. "Manage repos" → hide a repo (it leaves the chips + filters), then unhide it (it returns). Reload the page → the hidden state persists. "Copy for Claude Code" → paste to confirm the prompt includes priority + status.

- [ ] **Step 5: Commit**

```bash
git add src/components/dev/CreateIssueForm.tsx src/components/dev/IssueList.tsx src/app/dev/page.tsx
git commit -m "feat(dev-console): board UI — repo filter, create, priority+status, Done, export"
```

---

### Task 16: Dogfood the board + update the KB

**Files:**
- Modify: `src/data/iris/kb/projects.json` (the `proj_portfolio` entry)

- [ ] **Step 1: File the remaining roadmap as board items**

In the running console at `/dev`, file these against your portfolio repo (per the spec's "Dogfood board items"), priority/status as noted:
- `p2` / todo — "Phase 3: dev-console links launchpad (Supabase dev_products + dev_links)"
- `p2` / todo — "Shareable project links — scoped guest link to one repo's board (dev_share_tokens)"
- `p3` / todo — "Seed launchpad with per-product service links (Vercel, Supabase, Upstash, Resend, GA, GoDaddy, Anthropic, repos, App Store Connect)"
- `p3` / todo — "⌘⇧J shortcut to open the portal anywhere (must not collide with ⌘K/Iris)"
- `p3` / todo — "Mobile secret trigger polish: long-press / 5-tap portal modal"
- `p3` / todo — "Unify /admin/inbox + comment deletion under the dev-console session"
- `p3` / todo — "README/TODO importer → file scattered TODOs as issues; first run on bbn-knight-life"
- `p2` / todo — "KB: projects support multiple images + context-varying descriptions"
- `p2` / todo — "Claude skill to read the dev-console board (setup how-to + connection) so agents/subagents can pull items"

- [ ] **Step 2: Update the `proj_portfolio` KB entry**

Open `src/data/iris/kb/projects.json`, find the `proj_portfolio` entry, and add a sentence to its `specifics[]` array, e.g.:
```json
"Includes a hidden, password-protected dev console (secret portal login + server-enforced session) with a cross-repo GitHub Issues board — auto-discovers Mike's repos and tracks work with priority and status labels."
```
Use skill IDs where applicable per KB conventions; do not emit raw URLs.

- [ ] **Step 3: Verify + rebuild the KB**

Run:
```bash
npm run verify:kb && npm run kb:rebuild
```
Expected: validation passes; typeahead + rankings rebuild without error.

- [ ] **Step 4: Commit**

```bash
git add src/data/iris/kb/projects.json
git commit -m "docs(kb): note dev console in proj_portfolio; dogfood roadmap filed on the board"
```

**PHASE 2 COMPLETE** — checkpoint: repos auto-discover with persisted hide; file/prioritize/set-status/close items across repos from `/dev`; export to Claude Code; KB knows the feature; remaining roadmap (incl. the new future items) lives in the tool.

---

## Notes / follow-ups (not in this plan)
- **`noindex` (spec hardening):** satisfied structurally — the middleware returns `404` to any request without a valid session cookie, so crawlers (which never have one) cannot see or index `/dev`. No robots meta needed (and `/dev/page.tsx` is a client component, which can't export `metadata` anyway).
- **Label auto-creation:** `ensureLabels()` upserts `p1`–`p5` + `status:` labels with colors on first create/update per repo (per process). Pre-warming all repos is unnecessary.
- **Phase 3 (links launchpad)**, **shareable project links (P2)**, **README/TODO importer (P3)**, **multi-image + context-varying project descriptions (P2)**, **Claude skill to read the board (P2)**, and **admin unification (P3)** are tracked on the board, not in this plan.
