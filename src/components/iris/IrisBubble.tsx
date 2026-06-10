'use client';

import { forwardRef, type CSSProperties, type ReactNode } from 'react';

/**
 * The shared Iris "bubble" shell — the teal glass, hud-enter animation, rounded
 * panel used by the blog assistant and Cere. Purely presentational: the
 * consumer owns positioning (`style`), open/close, and the content. Mobile
 * renders a bottom sheet with a drag handle; desktop a floating glass card.
 *
 * Note: `iris-hud-enter` animates a `scale` transform, so position via top/left
 * (not translate) to avoid fighting the entrance animation.
 */
// Two glass tones: the blog assistant keeps teal; Cere (THE HARLEQUIN) wears the
// champagne metal so the panel itself matches the theme instead of fighting it.
const GLASS = {
  teal: 'bg-teal-500/[0.08] border border-teal-400/[0.12] backdrop-blur-xl',
  champagne: 'bg-[#e7e2d4]/[0.06] border border-[#e7e2d4]/[0.14] backdrop-blur-xl',
} as const;

export const IrisBubble = forwardRef<
  HTMLDivElement,
  {
    children: ReactNode;
    mobile?: boolean;
    expanded?: boolean;
    tone?: keyof typeof GLASS;
    style?: CSSProperties;
    className?: string;
  }
>(function IrisBubble({ children, mobile, expanded, tone = 'teal', style, className = '' }, ref) {
  const glass = GLASS[tone];
  if (mobile) {
    return (
      <div
        ref={ref}
        className={`iris-hud-enter fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl ${glass} p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.3)] ${className}`}
      >
        <div className="mb-3 flex justify-center">
          <div className="h-1 w-8 rounded-full bg-white/20" />
        </div>
        <div className="relative">{children}</div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      data-has-contained-glow="true"
      style={style}
      className={`iris-hud-enter ${glass} overflow-y-auto rounded-2xl transition-[top,left,width,max-height,padding,box-shadow] duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${
        expanded
          ? 'p-5 shadow-[0_0_80px_40px_rgba(0,0,0,0.35),0_4px_24px_rgba(0,0,0,0.25)]'
          : 'p-3.5 shadow-[0_8px_48px_rgba(0,0,0,0.65),0_2px_12px_rgba(0,0,0,0.4)]'
      } ${className}`}
    >
      <div className="relative">{children}</div>
    </div>
  );
});
