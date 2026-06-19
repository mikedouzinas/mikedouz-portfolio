'use client';

import { useState } from 'react';
import { CereBlackjack } from './CereBlackjack';
import { CereWar } from './CereWar';

// Cere's "thinking" state plays a quick game while it works. One game is chosen
// at random per mount — i.e. per message — and stays put for that whole load
// (it doesn't switch mid-think). Add games here to grow the set. The name label
// keeps the two games distinguishable (War legitimately deals one card per side).
const GAMES = [
  { name: 'Blackjack', Comp: CereBlackjack },
  { name: 'War', Comp: CereWar },
] as const;

export function CereGameLoader() {
  const [game] = useState(() => GAMES[Math.floor(Math.random() * GAMES.length)]);
  const { name, Comp } = game;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Comp />
      <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">{name}</span>
    </div>
  );
}
