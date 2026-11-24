'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateGemini } = require('../functions/gemini.cjs');

test('provider keeps secret in header, limits output, never uses URL query keys', async () => {
  let called = false;
  const text = await generateGemini('hello', { apiKey: 'test-only-not-a-real-secret', model: 'gemini-test', fetchImpl: async (url, options) => {
    called = true;
    assert.equal(new URL(url).search, '');
    assert.equal(options.headers['x-goog-api-key'], 'test-only-not-a-real-secret');
    const body = JSON.parse(options.body);
    assert.equal(body.contents[0].parts[0].text, 'hello');
    assert.equal(body.generationConfig.maxOutputTokens, 1100);
    assert.ok(options.signal);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'safe output' }] } }] }));
  } });
  assert.equal(called, true);
  assert.equal(text, 'safe output');
});

test('provider errors are sanitized and missing config fails without network', async () => {
  await assert.rejects(generateGemini('hello', { apiKey: '', model: 'gemini-test', fetchImpl: () => assert.fail('network') }), { code: 'failed-precondition' });
  for (const response of [new Response('private vendor error', { status: 429 }), new Response('{}'), new Response('not json')]) {
    await assert.rejects(generateGemini('hello', { apiKey: 'test', model: 'gemini-test', fetchImpl: async () => response }),
      error => error.code === 'unavailable' && !error.message.includes('private'));
  }
});
