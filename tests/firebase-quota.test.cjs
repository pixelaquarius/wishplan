'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { quotaUpdates, createConsumeQuota } = require('../functions/quota.cjs');
const now = Date.parse('2026-11-24T12:00:00Z');

test('quota starts fresh, increments both counters and rolls over windows', () => {
  const first = quotaUpdates({}, {}, now);
  assert.equal(first.user.dayCount, 1);
  assert.equal(first.user.minuteCount, 1);
  assert.equal(first.global.dayCount, 1);
  const next = quotaUpdates(first.user, first.global, now);
  assert.equal(next.user.minuteCount, 2);
  assert.equal(quotaUpdates(next.user, next.global, now + 60000).user.minuteCount, 1);
  assert.equal(quotaUpdates(next.user, next.global, now + 86400000).user.dayCount, 1);
});

test('per-minute, per-user daily and global daily limits fail closed', () => {
  const first = quotaUpdates({}, {}, now);
  for (const [user, global] of [
    [{ ...first.user, minuteCount: 5 }, first.global],
    [{ ...first.user, dayCount: 30 }, first.global],
    [first.user, { ...first.global, dayCount: 200 }],
    [{ ...first.user, dayCount: -1 }, first.global],
    [{ ...first.user, minuteCount: 'bad' }, first.global]
  ]) assert.throws(() => quotaUpdates(user, global, now), { code: 'resource-exhausted' });
});

test('quota requires server-owned allowlist inside the same transaction', async () => {
  let writes = 0;
  const store = { doc: path => ({ path }), runTransaction: async callback => callback({
    get: async () => ({ exists: false, data: () => undefined }),
    set: () => writes++
  }) };
  await assert.rejects(createConsumeQuota(store, () => now)('alice'), { code: 'permission-denied' });
  assert.equal(writes, 0);
});
