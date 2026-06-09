'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  /** Optional color dot (e.g. priority/status). */
  color?: string;
}

/**
 * Modern dark dropdown replacing native <select>: color dots, popover list,
 * outside-click + Escape close.
 */
export function Dropdown({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-white/80 transition-colors hover:border-white/25"
      >
        {current?.color && (
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: current.color }} />
        )}
        <span>{current?.label}</span>
        <ChevronDown className={`h-3 w-3 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 min-w-[10rem] overflow-hidden rounded-lg border border-white/10 bg-[#0c1118] p-1 shadow-xl">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/[0.07] ${
                o.value === value ? 'text-white' : 'text-white/70'
              }`}
            >
              {o.color && (
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: o.color }} />
              )}
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
