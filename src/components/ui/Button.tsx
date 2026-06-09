'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import ContainedMouseGlow from '@/components/ContainedMouseGlow';

/**
 * The site's default light-reactive button: a cursor-following glow
 * (ContainedMouseGlow) contained within the button. Opt-in elsewhere via the
 * `data-has-contained-glow` contract so the global cursor halo yields to it.
 */
type Variant = 'solid' | 'ghost' | 'hatch';

const BASE =
  'relative isolate overflow-hidden inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100';

const VARIANTS: Record<Variant, string> = {
  solid: 'border border-white/15 bg-white/[0.06] px-3 py-1.5 text-white/85',
  ghost: 'px-2 py-1 text-white/70',
  hatch: 'workpad-btn border border-white/15 px-3 py-1.5 text-white/80',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Glow color as an "R, G, B" string. */
  glowColor?: string;
  glowIntensity?: number;
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { glowColor = '52, 211, 153', glowIntensity = 0.22, variant = 'solid', className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      data-has-contained-glow="true"
      className={`${BASE} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      <ContainedMouseGlow color={glowColor} intensity={glowIntensity} />
      <span className="relative z-10 inline-flex items-center gap-1.5">{children}</span>
    </button>
  );
});
