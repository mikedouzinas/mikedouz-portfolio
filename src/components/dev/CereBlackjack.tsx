'use client';

import { useEffect, useState } from 'react';
import { type Card, draw, sleep, total, PlayingCard } from './CereCards';

/**
 * One of Cere's "thinking" card games: a very quick blackjack hand dealt against
 * you, looping until the answer streams in. Cards deal in; a win/loss flashes.
 * Styling: `.cere-bj-*` in globals.css.
 */

type Result = { tag: string; cls: string; chip: string };

function decide(player: Card[], dealer: Card[]): Result {
  const pv = total(player);
  const dv = total(dealer);
  const pBust = pv > 21;
  const dBust = dv > 21;
  if (pBust && dBust) return { tag: 'Push', cls: 'cere-bj-push', chip: `${pv} / ${dv}` };
  if (pBust) return { tag: 'Cere wins', cls: 'cere-bj-cere', chip: `you bust · ${pv}` };
  if (dBust) return { tag: 'You win', cls: 'cere-bj-you', chip: `Cere bust · ${dv}` };
  if (pv > dv) return { tag: 'You win', cls: 'cere-bj-you', chip: `${pv} vs ${dv}` };
  if (dv > pv) return { tag: 'Cere wins', cls: 'cere-bj-cere', chip: `${dv} vs ${pv}` };
  return { tag: 'Push', cls: 'cere-bj-push', chip: `${pv} all` };
}

function Hand({ who, cards }: { who: string; cards: Card[] }) {
  return (
    <div className="cere-bj-side">
      <span className="cere-bj-who">{who}</span>
      <div className="cere-bj-hand">
        {cards.map((c, i) => (
          <PlayingCard key={i} card={c} />
        ))}
      </div>
    </div>
  );
}

export function CereBlackjack() {
  const [dealer, setDealer] = useState<Card[]>([]);
  const [player, setPlayer] = useState<Card[]>([]);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      while (alive) {
        setResult(null);
        setDealer([]);
        setPlayer([]);
        await sleep(140);
        if (!alive) return;

        const ph = [draw()];
        const dh = [draw()];
        setPlayer([...ph]);
        await sleep(170);
        if (!alive) return;
        setDealer([...dh]);
        await sleep(170);
        if (!alive) return;
        ph.push(draw());
        setPlayer([...ph]);
        await sleep(170);
        if (!alive) return;
        dh.push(draw());
        setDealer([...dh]);
        await sleep(190);
        if (!alive) return;

        // a quick hit for a low hand, for drama
        if (total(ph) < 16) {
          ph.push(draw());
          setPlayer([...ph]);
          await sleep(200);
          if (!alive) return;
        }
        if (total(dh) < 16) {
          dh.push(draw());
          setDealer([...dh]);
          await sleep(200);
          if (!alive) return;
        }

        setResult(decide(ph, dh));
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
        <Hand who="Cere" cards={dealer} />
        <Hand who="You" cards={player} />
      </div>
      <div className={`cere-bj-res ${result ? 'cere-bj-show' : ''}`}>
        {result && (
          <>
            <span className={`cere-bj-tag ${result.cls}`}>{result.tag}</span>
            <span className="cere-bj-chip">{result.chip}</span>
          </>
        )}
      </div>
    </div>
  );
}
