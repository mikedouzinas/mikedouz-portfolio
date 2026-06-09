'use client';

import { usePathname } from 'next/navigation';
import IrisPalette from '@/components/IrisPalette';

/**
 * Global chrome (the Iris command palette), suppressed on /dev so THE HARLEQUIN
 * owns the full screen. The secret portal dot lives at the END of the home list
 * (see src/app/page.tsx), not as a global footer band.
 */
export default function GlobalOverlays() {
  const pathname = usePathname();
  if (pathname?.startsWith('/dev')) return null;
  return <IrisPalette />;
}
