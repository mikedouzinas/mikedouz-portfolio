'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Guest share-link landing (#6). The middleware lets this page through without
 * a session; it exchanges the URL token for a repo-scoped read-only visitor
 * session, then forwards to the board. Invalid/expired links get a quiet,
 * no-details dead end — this page never admits what lives behind it.
 */
export default function GuestLanding({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [state, setState] = useState<'exchanging' | 'invalid'>('exchanging');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/dev/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shareToken: token }),
        });
        if (cancelled) return;
        if (res.ok) router.replace('/dev');
        else setState('invalid');
      } catch {
        if (!cancelled) setState('invalid');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#0a0a0c] px-6 text-center">
      {state === 'exchanging' ? (
        <p className="text-sm tracking-[0.2em] text-[#e7e2d4]/50 uppercase">Opening…</p>
      ) : (
        <div>
          <p className="text-sm tracking-[0.2em] text-[#e7e2d4]/60 uppercase">This link has lapsed.</p>
          <p className="mt-2 text-xs text-white/30">Ask Mike for a fresh one.</p>
        </div>
      )}
    </main>
  );
}
