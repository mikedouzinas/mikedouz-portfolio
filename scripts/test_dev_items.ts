// scripts/test_dev_items.ts — CRUD round-trip against the real Supabase tables.
// Items mirror the GitHub ticket model: priority, status (todo/in progress/
// awaiting review), size, and "done" = a closed item (closed_at).
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
    getItem,
    getItemsForProject,
    updateItem,
    listProjectsWithItems,
    deleteProject,
  } = await import('../src/lib/dev/items');

  const id = 'zzz-test-' + Math.floor(Date.now() / 1000); // unique-ish, no Math.random needed
  try {
    const proj = await createProject({ id, name: 'Test Project', vaultPath: 'x/y.md' });
    assert.equal(proj.id, id, 'project created with id');
    assert.equal(proj.irisVisible, false, 'iris_visible defaults false');

    const a = await addItem({ projectId: id, title: 'item A', size: 'M', priority: 'p2' });
    assert.equal(a.status, 'todo', 'item defaults to todo');
    assert.equal(a.state, 'open', 'new item is open');
    assert.equal(a.priority, 'p2', 'priority stored');

    const b = await addItem({ projectId: id, title: 'item B', status: 'in progress' });
    assert.equal(b.status, 'in progress', 'status stored on insert');

    const items = await getItemsForProject(id);
    assert.equal(items.length, 2, 'two items fetched for project');

    // priority + status + size patch (mirrors the board card's dropdowns)
    const a2 = await updateItem(a.id, { status: 'awaiting review', priority: 'p1', size: 'L' });
    assert.equal(a2.status, 'awaiting review', 'status updated');
    assert.equal(a2.priority, 'p1', 'priority updated');
    assert.equal(a2.size, 'L', 'size updated');
    assert.ok(Date.parse(a2.updatedAt) >= Date.parse(a.updatedAt), 'updated_at advances on update');

    // close (done) then reopen — done is the closed state, not a status value
    const closed = await updateItem(a.id, { state: 'closed' });
    assert.equal(closed.state, 'closed', 'state closed = done');
    assert.ok(closed.closedAt, 'closed_at set on close');
    const reopened = await updateItem(a.id, { state: 'open' });
    assert.equal(reopened.state, 'open', 'item reopened');
    assert.equal(reopened.closedAt, null, 'closed_at cleared on reopen');

    // body edit (subtasks live in the body markdown)
    const withBody = await updateItem(a.id, { body: '- [ ] sub one\n- [x] sub two' });
    assert.ok(withBody.body.includes('sub one'), 'body updated');

    const got = await getItem(a.id);
    assert.ok(got && got.id === a.id, 'getItem returns the item');

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
