'use client';

// Shared playing-card kit for Cere's card-game loaders (blackjack, war, …).

export type Card = { r: string; s: string; red: boolean };

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS: { s: string; red: boolean }[] = [
  { s: '♠', red: false },
  { s: '♥', red: true },
  { s: '♦', red: true },
  { s: '♣', red: false },
];

export const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
export const draw = (): Card => ({ ...pick(SUITS), r: pick(RANKS) });
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Blackjack total — face = 10, ace = 11 then 1 to avoid busting. */
export function total(cards: Card[]): number {
  let t = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.r === 'A') {
      aces += 1;
      t += 11;
    } else if (c.r === 'J' || c.r === 'Q' || c.r === 'K') {
      t += 10;
    } else {
      t += Number(c.r);
    }
  }
  while (t > 21 && aces > 0) {
    t -= 10;
    aces -= 1;
  }
  return t;
}

/** High-card value for War — ace high. */
export function highValue(r: string): number {
  if (r === 'A') return 14;
  if (r === 'K') return 13;
  if (r === 'Q') return 12;
  if (r === 'J') return 11;
  return Number(r);
}

export function PlayingCard({ card }: { card: Card }) {
  return (
    <span className={`cere-bj-card ${card.red ? 'cere-bj-red' : 'cere-bj-blk'}`}>
      <span className="cere-bj-rk">{card.r}</span>
      <span className="cere-bj-pip">{card.s}</span>
    </span>
  );
}
