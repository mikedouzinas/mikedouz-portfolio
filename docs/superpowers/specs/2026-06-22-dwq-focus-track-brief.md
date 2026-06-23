# Execution brief — Harlequin virtual-items layer in Supabase (the core slice)

**Date:** 2026-06-22 (rev 2) · **For:** a focused build session (cloud or local) · **Author:** Iris (vault)

> Rev 2 supersedes rev 1. Rev 1 proposed a local-file read of the Deep Work Queue. Mike corrected this: he wants the **real Supabase items layer**, fully remote/cloud, so Claude can fetch + add items from anywhere. That is the goal. This is the core slice of `2026-06-20-harlequin-vault-project-connection-design.md`, not a hack around it.

## Goal (Mike's words, 2026-06-22)
A Supabase data store of **items related to projects that matter to Mike** — not just code. Non-code items: Deep Work Queue entries, ideas, to-dos, whatever. Claude (from the vault session or a cloud session) can **fetch and add** items, and items can **cross-reference** vault notes. The board renders them. *"That's the only goal of it."*

## In scope (build this)
1. **`dev_projects`** table (Supabase) — one row per project, `kind = 'virtual'` for non-code. Fields per the 6/20 spec: `id, name, kind, vault_path (nullable), iris_visible (default false), created_at`. (Code projects keep using GitHub Issues — untouched.)
2. **`dev_items`** table — items under a project: `id, project_id (FK), title, body (markdown, supports `- [ ]` subtasks), status (todo|in_progress|done), size (S|M|L), vault_ref (relative path to originating vault note, nullable), created_at, updated_at, closed_at`.
3. **Vault ↔ site API** (the fetch/add surface) — small authenticated endpoints under the existing `/api/dev/*` boundary, reusing the **owner-only** security model already in place:
   - create a virtual project, add an item, fetch items for a project, update item status. Read + write.
4. **Board read side** — render virtual projects + their `dev_items` in the existing Harlequin Kanban (todo / in progress / done lanes), alongside the code-repo lanes. Show an `iris_visible` badge so exposure is always obvious.
5. **Vault on-ramp** — teach Claude-in-the-vault (CLAUDE.md note + skill if it grows) to call the API: create a project, add/fetch items, and write the `vault_ref` back into the originating note so note ↔ item point at each other.

## Security model (non-negotiable — Mike: "very, very secure, everything crucial to me")
- **Default private.** `iris_visible` defaults false. Nothing crosses to the public site or Iris's public context unless explicitly flagged. (That flagged/public flow is OUT of scope here anyway — see below.)
- **Owner-only auth** on every write/read endpoint (reuse the existing `/api/dev/*` owner model).
- **Only deliberately-added items live in Supabase.** The vault as a whole never syncs to Supabase. The vault stays the local authority; Supabase holds only the items Mike/Claude explicitly push. No whole-vault mirror, ever.

## Out of scope (genuine extras — defer, name them in the PR, don't silently add)
- **Artifacts / Supabase Storage** (e.g. the Vol 3 cover). Later.
- **Public exposure:** `iris_visible: true` flow into Iris's *public* KB context, and `page_id` linking to public `projects.json`. Later — these touch the public site, keep them off this slice.
- Editing item *bodies* from the board UI (status changes are fine; full editing later).
- Migrating any code-repo tickets off GitHub Issues. Never in this project.

## First end-to-end test (proves the loop)
1. From the vault, create the **Deep Work Queue** as a virtual project (`kind: virtual`, `vault_path` → the DWQ file/folder, `iris_visible: false`).
2. Add a few real entries from `Deep Work Queue.md` as `dev_items` (a couple marked `done`), each with a `vault_ref` back to the queue.
3. Confirm: the board (even deployed, since it's now Supabase-backed) shows the project with its items, and a cloud Claude session can both **fetch** those items and **add** a new one. If fetch + add + render all work, the slice is done.

## Files to read first (orient before building)
- `docs/superpowers/specs/2026-06-20-harlequin-vault-project-connection-design.md` — the full design; build its core (above), not its extras.
- `docs/superpowers/plans/2026-06-08-secret-dev-console-phase-1-2.md` — how the existing Harlequin board + `/api/dev/*` + auth are built.
- `src/components/dev/harlequin/` and `src/components/dev/Harlequin*.tsx` — board/card components to extend.
- `.claude/skills/harlequin-board/SKILL.md` — existing board conventions (GitHub-Issues side).

## Done criteria
- `dev_projects` + `dev_items` exist in Supabase with owner-only API access.
- Vault Claude can create a virtual project, add items, fetch items (verified with the DWQ test above).
- The Harlequin board renders virtual projects + items alongside code repos, with an `iris_visible` badge.
- No regression to the GitHub-Issues code board. No artifacts, no public exposure, no whole-vault sync.
