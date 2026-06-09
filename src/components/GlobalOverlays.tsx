'use client';

import { usePathname } from 'next/navigation';
import IrisPalette from '@/components/IrisPalette';
import { DevPortal } from '@/components/dev/DevPortal';

/**
 * Global chrome (the secret portal dot + Iris palette), suppressed on /dev so
 * THE HARLEQUIN owns the full screen.
 */
export default function GlobalOverlays() {
  const pathname = usePathname();
  if (pathname?.startsWith('/dev')) return null;
  return (
    <>
      <DevPortal />
      <IrisPalette />
    </>
  );
}
