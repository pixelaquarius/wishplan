'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineBoolean, defineString } = require('firebase-functions/params');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { createAnalyzeKol } = require('./analyze-kol.cjs');
const { createConsumeQuota } = require('./quota.cjs');
const { generateGemini } = require('./gemini.cjs');

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const aiEnabled = defineBoolean('KOL_AI_ENABLED', { default: false });
// No default model: an administrator must review availability, data policy and pricing.
const geminiModel = defineString('GEMINI_MODEL', { default: '' });

exports.analyzeKol = onCall({
  region: 'us-central1',
  secrets: [geminiApiKey],
  enforceAppCheck: true,
  timeoutSeconds: 40,
  memory: '256MiB',
  minInstances: 0,
  maxInstances: 2,
  concurrency: 10
}, async request => {
  // Lazy Admin initialization keeps module discovery and unauthenticated tests offline.
  const consumeQuota = async uid => {
    if (!getApps().length) initializeApp();
    await createConsumeQuota(getFirestore())(uid);
  };
  const analyze = createAnalyzeKol({ enabled: aiEnabled.value(), consumeQuota,
    generate: prompt => {
      if (process.env.FUNCTIONS_EMULATOR === 'true') {
        throw Object.assign(new Error('Live AI is disabled in local emulators.'), { code: 'failed-precondition' });
      }
      return generateGemini(prompt, { apiKey: geminiApiKey.value(), model: geminiModel.value() });
    }
  });
  try { return await analyze(request); }
  catch (error) {
    // Only known application codes/messages cross the trust boundary; no vendor bodies/logs.
    const safe = ['unauthenticated', 'invalid-argument', 'failed-precondition', 'resource-exhausted', 'permission-denied', 'unavailable'];
    if (safe.includes(error.code)) throw new HttpsError(error.code, error.message);
    throw new HttpsError('internal', 'Analysis could not be completed.');
  }
});
