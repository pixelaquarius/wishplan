const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('public config is the exact isolated staging web app with AI explicitly disabled', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../checkkol/firebase-config.js'), 'utf8'), context);
  const config = context.window.WISHPLAN_FIREBASE_CONFIG;
  assert.equal(config.projectId, 'wishplan-staging');
  assert.equal(config.appId, '1:462209381308:web:f5660b818c7822488031b9');
  assert.equal(config.authDomain, 'wishplan-staging.firebaseapp.com');
  assert.equal(config.messagingSenderId, '462209381308');
  assert.match(config.apiKey, /^AIza[\w-]+$/);
  assert.equal(context.window.WISHPLAN_KOL_AI_ENABLED, false);
  assert.equal(config.databaseURL, undefined);
  assert.equal(context.window.WISHPLAN_FIREBASE_APPCHECK_SITE_KEY, undefined);
});
