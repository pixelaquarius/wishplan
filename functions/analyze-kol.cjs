'use strict';
function failure(code, message) { return Object.assign(new Error(message), { code }); }
function createAnalyzeKol({ enabled = false, consumeQuota, generate } = {}) {
  return async (request) => {
    if (!request.auth?.uid) throw failure('unauthenticated', 'Sign in with Firebase first.');
    const data = request.data;
    if (!data || Array.isArray(data) || typeof data !== 'object' ||
        Object.keys(data).length !== 1 || typeof data.prompt !== 'string' ||
        !data.prompt.trim() || Buffer.byteLength(data.prompt, 'utf8') > 16384 ||
        Buffer.byteLength(JSON.stringify(data), 'utf8') > 20000) {
      throw failure('invalid-argument', 'Expected only a nonempty prompt, at most 16384 UTF-8 bytes.');
    }
    if (!enabled) throw failure('failed-precondition', 'AI is disabled by the administrator.');
    await consumeQuota(request.auth.uid);
    const text = await generate(data.prompt);
    return { text };
  };
}
module.exports = { createAnalyzeKol, failure };
