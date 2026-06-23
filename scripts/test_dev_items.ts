// scripts/test_dev_items.ts — CRUD round-trip against the real Supabase tables.
import assert from 'node:assert';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('SKIP: Supabase env not configured (.env.local missing).');
    return;
  }
  const {
    createProject,
    addItem,
    getItemsForProject,
    updateItemStatus,
    listProjectsWithItems,
    deleteProject,
  } = await import('../src/lib/dev/items');

  const id = 'zzz-test-' + Math.floor(Date.now() / 1000); // unique-ish, no Math.random needed
  try {
    const proj = await createProject({ id, name: 'Test Project', vaultPath: 'x/y.md' });
    assert.equal(proj.id, id, 'project created with id');
    assert.equal(proj.irisVisible, false, 'iris_visible defaults false');

    const a = await addItem({ projectId: id, title: 'item A', size: 'M' });
    assert.equal(a.status, 'todo', 'item defaults to todo');
    assert.equal(a.closedAt, null, 'non-done item has null closed_at');

    const b = await addItem({ projectId: id, title: 'item B', status: 'done' });
    assert.ok(b.closedAt, 'done item gets closed_at on insert');

    const items = await getItemsForProject(id);
    assert.equal(items.length, 2, 'two items fetched for project');

    const updated = await updateItemStatus(a.id, 'done');
    assert.equal(updated.status, 'done', 'status updated to done');
    assert.ok(updated.closedAt, 'closed_at set when moved to done');
    assert.ok(
      Date.parse(updated.updatedAt) >= Date.parse(a.updatedAt),
      'updated_at advances on status update',
    );
    const reopened = await updateItemStatus(a.id, 'todo');
    assert.equal(reopened.closedAt, null, 'closed_at cleared when leaving done');

    const all = await listProjectsWithItems();
    const mine = all.find((p) => p.id === id);
    assert.ok(mine, 'project appears in listProjectsWithItems');
    assert.equal(mine!.items.length, 2, 'project carries its items');

    console.log('PASS: dev_items CRUD round-trip');
  } finally {
    await deleteProject(id); // cleanup (cascades items)
  }
}

main().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
