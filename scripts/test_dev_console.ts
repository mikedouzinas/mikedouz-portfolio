import assert from 'node:assert';

// Must be set before importing the session module.
process.env.DEV_SESSION_SECRET = 'test-secret-please-change-0123456789';

async function main() {
  // Dynamic import after env is set — robust to ESM hoisting.
  const { signSession, verifySession } = await import('../src/lib/dev/session');

  const now = 1_700_000_000_000; // fixed clock (ms)

  const tok = await signSession(now);

  const fresh = await verifySession(tok, now + 1000);
  assert.equal(fresh.valid, true, 'fresh session is valid');
  assert.ok(fresh.refreshed, 'fresh session returns a refreshed token');

  const rt = await verifySession(fresh.refreshed!, now + 2000);
  assert.equal(rt.valid, true, 'refreshed token re-verifies as valid');

  const idle = await verifySession(tok, now + 31 * 60 * 1000);
  assert.equal(idle.valid, false, 'session past 30m idle is rejected');

  const expired = await verifySession(tok, now + 3 * 60 * 60 * 1000);
  assert.equal(expired.valid, false, 'session past 2h absolute expiry is rejected');

  const tampered = await verifySession(tok.slice(0, -2) + 'xx', now + 1000);
  assert.equal(tampered.valid, false, 'tampered token is rejected');

  console.log('✓ dev console auth tests passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
