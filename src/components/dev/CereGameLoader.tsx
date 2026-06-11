'use client';

import { useState } from 'react';
import { CereBlackjack } from './CereBlackjack';
import { CereWar } from './CereWar';

// Cere's "thinking" state plays a quick game while it works. One game is chosen
// at random per mount — i.e. per message — and stays put for that whole load
// (it doesn't switch mid-think). Add games here to grow the set.
const GAMES = [CereBlackjack, CereWar];

export function CereGameLoader() {
  const [Game] = useState(() => GAMES[Math.floor(Math.random() * GAMES.length)]);
  return <Game />;
}
