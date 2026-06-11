'use client';

/**
 * The Cere trigger — a living "portal" icon, not a labelled button. Nested
 * diamonds frame a Google-palette core that pulses inside a slowly spinning
 * ring, so it reads as something alive you can open and talk to (the AI entry
 * point), distinct from the plain toolbar controls. Animation in globals.css.
 */
export function CerePortal({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Open Cere" className="cere-portal">
      <span className="cere-portal-ring" aria-hidden />
      <span className="cere-portal-ring2" aria-hidden />
      <span className="cere-portal-core" aria-hidden />
    </button>
  );
}
