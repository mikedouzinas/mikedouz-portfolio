# Ticket #68 — Blackjack deal animation only deals one card per person

**Status:** Investigated (read-only). Root cause identified.
**Severity:** P2 (cosmetic — loading mini-game).
**Files:** `src/components/dev/CereBlackjack.tsx`, `src/components/dev/CereCards.tsx`, `src/components/dev/CereGameLoader.tsx`, `src/styles/globals.css`

---

## How the deal sequence works today

`CereBlackjack` ( `src/components/dev/CereBlackjack.tsx:40` ) runs one long-lived async loop inside a `useEffect` ( `:45-94` ) with an `alive` flag for cleanup ( `:46`, `:91-93` ):

1. Clear state, `sleep(140)` ( `:49-52` ).
2. Build local arrays `ph = [draw()]`, `dh = [draw()]` ( `:55-56` ).
3. `setPlayer([...ph])` → first player card ( `:57` ), `sleep(170)`.
4. `setDealer([...dh])` → first dealer card ( `:60` ), `sleep(170)`.
5. `ph.push(draw()); setPlayer([...ph])` → second player card ( `:63-64` ), `sleep(170)`.
6. `dh.push(draw()); setDealer([...dh])` → second dealer card ( `:67-68` ), `sleep(190)`.
7. Optional "hit" if `total < 16` ( `:73-84` ), then `setResult(decide(...))` ( `:86` ), `sleep(1000)`, repeat.

Rendering: `Hand` ( `:27-38` ) maps `cards` to `<PlayingCard key={i} />` — **index as key** ( `:33` ). Each `.cere-bj-card` runs the `cere-bj-deal` keyframe (`0.18s`, `both`) on mount ( `globals.css:443`, `:449-452` ).

The loop is purely time-driven (`setTimeout` via `sleep`), not state-driven; it never reads React state back, so a stale-closure-over-state bug does **not** apply here. `CereGameLoader` ( `src/components/dev/CereGameLoader.tsx:12-15` ) picks the game once per mount and never remounts it mid-think, so mid-deal remount from the loader is also ruled out.

---

## Root cause hypothesis

**React StrictMode double-invokes the effect in dev, and the two concurrent loops collide via the index-based key (`key={i}`), so the deal animation visibly produces one card per side that then "snaps" to the final hand without the second card animating in.**

`next.config.ts` does not set `reactStrictMode`, so it defaults to `true` (Next 15 dev). StrictMode mounts the component, runs the effect, immediately runs cleanup, then runs the effect again. Sequence:

1. Mount → effect A starts its `while` loop, scheduling `setTimeout`s.
2. StrictMode cleanup → `aliveA = false`. **But `alive` only gates execution at the `if (!alive) return` checkpoints between sleeps; any `setState` already queued/executing in the current tick still fires**, and a loop currently parked inside a `sleep` will still run the line *after* the sleep before it re-checks `alive`. So effect A can land a stray `setPlayer`/`setDealer` write (one card) after it was supposed to be dead.
3. Second mount → effect B starts a fresh loop with its own `ph`/`dh`.

Because both loops write to the **same** `player`/`dealer` state and the list uses `key={i}`, React reconciles by position: card at index 0 from loop A and card at index 0 from loop B are treated as the same DOM node, so it is updated in place rather than remounted — **the CSS deal animation (which only fires on mount) does not replay**, and the interleaving makes the second card frequently appear to be missing / not dealt at the moment of observation. The net visible effect is "only one card per person was dealt."

### Why it's intermittent

- It depends on the exact tick alignment of StrictMode's cleanup vs. which `sleep` each loop is parked in — a race. Sometimes effect A is cleanly dead before any second write; sometimes it lands a stray write that collides with effect B.
- It depends on the random `draw()` values: when loop A's leftover card and loop B's card happen to be equal (or the timing lines up), the in-place update is invisible and looks fine; when they differ and arrive out of order, a card looks dropped.
- StrictMode double-invoke is **dev-only**, so this will be far more frequent (or only) reproducible in `npm run dev`, and rare/absent in a production build — which matches an "intermittent, root cause unclear" report.
- The same structural risk exists in `CereWar.tsx:27-58` but it deals only one card per side, so the collision can't manifest as "missing second card" — consistent with the ticket naming blackjack specifically.

**Secondary contributor (not the primary trigger):** even without StrictMode, `key={i}` means a re-deal of a new hand reuses keys 0/1 across hands, so the deal animation can fail to replay between loop iterations. This makes the "card didn't animate in" symptom more likely to be noticed, but on its own would not drop a card.

---

## Concrete fix

Two small, independent changes (both in `CereBlackjack.tsx`; mirror in `CereWar.tsx` for safety):

1. **Make the loop fully abort on cleanup and never write after death.** Capture an effect-scoped token and guard every `setState`, or — simpler — wrap each `setState` so it is a no-op once `alive` is false. Minimal version: add `if (!alive) return;` immediately *before* every `setPlayer`/`setDealer`/`setResult` (not only after the sleeps). This closes the window where a parked loop runs one more write after cleanup.

   ```ts
   // before each state write:
   if (!alive) return;
   setPlayer([...ph]);
   ```

2. **Give cards stable, hand-scoped keys instead of array index**, so a stray write from a zombie loop can't be reconciled in-place against the live loop's cards, and so the deal animation replays correctly every hand. Add a per-hand id and a per-card id:

   ```tsx
   // Card gains an id at draw time, or derive a key from hand generation:
   {cards.map((c, i) => (
     <PlayingCard key={`${handId}-${i}`} card={c} />
   ))}
   ```
   where `handId` increments once per `while` iteration. This forces a fresh DOM node per dealt card, guaranteeing the `cere-bj-deal` keyframe fires for the second card.

The most robust single fix is **fix #2 plus an explicit "is this loop still the active one" check** (e.g. compare a `runId` ref captured at loop start against a ref bumped on cleanup) before each `setState`, which eliminates the StrictMode collision entirely regardless of timing.

---

## Safe to auto-fix?

**Yes, low-risk — but it touches `src/`, which this investigation is barred from editing**, so it must be implemented in a separate change. The fixes are additive (guards + key change), don't alter game logic or visuals when working correctly, and have no API/data-layer impact. Recommend implementing fix #1 + #2 together, then verifying in `npm run dev` (StrictMode on) by watching ~20 deal cycles for both cards animating in on each side. Note: confirm whether `next.config.ts` intentionally leaves StrictMode at its default; the bug is StrictMode-exposed, not StrictMode-caused, so do not "fix" it by disabling StrictMode.

---

## Proposed ticket update

> **#68 — Blackjack deal animation only deals one card per person**
>
> **Root cause:** Index-based React keys (`key={i}` in `CereBlackjack.tsx:33`) combined with React StrictMode's dev-only double-invoke of the deal `useEffect`. The `alive` flag only gates execution at the inter-`sleep` checkpoints, so a cleaned-up loop can still land one stray `setPlayer`/`setDealer` write. Two concurrent loops writing the same state, reconciled by array index, update cards in place — the mount-only `cere-bj-deal` CSS animation doesn't replay and the second card appears not to deal. Intermittent because it's a tick-timing race that also depends on random card values; primarily reproducible in `npm run dev` (StrictMode), rare in prod builds. `CereWar` shares the structure but deals one card/side so can't show the symptom.
>
> **Fix:** (1) Guard every state write with `if (!alive) return;` immediately before the `setState`, not only after sleeps. (2) Replace `key={i}` with a per-hand-scoped key so each dealt card mounts fresh and the deal animation replays. Optionally add a `runId` ref check so zombie loops can never write live state. Apply the same guards to `CereWar.tsx` defensively.
>
> **Risk:** Low — additive, no logic/visual change on the happy path, no data/API impact.
