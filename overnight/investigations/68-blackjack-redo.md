# Ticket #68 — Redo investigation: "one card per person, higher wins"

**Status:** Root cause re-identified (read-only). Previous fix was addressing the wrong component.
**Severity:** P2 (cosmetic — Cere loading mini-game UX).
**Files examined:**
- `src/components/dev/CereGameLoader.tsx` — game selection
- `src/components/dev/CereWar.tsx` — War game
- `src/components/dev/CereBlackjack.tsx` — Blackjack game
- `src/components/dev/CereCards.tsx` — shared card primitives
- `src/styles/globals.css` (lines 392–472) — `.cere-bj-*` styles + `cere-bj-deal` keyframe

---

## How game selection works

`CereGameLoader` (`src/components/dev/CereGameLoader.tsx:10–14`) holds exactly two games:

```ts
const GAMES = [CereBlackjack, CereWar];
const [Game] = useState(() => GAMES[Math.floor(Math.random() * GAMES.length)]);
return <Game />;
```

Selection is 50 / 50, chosen once per component mount (i.e. once per Cere message). There is no label, banner, or any other UI differentiating which game was selected — both render inside the same `cere-bj` / `cere-bj-table` wrapper with the same "Cere" / "You" labels.

---

## What CereWar actually does

`CereWar` (`src/components/dev/CereWar.tsx:22–71`) runs a loop that:

1. Clears state, `sleep(160)`.
2. Draws **one card** for the player (`draw()`), sets `player`.
3. `sleep(230)`.
4. Draws **one card** for the dealer, sets `dealer`.
5. `sleep(260)`.
6. Compares them with `highValue()` (ace-high, no face/bust logic).
7. Sets result: `"You win"`, `"Cere wins"`, or `"War!"`.
8. `sleep(1000)`, repeat.

**This is one card per person, and whoever has the higher card wins. That is the intended War rules, faithfully implemented.**

---

## What CereBlackjack actually does

`CereBlackjack` (`src/components/dev/CereBlackjack.tsx:42–134`) runs a loop that deals two cards to each side, optionally hits on `total < 16`, then computes a full blackjack outcome with bust logic. It correctly produces a multi-card deal.

The first fix attempt (adding `handId`-scoped keys and a `runIdRef` guard) is visible in the current file at lines 35, 46–55. These changes are structurally correct for Blackjack's own deal animation — they do fix the React StrictMode double-invoke issue that the original investigation identified. **But they cannot fix the symptom Mike is reporting**, because Mike's symptom is War behavior, and Blackjack was never the broken component.

---

## Real root cause

**Mike is seeing the War game and not recognizing it as a distinct game.**

Both games render with identical chrome: same `cere-bj` wrapper, same "Cere" / "You" labels, same card style. The only difference is the number of cards dealt and the result logic — and since War always deals exactly one card per side and resolves with "higher card wins," it is **indistinguishable from a severely broken Blackjack** to someone who doesn't know War is in the rotation.

The 50/50 random selection means this happens roughly half the time. There is no UI indicator that the game is War vs. Blackjack, so every War round reads as "the animation only dealt one card and then it just said who won."

This is not a code bug in the game logic of either game. It is a **UX/product bug**: War was added to the loader (`CereWar` was imported and added to the `GAMES` array), but the user-facing presentation was never updated to communicate which game is running.

---

## Why the first fix missed

The original investigation (`68-blackjack-deal-bug.md`) correctly identified a real React StrictMode key-based animation bug in `CereBlackjack.tsx` — but that bug explains only the "deal animation doesn't replay cleanly between hands" symptom. It does not explain "only one card per person, higher card wins," which is War game behavior, not broken Blackjack behavior.

The first fix correctly patched `CereBlackjack.tsx` for the animation issue. It left `CereWar.tsx` and `CereGameLoader.tsx` untouched. Because the user's reported symptom is actually caused by War (not Blackjack), patching Blackjack had zero impact on the observable behavior.

---

## Concrete fix

There are two valid approaches, depending on the intended product direction:

### Option A — Label the active game (minimal, recommended)

Add a small game-name indicator to `CereGameLoader` or pass a `label` prop through to the shared `cere-bj` wrapper so users can read "War" vs. "Blackjack." This requires no logic changes:

```tsx
// CereGameLoader.tsx
const GAME_LABELS: Map<typeof CereBlackjack | typeof CereWar, string> = new Map([
  [CereBlackjack, 'Blackjack'],
  [CereWar, 'War'],
]);

export function CereGameLoader() {
  const [Game] = useState(() => GAMES[Math.floor(Math.random() * GAMES.length)]);
  const label = GAME_LABELS.get(Game) ?? '';
  return (
    <div>
      {label && <span className="cere-game-label">{label}</span>}
      <Game />
    </div>
  );
}
```

Add `.cere-game-label` to `globals.css` styled like the other micro-labels (e.g., 8px, champagne, uppercase, letter-spaced).

### Option B — Remove War from the rotation

If War is intentionally supposed to look like Blackjack (i.e. it was added as a simpler placeholder but is not meant to be player-visible as its own game), remove it from `GAMES`:

```ts
// CereGameLoader.tsx
const GAMES = [CereBlackjack]; // War removed — one card/high card reads as broken Blackjack
```

This is the smallest possible change but throws away the War variant entirely.

### Option C — Make War visually distinct

Keep War but add a different result label or color treatment that makes it obviously a different game (e.g., banner says "WAR — high card wins" at the top of the table on first render). More work but the best UX.

**Recommended: Option A** — one-liner label in `CereGameLoader`, with a small CSS class. Low risk, preserves both games, resolves the "what am I even looking at?" confusion.

---

## Notes on CereWar's deal loop

`CereWar.tsx` has no `runIdRef` guard (unlike the patched `CereBlackjack.tsx`), which means it has the original React StrictMode double-invoke exposure. However, since War deals only one card per side, the collision cannot manifest as "missing second card." The symptom is still "one card per person, higher wins" in both StrictMode and production — which is correct War behavior either way. No animation fix is needed in `CereWar.tsx` for this ticket; the StrictMode guard could be added defensively but is not the cause of the reported bug.

---

## Summary

| Hypothesis | Correct? |
|---|---|
| Blackjack short-deals due to StrictMode | Only partially — this was a real but separate animation bug in `CereBlackjack.tsx`. Not what Mike is reporting. |
| War is selected and Mike sees it as broken Blackjack | **Yes — this is the real root cause.** |
| Game-selection bug (intends Blackjack but renders War) | No — selection is intentional; the issue is the two games are visually identical. |

**Fix:** Add a game-name label in `CereGameLoader.tsx` so War rounds are clearly identified as War (Option A), or remove War from the rotation (Option B).
