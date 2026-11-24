'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAnalyzeKol } = require('../functions/analyze-kol.cjs');

test('valid prompt consumes quota then returns generated text', async () => {
  const order = [];
  const analyze = createAnalyzeKol({ enabled: true,
    consumeQuota: async uid => order.push(uid),
    generate: async prompt => { order.push(prompt); return 'analysis'; }
  });
  assert.deepEqual(await analyze({ auth: { uid: 'alice' }, data: { prompt: 'hello' } }), { text: 'analysis' });
  assert.deepEqual(order, ['alice', 'hello']);
});

test('invalid payloads never consume quota or invoke AI', async () => {
  const analyze = createAnalyzeKol({ enabled: true,
    consumeQuota: async () => assert.fail('quota invoked'), generate: async () => assert.fail('AI invoked') });
  for (const data of [null, [], {}, { prompt: '' }, { prompt: 123 }, { prompt: 'x', apiKey: 'forbidden' },
    { prompt: 'x'.repeat(16385) }, { prompt: '😀'.repeat(5000) }]) {
    await assert.rejects(analyze({ auth: { uid: 'alice' }, data }), { code: 'invalid-argument' });
  }
});

test('AI is disabled by default, and quota rejection prevents generation', async () => {
  const dependencies = { consumeQuota: async () => { throw Object.assign(new Error('quota'), { code: 'resource-exhausted' }); },
    generate: async () => assert.fail('AI invoked') };
  await assert.rejects(createAnalyzeKol(dependencies)({ auth: { uid: 'a' }, data: { prompt: 'hello' } }), { code: 'failed-precondition' });
  await assert.rejects(createAnalyzeKol({ ...dependencies, enabled: true })({ auth: { uid: 'a' }, data: { prompt: 'hello' } }), { code: 'resource-exhausted' });
});

test('callable rejects unauthenticated users before any work', async () => {
  let calls = 0;
  const analyze = createAnalyzeKol({ consumeQuota: async () => calls++, generate: async () => calls++ });
  await assert.rejects(analyze({ data: { prompt: 'test' } }), { code: 'unauthenticated' });
  assert.equal(calls, 0);
});
