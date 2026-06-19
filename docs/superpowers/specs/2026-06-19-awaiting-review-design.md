# Awaiting Review — design spec

**Ticket:** #79 · **Date:** 2026-06-19 · **Status:** approved design, pending spec review

## Problem

THE HARLEQUIN board is increasingly agent-driven: Mike hands a ticket to an agent, the
agent finishes, and the work then sits in a hand-back state that the board can't express
(`todo` / `in progress` / closed=Done). Two costs:

1. **No organization** for finished-but-unreviewed work — it either looks still-in-progress
   or gets closed prematurely.
2. **Review is manual and link-hunting** — today Mike opens Claude Code, asks "what did we
   do," and asks for a link per item to go look at it.

## Goal

A small, GitHub-native **Awaiting Review** state that (a) groups handed-off work in its own
board section, and (b) gives each item a **link Mike can press to test the running feature
live**. The live-test link is the primary value; everything else is organization.

## Non-goals (v1)

- No Supabase tables, no webhooks, no elaborate "review packet" data model.
- No required PRs (the GitHub-native/PR-webhook path is a deliberate later layer).
- No auto-triggering of the next agent on approve.

## Decisions (from the 2026-06-19 brainstorm)

- **Name:** "Awaiting Review" (not "Waiting Review").
- **Scope:** layered (C). Ship the light version now; the live-preview link is IN v1 (it's
  the value), not deferred.
- **Bridge:** agent-driven (A) — the finishing agent flips status + attaches the link as its
  last step. Designed so a GitHub-native/PR-webhook trigger (B) can plug in later.
- **Live target:** per-feature Vercel **branch preview** — each ticket's work is on its own
  branch; pushing it yields an isolated preview URL. Agents pushing feature branches is
  acceptable (the branches aren't linked anywhere; `/dev` stays password-gated).
- **Packet is trimmed** to: the Test link + a one-line "what to test". No rich format.

## Design

### 1. Status model
Add a third status to the existing label convention:
`status: todo → status: in progress → status: awaiting review → (closed = Done)`.
- `src/lib/dev/github.ts`: add `awaiting review` to the status label set + color in the
  ensure-labels logic.
- `scripts/board.ts` (CLI): `--status "awaiting review"` accepted by `update`.
- harlequin-board skill: document the new status + the handoff convention (below).
"Done = closed" is unchanged.

### 2. Review link + note (stored on the issue)
The handoff writes a small, marker-delimited block into the **issue body** (no new storage),
which the CLI edits *only between the markers* so it never clobbers the rest of the body:

```
<!-- awaiting-review:start -->
**Preview:** <vercel-preview-url>
**What to test:** <one line>
<!-- awaiting-review:end -->
```

The board UI parses this block to render the Test button + note. If richer packets are ever
needed, this graduates to a `dev_reviews` Supabase table — out of scope for v1.

### 3. Getting the preview URL
On handoff the agent has already pushed the feature branch, so a Vercel branch preview
exists. The URL is obtained by (in order of preference):
1. **Branch-alias URL** — Vercel's deterministic per-branch alias
   (`<project>-git-<sanitized-branch>-<scope>.vercel.app`). Cheapest; no API call.
2. **Fallback:** query the latest deployment for the branch via the Vercel API / `vercel`
   CLI, or read the commit's deployment status via `gh api`.
**Implementation must verify the exact alias pattern + that branch previews are enabled**
against the real Vercel project settings before relying on (1).

### 4. Board UI
A pinned **Awaiting Review** lane at the top of the board (above In Progress). Each card:
- renders the "what to test" note inline + a **Test ↗** button opening the preview URL;
- **Approve → Done** — closes the issue (Mike is the actor, so the normal close path);
- **Send back** — opens an **in-app feedback textarea**; on submit it returns the ticket to
  `status: in progress` and **posts the feedback as a GitHub issue comment** (timestamped,
  non-destructive — a real history the next agent reads). The board **surfaces the latest
  review feedback inline** on the card so an item that's bounced back shows why. No feedback
  DB — GitHub comments are the store.

In-app feedback is a first-class part of the loop (Mike's requirement): the card tells him
**what to test**, he tests via **Test ↗**, and he replies right there with **Send back**.

Touches `src/components/dev/IssueList.tsx` (grouping + packet renderer + the feedback box) and
`src/app/dev/page.tsx` (approve / send-back handlers). Backend: the approve/send-back +
comment-post + latest-comment-read go through the owner-only `/api/dev/*` boundary; add a
comment read/post helper to `src/lib/dev/github.ts` (the board's GitHub client).

### 5. Automation hook (agent handoff)
A new convenience command makes handoff one step and becomes a **hard rule** in the
harlequin-board skill — every agent runs it as its last step on a ticket:

```
npm run board -- handoff --repo <r> --number <n> \
  --preview <url|--auto> --test "what to test"
```
It (a) sets `status: awaiting review`, (b) writes the marker block (§2). `--auto` resolves
the preview URL via §3. This is the "it just shows up for me" behavior — no webhooks.

### 6. Later layer (designed-for, not built)
GitHub-native trigger: a PR referencing the issue → Awaiting Review via webhook; merge →
Done; Vercel's PR preview URL captured automatically. Slots in once the agentic-PR flow
(#70) matures; the §2 block and §4 UI don't change.

## Build surfaces (summary)
- `src/lib/dev/github.ts` — status label + color; read latest issue comment + post a comment.
- `scripts/board.ts` — `--status "awaiting review"`, new `handoff` command, `--auto` URL resolve.
- `src/components/dev/IssueList.tsx` — Awaiting Review lane + packet renderer + actions.
- `src/app/dev/page.tsx` (+ `/api/dev/issues` if needed) — approve / send-back handlers.
- `.claude/skills/harlequin-board/SKILL.md` — document status + mandatory handoff step.

## Risks / open questions
- **Vercel alias pattern** — must be verified against the live project (the one real unknown).
- **Branch hygiene** — many pushed feature branches accumulate; consider a cleanup convention
  (delete branch on Approve→Done). Minor.
- **Marker-block editing** — must be robust to a missing/duplicated block (idempotent upsert).
