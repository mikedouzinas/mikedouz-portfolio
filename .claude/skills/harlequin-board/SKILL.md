---
name: harlequin-board
description: Use when reading, filing, updating, sizing, or triaging tickets on THE HARLEQUIN — Mike's private dev board at /dev on mikeveson.com. The board is plain GitHub Issues with a label convention; this skill gives the conventions and a CLI (npm run board) so agent-filed tickets are identical to ones filed in the UI or by Cere.
---

# THE HARLEQUIN board

THE HARLEQUIN is Mike's hidden dev board (the `/dev` page). **It is just GitHub
Issues** on his owned repos — no separate database. A ticket is an issue; its
priority, status, and size are *labels*; its subtasks are a markdown checklist in
the body; "Done" means the issue is **closed**. Cere (the in-app AI filer) and the
website both read/write through `src/lib/dev/github.ts` — and so does the CLI
below, so anything you file is indistinguishable from a UI-filed ticket.

## Conventions (must match exactly)

| Field | Encoding |
|---|---|
| Priority | label `p1`…`p5` (p1 = highest). Default `p3`. |
| Status | label `status: todo` or `status: in progress`. Default `todo`. |
| **Done** | the issue is **closed** (there is no "done" label). |
| Size | label `size: S` / `size: M` / `size: L`. Default `M`. S ≈ <1h, M ≈ a feature/half-day, L ≈ large/multi-day. **Always set one.** |
| Subtasks | a `- [ ]` / `- [x]` task list inside the issue body. |

Body shape: prose description on top, then a blank line, then the checklist.

## The CLI

Run from the repo root (needs `GITHUB_TOKEN` in `.env.local`):

```bash
# Read the board (open issues + recently-closed). Add --json for machine parsing.
npm run board -- list [--repo <owner/name>] [--state open|closed|all] [--json]

# File a ticket (one --subtask per checklist item).
npm run board -- file --repo <owner/name> --title "…" \
  [--priority p2] [--status todo] [--size M] [--body "…"] \
  [--subtask "first step"] [--subtask "second step"]

# Update fields. --add-subtask appends; --body replaces the whole body.
npm run board -- update --repo <owner/name> --number N \
  [--title "…"] [--priority p1] [--status "in progress"] [--size L] \
  [--body "…"] [--add-subtask "…"]

# Mark Done = close + tick the whole checklist. GATED (see Policy).
npm run board -- done --repo <owner/name> --number N --yes
```

The CLI reuses the site's label logic, so it ensures the `p*` / `status:` /
`size:` labels (with colors) exist per repo automatically. Repos are validated
against Mike's *owned* repos — it refuses anything else.

Equivalent `gh` works too (the board is just issues): `gh issue list --label p1`,
`gh issue edit N --add-label "status: in progress"`, `gh issue close N`. Prefer the
CLI for *filing/updating* so labels and subtask formatting stay consistent.

## Policy

- **File, update, re-prioritize, resize, add subtasks, move to in-progress** — do
  these freely as you work; keeping the board current is the whole point.
- **Closing a ticket (`done`) is gated.** Get Mike's explicit OK first, then run
  with `--yes`. The CLI refuses to close without it. Likewise never *delete* an
  issue without asking.
- When you ship something that resolves a ticket, **say so and propose closing it
  with the `done --yes` command** — don't close it silently.
- One logical change per ticket; mirror the existing tone of the board's titles
  (imperative, specific, no emojis).

## When you finish work tied to a ticket

1. `npm run board -- list --repo <repo>` to find the number.
2. If subtasks were completed, tick them: `update --add-subtask` is for *adding*;
   to check items off, pass an edited `--body` (or just close, which ticks all).
3. Tell Mike it's ready and give him the exact `done --repo … --number … --yes`.
