# Harlequin ↔ Vault ↔ Page — virtual projects & connection layer

**Ticket:** TBD (to be filed on THE HARLEQUIN) · **Date:** 2026-06-20 · **Status:** approved design, pending spec review

## North star (long-term vision)

THE HARLEQUIN is meant to become a place where Mike can capture and **re-enter** a thought,
an idea, or a *moment* — something he wants to keep exploring or "keep feeling again," not
just a task tracker. The work in this spec is the first concrete step toward that: giving
non-code, vault-originated work a home on the board, and tying it back to the live
mikeveson.com projects so there's **continuity across the vault, the board, and the page**.

## Problem

Three things that should be one connected thing are siloed:

1. **The MV Vault** (`the-mv-vault`, iCloud) — where the real, often non-technical work and
   notes live (deep-work queue, the Lantern, writing). Private.
2. **THE HARLEQUIN** (`/dev`, GitHub Issues, behind auth) — tracks work, but only for code
   repos. Has no way to represent non-code projects.
3. **The live page** (`projects.json` entries like `proj_lantern` + Iris's KB) — the public
   description of a project, with no link back to the work that produced it.

Concrete motivating case: a **Volume 3 cover** for the Lantern has no home except scattered
Lantern notes. There's nowhere to put an artifact, and no way for the board to track the
Lantern at all (it isn't a code repo).

## Goal

A **connection / identity layer** (not a publishing pipeline) so a single project — e.g. the
Lantern — is the *same known thing* across the vault, the board, and the page. Non-code
("virtual") projects can live on the board with their own items; artifacts (like the cover)
get a real home tied to the project; and a project's Done-item history can flow into **Iris's
context** so Iris can speak to "what's recent" when asked.

The value the user cares about, in order: (1) connection/continuity across the three; (2)
artifacts getting a home; (3) Done history feeding Iris context. A public changelog is **not**
a priority.

## Non-goals (v1)

- No public "Recently shipped / changelog" UI on project pages. (Iris context is the surface,
  not a public list.)
- No nested sections within a project — the model is flat `project → items`.
- No migration of existing code-repo tickets off GitHub Issues. Code projects are untouched.
- No creating projects from the board (deliberate — see Decisions).

## Decisions (from the 2026-06-20 brainstorm)

- **Virtual projects.** A new "project" concept can be either a real code repo OR a virtual
  non-code project. The Supabase project row *is* the connection layer.
- **Store split (and the actual reason).** Code projects keep using **GitHub Issues** (the
  site board, `npm run board` CLI, Cere, PATCH routes, subtask convention all already speak
  it — rebuilding that elsewhere would be pure cost). Virtual / vault-originated projects use
  **Supabase**, because that work originates in the vault and isn't code, has no natural repo,
  and — critically — the site is remote/public (Vercel) while the vault is local (iCloud), so
  a network-accessible store must sit at the boundary regardless. Supabase already is that
  store. This is *not* a violated single-source-of-truth principle: it's matching the store to
  where the work actually lives. (The real cost of multiple stores is sync drift; here each
  item has exactly one home, so there's no drift.)
- **Creation asymmetry (load-bearing).**
  - **Projects** are created **only from the vault.** The vault is the authority for what
    projects exist, because that's where the real work originates. The board can never spawn a
    new project.
  - **Items** can be added from **either** side — the vault or the board/Cere — for *existing*
    projects, exactly like adding tickets to an existing repo today.
- **Default private.** Everything is behind the `/dev` auth wall by default. Nothing crosses
  to the public site or Iris unless a per-project `iris_visible` flag is turned on. (Mike
  flagged this explicitly: mikeveson.com is public, so the boundary must be deliberate.)
- **Artifacts in Supabase Storage** so the vault can upload without a git commit/deploy.

## Design

### Data model

**`dev_projects`** (the connection layer — one row per project):

| field          | notes                                                                 |
| -------------- | --------------------------------------------------------------------- |
| `id`           | stable project id                                                     |
| `name`         | display name                                                          |
| `kind`         | `code` \| `virtual`                                                    |
| `vault_path`   | folder path inside `the-mv-vault` (nullable)                          |
| `page_id`      | `projects.json` id, e.g. `proj_lantern` (nullable)                    |
| `repo`         | `owner/name` for code projects (nullable)                             |
| `label`        | GitHub label scoping issues to this project, if sharing a repo (nullable) |
| `iris_visible` | boolean, **default false** — gates flow into Iris/public             |
| `created_at`   |                                                                       |

**`dev_items`** (virtual-project items only; code projects use GitHub Issues):

| field          | notes                                                  |
| -------------- | ------------------------------------------------------ |
| `id`           |                                                        |
| `project_id`   | FK → `dev_projects.id`                                  |
| `title`        |                                                        |
| `body`         | markdown (supports the existing `- [ ]` subtask convention) |
| `status`       | `todo` \| `in_progress` \| `done`                      |
| `size`         | `S` \| `M` \| `L` (matches the board's existing axis)   |
| `vault_ref`    | relative path to the originating vault note (nullable) |
| `created_at` / `updated_at` / `closed_at` |                             |

**`dev_artifacts`** (e.g. the Vol 3 cover):

| field        | notes                                          |
| ------------ | ---------------------------------------------- |
| `id`         |                                                |
| `project_id` | FK → `dev_projects.id`                          |
| `kind`       | e.g. `cover`                                    |
| `url`        | Supabase Storage URL                           |
| `caption`    | nullable                                        |

### Board (read side)

The Harlequin renders virtual projects alongside code repos in the same Kanban
(`todo` / `in progress` / done lanes). A unified read layer merges two sources: GitHub Issues
(code) and `dev_items` (virtual). Each project shows an `iris_visible` badge so it's always
obvious what is exposed beyond the wall. **Cere and the board UI can add items to an existing
virtual project, but the "new project" affordance is absent for virtual projects** (creation
is vault-only).

### Vault on-ramp (write side)

Vault **CLAUDE.md** (plus a skill if it grows) teaches Claude-in-the-vault to:

- **Create a project** → insert a `dev_projects` row and wire the links (`vault_path`,
  `page_id`, optional `repo`/`label`). Vault-only authority.
- **Add an item** → insert a `dev_item` under the right project, and write a `vault_ref` back
  into the originating vault note so the note and the board item point at each other.

Writes go through a small authenticated site API (the vault is a client of mikeveson.com's
existing `/api/dev/*` boundary; reuse the owner-only security model already in place).

### Iris flow

For projects with `iris_visible: true`, that project's Done-item history (and artifacts like
the cover) are included in Iris's KB context, so Iris can answer "what's recent on the
Lantern" with real changelog detail. Projects with `iris_visible: false` are never visible to
Iris. Per [[feedback_keep_kb_updated]], the `proj_lantern` entry in `projects.json` is the
page anchor for the Lantern.

## First end-to-end slice (the cover)

The Volume 3 cover is the natural first vertical test:

1. Create/confirm the **Lantern** as a virtual project in `dev_projects`
   (`page_id: proj_lantern`, `vault_path` → the Lantern folder, `iris_visible: true`).
2. Upload the **Vol 3 cover** to Supabase Storage and attach it as a `dev_artifact`.
3. Add a few real Lantern items (some Done) from the vault so the board shows the project with
   history, and Iris can speak to it.

This proves the whole loop — vault-created project, an artifact with a home, items from both
sides, and Iris context — on one concrete, motivating case.

## Open questions for spec review

- Should `dev_items` and the existing GitHub-Issues board share one UI component, or is a
  thin adapter per source cleaner?
- Exact shape of the vault → site write API (single `/api/dev/projects` + `/api/dev/items`,
  or one RPC-style endpoint the vault skill calls)?
- Where the Vol 3 cover image currently lives so we can move it into Storage.
