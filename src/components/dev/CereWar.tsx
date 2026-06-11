'use client';

import { useEffect, useState } from 'react';
import { type Card, draw, sleep, highValue, PlayingCard } from './CereCards';

/**
 * One of Cere's "thinking" card games: War — one card each, high card wins,
 * looping until the answer arrives. Shares the blackjack table/card styling.
 */

type Result = { tag: string; cls: string };

function Slot({ who, card }: { who: string; card: Card | null }) {
  return (
    <div className="cere-bj-side">
      <span className={`cere-bj-who ${card ? 'cere-bj-who-on' : ''}`}>{who}</span>
      <div className="cere-bj-hand">{card && <PlayingCard card={card} />}</div>
    </div>
  );
}

export function CereWar() {
  const [dealer, setDealer] = useState<Card | null>(null);
  const [player, setPlayer] = useState<Card | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      while (alive) {
        setResult(null);
        setDealer(null);
        setPlayer(null);
        await sleep(160);
        if (!alive) return;

        const p = draw();
        const d = draw();
        setPlayer(p);
        await sleep(230);
        if (!alive) return;
        setDealer(d);
        await sleep(260);
        if (!alive) return;

        const pv = highValue(p.r);
        const dv = highValue(d.r);
        if (pv > dv) setResult({ tag: 'You win', cls: 'cere-bj-you' });
        else if (dv > pv) setResult({ tag: 'Cere wins', cls: 'cere-bj-cere' });
        else setResult({ tag: 'War!', cls: 'cere-bj-push' });
        await sleep(1000);
        if (!alive) return;
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="cere-bj" aria-live="polite" aria-label="Cere is thinking">
      <div className="cere-bj-table">
        <Slot who="Cere" card={dealer} />
        <Slot who="You" card={player} />
      </div>
      <div className={`cere-bj-res ${result ? 'cere-bj-show' : ''}`}>
        {result && <span className={`cere-bj-tag ${result.cls}`}>{result.tag}</span>}
      </div>
    </div>
  );
}
