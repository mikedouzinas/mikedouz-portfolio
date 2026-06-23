'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { requestHarlequinTransition } from '@/components/dev/transition/store';
import { markEntrance } from '@/components/dev/transition/entranceSignal';
import { captureHomeSnapshot } from '@/components/dev/transition/homeSnapshot';

/**
 * Passcode entry + real server auth — extracted from `PortalCircle.tsx` (which
 * is itself a verbatim port of the lockup's passcode panel). The lockup's
 * 4-digit auto-close demo is replaced by the real flow: the passcode is
 * alphanumeric (≤6), POSTs to `/api/dev/auth`, and on success redirects to
 * `/dev`. The six dots are a discreet length indicator.
 *
 * Shared by every HARLEQUIN face via `HarlequinPortalCard`.
 */
export function usePasscodeAuth() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const clear = useCallback(() => {
    setPassword('');
    setError('');
  }, []);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const submitPassword = useCallback(
    async (pw: string) => {
      if (!pw || busy) return;
      setBusy(true);
      setError('');
      try {
        const res = await fetch('/api/dev/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pw }),
        });
        if (res.ok) {
          // Arm the sequential board reveal, then navigate to /dev.
          void captureHomeSnapshot(); // best-effort; overlay no-ops if absent
          markEntrance();
          requestHarlequinTransition('enter');
          return;
        }
        setError(res.status === 429 ? 'Too many attempts. Try later.' : 'Nope.');
        setPassword('');
      } catch {
        setError('Network error. Try again.');
        setPassword('');
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  const onChange = useCallback((raw: string) => {
    // The real passcode is alphanumeric — accept letters AND numbers, cap at 6.
    const next = raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6);
    setPassword(next);
  }, []);

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void submitPassword(password);
    },
    [password, submitPassword],
  );

  // Auto-submit when the 6th digit lands (post-render, state committed).
  // `submitPassword` is intentionally omitted from deps: depending on it would
  // re-run the effect on every render (it closes over `busy`/state), and the
  // submit path calls setPassword('') — see PortalCircle.tsx for the same note.
  useEffect(() => {
    if (password.length === 6) {
      void submitPassword(password);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  // 6 dots fill as digits are typed — a discreet length indicator.
  const filledDots = Math.min(password.length, 6);

  return {
    password,
    error,
    busy,
    filledDots,
    inputRef,
    clear,
    focusInput,
    onChange,
    submit,
  };
}
