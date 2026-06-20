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
 *
 * Inner-element styles (.passcode-dots, .passcode-dot, .passcode-input,
 * .passcode-label, .hq-sr-only) live HERE so that styled-jsx scopes them to
 * this component's own DOM — faces' scoped <style jsx> blocks cannot reach
 * children rendered by a different component.
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
        {/* visually hidden — screen-reader only; the word "Enter" must NOT be visible */}
        <button type="submit" className="hq-sr-only">
          Enter
        </button>

        {/* ── inner-element styles scoped to this component (verbatim from PortalCircle) ── */}
        <style jsx>{`
          .passcode-dots {
            display: flex;
            gap: 8px;
          }
          .passcode-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            border: 1px solid rgba(231, 226, 212, 0.5);
            background: transparent;
            transition: background 150ms;
          }
          .passcode-dot.filled {
            background: rgba(231, 226, 212, 0.55);
          }
          .passcode-input {
            position: absolute;
            opacity: 0;
            width: 1px;
            height: 1px;
            pointer-events: all;
          }
          .passcode-label {
            font-size: 7px;
            letter-spacing: 0.22em;
            color: rgba(231, 226, 212, 0.35);
            text-transform: uppercase;
            margin-top: 2px;
          }
          .hq-sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
          }
        `}</style>
      </>
    );
  },
);
