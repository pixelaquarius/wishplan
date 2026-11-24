'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('Firebase callable is bound to server secret and enforces App Check', async () => {
  const { analyzeKol } = require('../functions/index.cjs');
  assert.equal(typeof analyzeKol, 'function');
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.post('/', analyzeKol);
  const server = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { prompt: 'hello' } })
    });
    assert.equal(response.status, 401);
    const error = (await response.json()).error;
    assert.equal(error.status, 'UNAUTHENTICATED');
    assert.equal(error.message, 'Unauthenticated'); // SDK rejects App Check before the app's custom auth message.
  } finally { await new Promise(resolve => server.close(resolve)); }
  assert.ok(analyzeKol.__endpoint.secretEnvironmentVariables.some(secret => secret.key === 'GEMINI_API_KEY'));
  await assert.rejects(analyzeKol.run({ data: { prompt: 'hello' } }), { code: 'unauthenticated' });
});
