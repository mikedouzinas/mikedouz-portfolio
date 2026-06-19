'use client';

import { useEffect, useRef, useState } from 'react';
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

function Hand({ who, cards, handId }: { who: string; cards: Card[]; handId: number }) {
  return (
    <div className="cere-bj-side">
      <span className={`cere-bj-who ${cards.length ? 'cere-bj-who-on' : ''}`}>{who}</span>
      <div className="cere-bj-hand">
        {cards.map((c, i) => (
          // Hand-scoped stable key so each dealt card mounts fresh and its
          // mount-only `cere-bj-deal` animation replays (see ticket #68).
          <PlayingCard key={`${handId}-${i}`} card={c} />
        ))}
      </div>
    </div>
  );
}

export function CereBlackjack() {
  const [dealer, setDealer] = useState<Card[]>([]);
  const [player, setPlayer] = useState<Card[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [handId, setHandId] = useState(0);
  // Bumped on every effect run; a torn-down loop reads its own captured id and
  // refuses to write once a newer run has started (kills StrictMode zombies).
  const runIdRef = useRef(0);

  useEffect(() => {
    let alive = true;
    const myRun = ++runIdRef.current;
    // Live only if this loop owns the current run and wasn't cleaned up.
    const live = () => alive && runIdRef.current === myRun;
    (async () => {
      let hid = 0;
      while (live()) {
        if (!live()) return;
        setHandId(hid);
        if (!live()) return;
        setResult(null);
        if (!live()) return;
        setDealer([]);
        if (!live()) return;
        setPlayer([]);
        await sleep(140);
        if (!live()) return;

        const ph = [draw()];
        const dh = [draw()];
        if (!live()) return;
        setPlayer([...ph]);
        await sleep(170);
        if (!live()) return;
        setDealer([...dh]);
        await sleep(170);
        if (!live()) return;
        ph.push(draw());
        if (!live()) return;
        setPlayer([...ph]);
        await sleep(170);
        if (!live()) return;
        dh.push(draw());
        if (!live()) return;
        setDealer([...dh]);
        await sleep(190);
        if (!live()) return;

        // a quick hit for a low hand, for drama
        if (total(ph) < 16) {
          ph.push(draw());
          if (!live()) return;
          setPlayer([...ph]);
          await sleep(200);
          if (!live()) return;
        }
        if (total(dh) < 16) {
          dh.push(draw());
          if (!live()) return;
          setDealer([...dh]);
          await sleep(200);
          if (!live()) return;
        }

        if (!live()) return;
        setResult(decide(ph, dh));
        await sleep(1000);
        if (!live()) return;
        hid += 1;
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="cere-bj" aria-live="polite" aria-label="Cere is thinking">
      <div className="cere-bj-table">
        <Hand who="Cere" cards={dealer} handId={handId} />
        <Hand who="You" cards={player} handId={handId} />
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
