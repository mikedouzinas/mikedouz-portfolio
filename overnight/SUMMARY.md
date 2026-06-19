# Overnight run — morning summary

Branch: **`feat/harlequin-overnight`** · **not pushed** · final integrated `npm run build` = ✅ exit 0.
Repo is public, so no vault/personal content is committed here (see "Vault" below).

---

## 1. Code that's ready to review & merge (7 fixes, each its own commit)

All verified with `tsc --noEmit` + `npm run build`. (`npm run lint` is **broken repo-wide** — a pre-existing `eslint-config-next@16` / `next@15` mismatch, unrelated to anything here. Worth its own ticket.)

| Ticket | What shipped | Files |
|---|---|---|
| **#58 + #60** | Consolidated the two Tailwind configs into `tailwind.config.ts` (the `.js` was the one Tailwind actually loaded — its `darkMode:'class'` + used colors + keyframes were merged in, nothing lost); removed dead `primaryBlue`/`accentOrange` tokens after confirming they're unreferenced. | `tailwind.config.ts`, deleted `tailwind.config.js` |
| **#59** | Docs-only: rewrote CLAUDE.md's accent-by-area mapping to match the actual code (indigo/teal/green/champagne). **No code colors changed** — if purple/blue was the *intended* design, that's a separate change (your call). | `CLAUDE.md` |
| **#65** | "Done" → "Complete"; added a checkbox left of the priority badge that shares the close handler (`completeIssue`) and stops propagation so it doesn't expand the card. | `IssueList.tsx` |
| **#69** | Save now absorbs a half-typed subtask (no more silent drop). | `IssueList.tsx` |
| **#72** | Detached-panel dropdowns no longer clip: the shared `Dropdown` flips upward + scrolls internally near the viewport bottom. | `Dropdown.tsx` |
| **#66** | Cere diff/summary lines now lead with `#number — title` (resolved client-side), even for multi-action turns. | `CerePanel.tsx`, `useCere.ts` |
| **#67** | Cere chat is an independent scroll context; only autoscrolls when pinned to bottom — proposals don't hijack scroll. | `IrisChat.tsx` |
| **#71** | Optimistic insert: the created issue (already returned by the POST) is merged into board state deduped on `repo#number` so it appears instantly; `no-store` hardening on the list fetch/response. **Note:** changed the `onApplied` signature → `(created: DevIssue[])`; callers updated. Worth a careful look since it's a shared callback. | `useCere.ts`, `CerePanel.tsx`, `dev/page.tsx`, `api/dev/issues/route.ts` |

### Propose closing (gated — run after you've reviewed)
```bash
cd ~/Downloads/Dev/mikedouz-portfolio
for n in 58 59 60 65 66 67 68 69 72; do npm run board -- done --repo mikedouzinas/mikedouz-portfolio --number $n --yes; done
# #71 too once you've sanity-checked the onApplied signature change:
# npm run board -- done --repo mikedouzinas/mikedouz-portfolio --number 71 --yes
```
*(#68 blackjack is also fixed — included above. Don't close any you want to re-test in the running app first.)*

---

## 2. Investigations — diagnosed, NOT auto-fixed (need your call)

Full write-ups in `overnight/investigations/`. The GitHub ticket bodies were also enriched.

- **#77 (P1) Cere phantom tool calls** — *root cause found.* Cere's natural-language reply is rendered verbatim and **fully decoupled** from whether a `tool_use` block fired, so it can narrate "done" with zero actions. Fix = prompt contract + a server-side guard (reply claims a change but `actions:[]` → rewrite). I did **not** auto-fix — it's prompt + trust-critical and you'll want eyes on the wording. → `77-cere-phantom-toolcalls.md`
- **Backlog enrichment** (feasibility + exact files + the key decision per ticket): `automation-backlog-enrichment.md` (#70/#57/#49/#36/#37/#11), `cere-capability-enrichment.md` (#73/#15/#55), `misc-feature-enrichment.md` (#53/#6/#54/#7/#28). Each has a paste-ready "Proposed ticket update" block. The decisive ones were also pushed onto the tickets as subtasks.
  - Two cross-cutting blockers worth knowing: **(a)** `github.ts` has no PR/commit/timeline reads and `DevIssue` drops `created_at` — #36/#49/#57/#70 all need those added first. **(b)** cron can't pass the `/api/dev/*` session gate, so scheduled jobs must call the lib directly via `CRON_SECRET`.
  - **#28** is bigger than it looks: **124 raw `<button>`s across 38 files.**

---

## 3. Design directions — ideas for you to pick from (nothing baked into the app)

In `overnight/design-ideas/`. Each has 2-3 distinct directions, ASCII wireframes, motion specifics, tradeoffs, and a recommendation. All honor the Harlequin theme constraints (champagne duotone, rainbow-flicker-only, Limelight, grid, no Marcellus).

- **#62 portal + the "little window"** → `62-portal-window-directions.md` — THE PEEPHOLE (rec.), FLIP-BOOK DOOR, MAGIC-LANTERN SLIDE.
- **#62 public entry transformation** (the thing you asked for mid-run — the hidden trigger morphing into the portal) → `62-public-entry-transform.md` — **THE SEAM** (rec.): the `·` becomes a 1px slit of light that morphs WARM → SPLIT → FRAME into the vault.
- **#76 / #48 / #50 Harlequin "world"** → `76-48-50-harlequin-world.md` — Lightbox Table (rec.), Ink Realms, Strata; a per-repo `RepoWorld` token model (repo = material, status = hue); "Lamp warm-up" loader.
- **#52 / #54 homepage panels** → `52-54-homepage-panels.md` — port the `IrisBubble` glass ("Seer") onto `the_web_card`; subsidiaries as an expandable glass drawer, not six peer cards.
- **#45 / #63 / #64 / #75 Cere & panel motion** → `cere-panel-motion-directions.md` — a shared `stage.ts` "spotlight rise" primitive (#45/#32 reuse it), press-IN spring for #63, "Center stage." placeholder for #64, title-first proposal rows for #75.
- **#74 moments** → `74-moments-directions.md` — content-agnostic (see Vault blocker).

### Portal lockups (open in a browser — not wired into the app)
`overnight/portal-lockups/` — open `index.html`. Three window/vault variants (A Framed Window, B Comic Iris, C Diamond Door) + `entry-flow/index.html` (the full hidden-trigger → window → vault flow). Step through states via the on-screen DEMO controls or type the password **`OPEN5`**.

---

## 4. Vault — ⚠️ blocker for #74

The Apollo vault (`~/Downloads/Dev/apollo-vault`) is an **empty, un-bootstrapped** Claudesidian starter — `/init-bootstrap` was never run; every PARA folder is empty. **There is no personal material to seed "moments" yet.** Before #74 can be real, you'll need to populate it (photos in `05_Attachments/`, a few dated notes, the per-summer songs). Working notes (kept OUT of this public repo): `~/Downloads/Dev/_overnight_private/vault-notes/moments-material.md`.

---

## 5. Loose ends I noticed
- **`npm run lint` is broken** (eslint-config-next@16 vs next@15) — probably worth a ticket; I relied on `build` + `tsc` all night.
- A few stray screenshots/artifacts are sitting untracked in the repo root (`loader-33.png`, `verify-*.png`, `sidebar-new.png`, `.playwright-mcp/`) — left them alone.
