'use strict';
const fs = require('node:fs');
const path = require('node:path');

// The current release is local-first. The working copy can use the isolated
// staging project, but the public Pages artifact must not connect to it.
// Enabling production cloud requires a separately reviewed release change.
const target = path.resolve('_site/checkkol/firebase-config.js');
if (!fs.existsSync(target)) throw new Error('Public artifact is missing its KOL configuration');
fs.writeFileSync(target, [
  '// Public release: local tools enabled, cloud and AI not configured.',
  'window.WISHPLAN_FIREBASE_CONFIG = {};',
  'window.WISHPLAN_KOL_AI_ENABLED = false;',
  ''
].join('\n'), 'utf8');
console.log('Public artifact: cloud and AI disabled; working staging config preserved.');
