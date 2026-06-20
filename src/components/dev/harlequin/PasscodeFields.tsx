'use client';

import { forwardRef } from 'react';
import { Space_Mono } from 'next/font/google';

const spaceMono = Space_Mono({ weight: '400', subsets: ['latin'], display: 'swap' });

interface PasscodeFieldsProps {
  filledDots: number;
  password: string;
  busy: boolean;
  error: string;
  onChange: (raw: string) => void;
  /** Unique input id/name per shape (avoid duplicate ids when all render). */
  inputId: string;
}

/**
 * The dots + hidden input + label that live inside every face's passcode panel
 * (verbatim from the lockups). The shape-specific `<form>` wrapper and panel
 * positioning stay in each face; only these shared fields are factored out.
 *
 * The input element's `ref` is forwarded so the hook's autofocus works, while
 * keeping plain value/state props off any ref-bearing object (so the
 * react-hooks/refs rule is satisfied).
 */
export const PasscodeFields = forwardRef<HTMLInputElement, PasscodeFieldsProps>(
  function PasscodeFields(
    { filledDots, password, busy, error, onChange, inputId },
    ref,
  ) {
    return (
      <>
        <div className="passcode-dots" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`passcode-dot${i < filledDots ? ' filled' : ''}`}
            />
          ))}
        </div>
        <input
          ref={ref}
          className="passcode-input"
          type="password"
          inputMode="text"
          id={inputId}
          name={inputId}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-bwignore="true"
          data-form-type="other"
          aria-label="Enter passcode"
          value={password}
          disabled={busy}
          maxLength={6}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className={`passcode-label ${spaceMono.className}`}>
          {error ? error : 'enter code'}
        </div>
        <button type="submit" className="hq-sr-only">
          Enter
        </button>
      </>
    );
  },
);
