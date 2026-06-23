# Vault → Harlequin items contract

The vault (`the-mv-vault`) and cloud Claude sessions are a SEPARATE access point
from the website. They talk to Supabase DIRECTLY with the service-role key — they
do NOT call the website's `/api/dev/*` endpoints and do NOT need `DEV_SESSION_SECRET`.

## Tables
- `dev_projects` — one row per virtual project. **Created only from the vault.**
  Columns: `id` (kebab slug), `name`, `kind` ('virtual'), `vault_path`,
  `iris_visible` (default false), `created_at`.
- `dev_items` — items under a project. Addable from the vault OR the board. They
  mirror the GitHub ticket model so they render through the same board card.
  Columns: `id` (uuid), `project_id` (FK), `title`, `body` (markdown, `- [ ]`
  subtasks), `priority` ('p1'..'p5', nullable), `status` ('todo'|'in progress'|
  'awaiting review'), `size` ('S'|'M'|'L', nullable), `vault_ref`, `created_at`,
  `updated_at`, `closed_at`. **"Done" = a closed item** (`closed_at` set) — there
  is no `done` status value; mark done by setting `closed_at`.

## Access
Connect with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (service-role bypasses
RLS; RLS is deny-by-default so the anon key sees nothing). Example:

```ts
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
// create a project (vault-only):
await db.from('dev_projects').insert({ id: 'deep-work-queue', name: 'Deep Work Queue', vault_path: 'Deep Work Queue.md' });
// add an item (status omitted defaults to 'todo'):
await db.from('dev_items').insert({ project_id: 'deep-work-queue', title: '...', priority: 'p2', size: 'M', vault_ref: 'Deep Work Queue.md' });
// mark an item done = close it:
await db.from('dev_items').update({ closed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', itemId);
// fetch items:
const { data } = await db.from('dev_items').select('*').eq('project_id', 'deep-work-queue');
```

> When updating a `dev_items` row via raw SQL, also set `updated_at` (and set/clear `closed_at` to mark done/undone) — the site's data lib does this automatically, but raw writers from the vault must set them explicitly.

## Rules
- **Projects: vault-only.** Never create projects from the board UI.
- **Items: either side.** Write `vault_ref` back so the note ↔ item point at each other.
- **iris_visible defaults false.** Flipping it to expose a project to Iris/public is a
  later, out-of-scope step.

## Follow-up (separate repo)
The vault-side CLAUDE.md note + skill that wraps the above live in the `the-mv-vault`
repo, not here.
