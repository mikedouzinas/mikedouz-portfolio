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
- Create `src/lib/dev/repos.ts` — allow-listed repo config.
- Create `src/lib/dev/github.ts` — list/create/update issues across repos.
- Create `src/app/api/dev/issues/route.ts` — `GET`/`POST`/`PATCH` (Node runtime).
- Create `src/components/dev/CreateIssueForm.tsx` — file a new item.
- Create `src/components/dev/IssueList.tsx` — cross-repo list, priority change, close.
- Create `src/components/dev/CopyForClaude.tsx` — clipboard export.
- Modify `src/app/dev/page.tsx` — render the board.

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
- Create: `src/app/dev/page.tsx`

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
    <div className="min-h-screen bg-slate-950 p-8 text-white">
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
git add src/app/dev/page.tsx
git commit -m "feat(dev-console): authed console shell + logout"
```

**PHASE 1 COMPLETE** — checkpoint: portal opens, password gates a server-enforced session, `/dev` is 404 without it, logout works, `npm run test:dev` is green.

---

# PHASE 2 — Board + export

### Task 9: Repo allow-list config

**Files:**
- Create: `src/lib/dev/repos.ts`

> NOTE: Confirm the exact GitHub slugs before relying on them. Defaults below assume `mikedouzinas/mikedouz-portfolio`, `mikedouzinas/apollo`, `mikedouzinas/iris-mobile`. Fix any that differ.

- [ ] **Step 1: Implement the config + allow-list**

Create `src/lib/dev/repos.ts`:
```ts
/**
 * Repos surfaced on the dev-console board. The allow-list is a security
 * boundary: the issues API only ever talks to repos listed here.
 */
export interface DevRepo {
  slug: string; // "owner/name"
  name: string; // display name
  accent: string; // "R, G, B"
}

export const DEV_REPOS: DevRepo[] = [
  { slug: 'mikedouzinas/mikedouz-portfolio', name: 'mikeveson.com', accent: '147, 197, 253' },
  { slug: 'mikedouzinas/apollo', name: 'Apollo × freewrite', accent: '52, 211, 153' },
  { slug: 'mikedouzinas/iris-mobile', name: 'Iris Mobile', accent: '168, 85, 247' },
];

const ALLOWED = new Set(DEV_REPOS.map((r) => r.slug));

export function isAllowedRepo(slug: string): boolean {
  return ALLOWED.has(slug);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/dev/repos.ts
git commit -m "feat(dev-console): allow-listed repo config for the board"
```

---

### Task 10: GitHub issues library

**Files:**
- Create: `src/lib/dev/github.ts`

- [ ] **Step 1: Implement list/create/update**

Create `src/lib/dev/github.ts`:
```ts
/**
 * GitHub Issues access for the dev-console board.
 * Priority is encoded as a label p1..p5. Uses GITHUB_TOKEN (server-only).
 */
const GH = 'https://api.github.com';

export type Priority = 'p1' | 'p2' | 'p3' | 'p4' | 'p5';
const PRIORITY_RE = /^p[1-5]$/;

export interface DevIssue {
  repo: string;
  number: number;
  title: string;
  body: string;
  priority: Priority | null;
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

interface GhLabel { name: string }
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
): Promise<DevIssue> {
  const res = await fetch(`${GH}/repos/${repo}/issues`, {
    method: 'POST',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body, labels: [priority] }),
  });
  if (!res.ok) throw new Error(`GitHub create ${repo}: ${res.status} ${await res.text()}`);
  const i = (await res.json()) as GhIssue;
  return {
    repo,
    number: i.number,
    title: i.title,
    body: i.body ?? '',
    priority,
    state: i.state,
    url: i.html_url,
    updatedAt: i.updated_at,
  };
}

export async function updateIssue(
  repo: string,
  number: number,
  patch: { priority?: Priority; state?: 'open' | 'closed' },
): Promise<void> {
  const payload: Record<string, unknown> = {};

  if (patch.priority) {
    // Replace the existing p* label, keep everything else.
    const cur = await fetch(`${GH}/repos/${repo}/issues/${number}`, { headers: ghHeaders() });
    if (!cur.ok) throw new Error(`GitHub get ${repo}#${number}: ${cur.status}`);
    const issue = (await cur.json()) as GhIssue;
    const kept = (issue.labels ?? []).map((l) => l.name).filter((n) => !PRIORITY_RE.test(n));
    payload.labels = [...kept, patch.priority];
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
git commit -m "feat(dev-console): GitHub issues lib (list/create/update, priority labels)"
```

---

### Task 11: Issues API route

**Files:**
- Create: `src/app/api/dev/issues/route.ts`

- [ ] **Step 1: Implement GET/POST/PATCH with Zod + allow-list**

Create `src/app/api/dev/issues/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DEV_REPOS, isAllowedRepo } from '@/lib/dev/repos';
import { listIssues, createIssue, updateIssue } from '@/lib/dev/github';

export const runtime = 'nodejs';

const PRIORITY = z.enum(['p1', 'p2', 'p3', 'p4', 'p5']);

export async function GET(req: NextRequest) {
  const stateParam = req.nextUrl.searchParams.get('state') ?? 'open';
  const state = (['open', 'closed', 'all'] as const).includes(stateParam as never)
    ? (stateParam as 'open' | 'closed' | 'all')
    : 'open';
  const repoParam = req.nextUrl.searchParams.get('repo');
  const repos = repoParam && isAllowedRepo(repoParam) ? [repoParam] : DEV_REPOS.map((r) => r.slug);
  try {
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
});

export async function POST(req: NextRequest) {
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  if (!isAllowedRepo(parsed.data.repo)) {
    return NextResponse.json({ error: 'repo not allowed' }, { status: 400 });
  }
  try {
    const issue = await createIssue(
      parsed.data.repo,
      parsed.data.title,
      parsed.data.body,
      parsed.data.priority,
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
  state: z.enum(['open', 'closed']).optional(),
});

export async function PATCH(req: NextRequest) {
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  if (!isAllowedRepo(parsed.data.repo)) {
    return NextResponse.json({ error: 'repo not allowed' }, { status: 400 });
  }
  try {
    await updateIssue(parsed.data.repo, parsed.data.number, {
      priority: parsed.data.priority,
      state: parsed.data.state,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
```

- [ ] **Step 2: Verify with the session cookie**

With `npm run dev` running and `/tmp/dev.jar` from Task 8 Step 3 (re-auth if expired):
```bash
# list (empty array is fine) → 200
curl -s -b /tmp/dev.jar -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/dev/issues?state=open"

# create a test issue → 200, returns the issue
curl -s -b /tmp/dev.jar -X POST http://localhost:3000/api/dev/issues \
  -H 'Content-Type: application/json' \
  -d '{"repo":"mikedouzinas/mikedouz-portfolio","title":"dev console smoke test","body":"delete me","priority":"p4"}'

# disallowed repo → 400
curl -s -o /dev/null -w "%{http_code}\n" -b /tmp/dev.jar -X POST http://localhost:3000/api/dev/issues \
  -H 'Content-Type: application/json' -d '{"repo":"evil/repo","title":"x"}'
```
Expected: `200`, a JSON issue with `"priority":"p4"`, then `400`. Close the smoke-test issue afterward (the UI in the next task can do it).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/dev/issues/route.ts
git commit -m "feat(dev-console): /api/dev/issues GET/POST/PATCH with zod + repo allow-list"
```

---

### Task 12: Copy-for-Claude export component

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
      `(GitHub issue #${issue.number}, priority ${issue.priority ?? 'p3'}).\n\n` +
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

### Task 13: Board UI (create form + list) wired into `/dev`

**Files:**
- Create: `src/components/dev/CreateIssueForm.tsx`
- Create: `src/components/dev/IssueList.tsx`
- Modify: `src/app/dev/page.tsx`

- [ ] **Step 1: Implement the create form**

Create `src/components/dev/CreateIssueForm.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { DEV_REPOS } from '@/lib/dev/repos';

const PRIORITIES = ['p1', 'p2', 'p3', 'p4', 'p5'] as const;

export function CreateIssueForm({ onCreated }: { onCreated: () => void }) {
  const [repo, setRepo] = useState(DEV_REPOS[0].slug);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('p3');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError('');
    const res = await fetch('/api/dev/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo, title, body, priority }),
    });
    setBusy(false);
    if (!res.ok) {
      setError('Failed to create issue.');
      return;
    }
    setTitle('');
    setBody('');
    setPriority('p3');
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
          {DEV_REPOS.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as (typeof PRIORITIES)[number])}
          className="rounded-md border border-white/15 bg-slate-900 px-2 py-1.5 text-sm"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
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

import type { DevIssue, Priority } from '@/lib/dev/github';
import { DEV_REPOS } from '@/lib/dev/repos';
import { CopyForClaude } from './CopyForClaude';

const PRIORITIES: Priority[] = ['p1', 'p2', 'p3', 'p4', 'p5'];

function repoName(slug: string): string {
  return DEV_REPOS.find((r) => r.slug === slug)?.name ?? slug;
}

export function IssueList({ issues, onChanged }: { issues: DevIssue[]; onChanged: () => void }) {
  async function patch(issue: DevIssue, patch: { priority?: Priority; state?: 'open' | 'closed' }) {
    await fetch('/api/dev/issues', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo: issue.repo, number: issue.number, ...patch }),
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
          {issue.body && <p className="mb-3 whitespace-pre-wrap text-sm text-white/60">{issue.body}</p>}
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
            <CopyForClaude issue={issue} />
            <button
              onClick={() => patch(issue, { state: 'closed' })}
              className="rounded-md border border-white/15 px-2 py-1 text-xs text-white/70 hover:bg-white/5"
            >
              Close
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
import type { DevIssue } from '@/lib/dev/github';
import { CreateIssueForm } from '@/components/dev/CreateIssueForm';
import { IssueList } from '@/components/dev/IssueList';

export default function DevConsolePage() {
  const [issues, setIssues] = useState<DevIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/dev/issues?state=open');
    if (res.ok) {
      const data = (await res.json()) as { issues: DevIssue[] };
      setIssues(data.issues);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function logout() {
    setLoggingOut(true);
    await fetch('/api/dev/auth', { method: 'DELETE' });
    window.location.href = '/';
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-white">
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

        <CreateIssueForm onCreated={load} />

        {loading ? <p className="text-white/50">Loading…</p> : <IssueList issues={issues} onChanged={load} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Full board verification in the browser**

With `npm run dev` running and authenticated (hover `·`, log in): on `/dev`, file a `p4` test item against mikeveson.com → it appears in the list. Change its priority dropdown → reorders/persists (reload to confirm). Click "Copy for Claude Code" → button shows "Copied ✓"; paste elsewhere to confirm the prompt format. Click "Close" → it disappears from the open list. Verify the same issue on GitHub.

- [ ] **Step 5: Commit**

```bash
git add src/components/dev/CreateIssueForm.tsx src/components/dev/IssueList.tsx src/app/dev/page.tsx
git commit -m "feat(dev-console): cross-repo board UI (create, prioritize, close, export)"
```

---

### Task 14: Dogfood the board + update the KB

**Files:**
- Modify: `src/data/iris/kb/projects.json` (the `proj_portfolio` entry)

- [ ] **Step 1: File the remaining roadmap as board items**

In the running console at `/dev`, file these against `mikedouzinas/mikedouz-portfolio` (per the spec's "Dogfood board items"):
- `p2` — "Phase 3: dev-console links launchpad (Supabase dev_products + dev_links)"
- `p3` — "Seed launchpad with per-product service links (Vercel, Supabase, Upstash, Resend, GA, GoDaddy, Anthropic, repos, App Store Connect)"
- `p3` — "⌘⇧J shortcut to open the portal anywhere (must not collide with ⌘K/Iris)"
- `p3` — "Mobile secret trigger polish: long-press / 5-tap portal modal"
- `p3` — "Unify /admin/inbox + comment deletion under the dev-console session"

- [ ] **Step 2: Update the `proj_portfolio` KB entry**

Open `src/data/iris/kb/projects.json`, find the `proj_portfolio` entry, and add a sentence to its `specifics[]` array describing the new feature, e.g.:
```json
"Includes a hidden, password-protected dev console (secret portal login + server-enforced session) with a cross-repo GitHub Issues board for filing and prioritizing work across Mike's products."
```
Use skill IDs where applicable per KB conventions; do not emit raw URLs.

- [ ] **Step 3: Verify + rebuild the KB**

Run:
```bash
npm run verify:kb && npm run kb:rebuild
```
Expected: validation passes, typeahead + rankings rebuild without error.

- [ ] **Step 4: Commit**

```bash
git add src/data/iris/kb/projects.json
git commit -m "docs(kb): note the dev console in proj_portfolio; dogfood roadmap filed on the board"
```

**PHASE 2 COMPLETE** — checkpoint: file/prioritize/close items across repos from `/dev`, export any item to Claude Code, KB knows about the feature, and the remaining roadmap now lives in the tool itself.

---

## Notes / follow-ups (not in this plan)
- **`noindex` (spec hardening):** satisfied structurally — the middleware returns `404` to any request without a valid session cookie, so crawlers (which never have one) cannot see or index `/dev`. No robots meta needed (and `/dev/page.tsx` is a client component, which can't export `metadata` anyway).
- **GitHub label colors:** applying `p1`–`p5` auto-creates gray labels. Pre-creating them with colors is a nice-to-have, filed separately if wanted.
- **iris-mobile / apollo repo slugs:** confirm exact `owner/name` in `repos.ts` before filing items there.
- **Phase 3 (links launchpad)** and the **admin unification (P3)** are tracked on the board, not in this plan.
```
