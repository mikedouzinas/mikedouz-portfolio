'use client';

import { useEffect, useState } from 'react';
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
  // Pick the game AFTER mount, not in the useState initializer: that initializer
  // runs on the server and the client independently, so Math.random() yields
  // different games → hydration mismatch ("Blackjack" vs "War"). Start with a
  // fixed game so SSR and the first client render agree, then randomize client-side.
  const [game, setGame] = useState<(typeof GAMES)[number]>(GAMES[0]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-mount randomization to avoid an SSR/client hydration mismatch
    setGame(GAMES[Math.floor(Math.random() * GAMES.length)]);
  }, []);
  const { name, Comp } = game;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Comp />
      <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">{name}</span>
    </div>
  );
}
