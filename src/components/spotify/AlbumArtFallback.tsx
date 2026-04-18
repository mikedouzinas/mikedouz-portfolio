'use client';

import { Music } from 'lucide-react';

const GRADIENTS = [
  ['#1DB954', '#0a5a29'],
  ['#7c3aed', '#3b0f6b'],
  ['#e11d48', '#6b0a1f'],
  ['#0891b2', '#0a3a4a'],
  ['#f59e0b', '#6b3a0a'],
  ['#db2777', '#6b0a3a'],
  ['#10b981', '#0a4a3a'],
  ['#6366f1', '#1e1b5a'],
  ['#f43f5e', '#6b0a29'],
  ['#14b8a6', '#0a4a4a'],
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

interface Props {
  seed: string;
  iconSize?: number;
  rounded?: string;
}

export default function AlbumArtFallback({
  seed,
  iconSize = 14,
  rounded = 'rounded',
}: Props) {
  const [from, to] = GRADIENTS[hashString(seed) % GRADIENTS.length];
  return (
    <div
      className={`w-full h-full flex items-center justify-center ${rounded}`}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <Music size={iconSize} className="text-white/80" strokeWidth={2} />
    </div>
  );
}
