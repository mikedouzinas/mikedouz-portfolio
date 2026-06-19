'use client';

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

const emptySubscribe = () => () => {};

export interface DropdownOption {
  value: string;
  label: string;
  /** Optional color dot (e.g. priority/status). */
  color?: string;
}

/**
 * Modern dark dropdown replacing native <select>: color dots, popover list,
 * outside-click + Escape close.
 *
 * The menu is portalled to <body> and positioned with fixed coordinates
 * anchored to the trigger, so it overlays everything (z-[120]) and is never
 * clipped or pushed below by an ancestor's `overflow` — notably the detached
 * ticket panel, which would otherwise hide/scroll the menu underneath itself.
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
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  }>({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 0,
  });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  // Gate the body-portal until after mount (createPortal needs document.body).
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // Anchor the portalled menu under the trigger. Recomputed on open and while
  // open on scroll/resize so it tracks the button (fixed coords, viewport-based).
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const el = btnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const margin = 8;
      const gap = 4;
      const spaceBelow = window.innerHeight - r.bottom - margin;
      const spaceAbove = r.top - margin;
      // Flip the menu above the trigger when there isn't enough room below —
      // critical inside the tall detached ticket panel, where bottom-row
      // dropdowns would otherwise open off the bottom of the viewport. The menu
      // is also capped to the available space and scrolls internally.
      if (spaceBelow >= spaceAbove) {
        setCoords({ top: r.bottom + gap, left: r.left, width: r.width, maxHeight: Math.max(spaceBelow, 120) });
      } else {
        // Anchor by `bottom` so the menu grows upward from just above the trigger.
        setCoords({
          bottom: window.innerHeight - r.top + gap,
          left: r.left,
          width: r.width,
          maxHeight: Math.max(spaceAbove, 120),
        });
      }
    }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
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
        ref={btnRef}
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-white/80 transition-colors hover:border-[#e7e2d4]/30"
      >
        {current?.color && (
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: current.color }} />
        )}
        <span>{current?.label}</span>
        <ChevronDown className={`h-3 w-3 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {mounted &&
        open &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: coords.top,
              bottom: coords.bottom,
              left: coords.left,
              minWidth: Math.max(coords.width, 160),
              maxHeight: coords.maxHeight,
            }}
            className="z-[120] overflow-y-auto rounded-lg border border-white/10 bg-[#0c1118] p-1 shadow-xl"
          >
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
          </div>,
          document.body,
        )}
    </div>
  );
}
