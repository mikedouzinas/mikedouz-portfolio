// scripts/seed_dwq.ts — create the Deep Work Queue project + sample items.
// Proves create + add + fetch from a non-browser session (the vault/cloud path).
import assert from 'node:assert';
import { config } from 'dotenv';
config({ path: '.env.local' });

const PROJECT_ID = 'deep-work-queue';

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('SKIP: Supabase env not configured (.env.local missing).');
    return;
  }
  const { createProject, addItem, getItemsForProject, deleteProject } = await import(
    '../src/lib/dev/items'
  );

  // DESTRUCTIVE: deletes the project and cascade-deletes ALL its items before
  // reseeding. Safe for sample data, but do NOT run this once the vault has
  // written real Deep Work Queue items under this project id — it will erase them.
  await deleteProject(PROJECT_ID).catch(() => {});

  await createProject({
    id: PROJECT_ID,
    name: 'Deep Work Queue',
    vaultPath: 'Deep Work Queue.md',
    irisVisible: false,
  });

  // Sample entries — the vault replaces these with real Deep Work Queue.md rows.
  await addItem({ projectId: PROJECT_ID, title: 'Design Lantern Vol 3 cover', size: 'L', vaultRef: 'Deep Work Queue.md' });
  await addItem({ projectId: PROJECT_ID, title: 'Draft the next blog post', size: 'M', status: 'in_progress', vaultRef: 'Deep Work Queue.md' });
  await addItem({ projectId: PROJECT_ID, title: 'Ship awaiting-review board state', size: 'M', status: 'done', vaultRef: 'Deep Work Queue.md' });

  const items = await getItemsForProject(PROJECT_ID);
  assert.equal(items.length, 3, 'three DWQ items seeded + fetched');
  console.log(`PASS: seeded Deep Work Queue with ${items.length} items (fetch confirmed).`);
}

main().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
