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
