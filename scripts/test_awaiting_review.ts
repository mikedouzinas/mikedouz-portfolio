// scripts/test_awaiting_review.ts
import { upsertReviewBlock, parseReviewBlock, previewUrlForBranch } from '../src/lib/dev/github';

function assert(cond: boolean, msg: string) { if (!cond) { console.error('FAIL:', msg); process.exit(1); } }

// upsert into empty body
const a = upsertReviewBlock('Original body.', { preview: 'https://x.test', test: 'open /dev' });
assert(a.includes('Original body.'), 'preserves body');
assert(a.includes('<!-- awaiting-review:start -->') && a.includes('<!-- awaiting-review:end -->'), 'has markers');
assert((a.match(/awaiting-review:start/g) ?? []).length === 1, 'single block');

// upsert is idempotent (replace, not append)
const b = upsertReviewBlock(a, { preview: 'https://y.test', test: 'open /dev', feedback: 'looks off' });
assert((b.match(/awaiting-review:start/g) ?? []).length === 1, 'still single block after re-upsert');
assert(b.includes('https://y.test') && !b.includes('https://x.test'), 'replaced preview');
assert(b.includes('looks off'), 'feedback written');

// parse round-trips
const parsed = parseReviewBlock(b);
assert(parsed?.preview === 'https://y.test' && parsed?.test === 'open /dev' && parsed?.feedback === 'looks off', 'parse round-trip');
assert(parseReviewBlock('no block here') === null, 'null when absent');

// slug derivation
const url = previewUrlForBranch('feat/Awaiting_Review #79');
assert(url.startsWith('https://') && /^[a-z0-9.-]+$/.test(url.replace('https://','')), 'url is a clean host');
assert(!url.includes('_') && !url.includes('#') && !url.includes(' '), 'branch sanitized');

console.log('ALL PASS');
