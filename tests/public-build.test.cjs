'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {spawnSync} = require('node:child_process');
const root = path.join(__dirname, '..');
const script = path.join(root, 'scripts', 'disable-public-cloud.cjs');

test('public build cannot publish staging Firebase configuration', () => {
  assert.ok(fs.existsSync(script), 'A real artifact-only cloud configuration guard is required');
  const base = path.join(root, 'node_modules', '.cache', 'wishplan-tests');
  fs.mkdirSync(base, {recursive:true});
  const dir = fs.mkdtempSync(path.join(base, 'public-'));
  try {
    const target = path.join(dir, '_site', 'checkkol', 'firebase-config.js');
    fs.mkdirSync(path.dirname(target), {recursive:true});
    fs.writeFileSync(target, 'window.WISHPLAN_FIREBASE_CONFIG={projectId:"wishplan-staging"};window.WISHPLAN_KOL_AI_ENABLED=true;');
    const original = fs.readFileSync(path.join(root, 'checkkol/firebase-config.js'), 'utf8');
    const result = spawnSync(process.execPath, [script], {cwd:dir, encoding:'utf8'});
    assert.equal(result.status, 0, result.stderr);
    const ctx = {window:{}};
    vm.runInNewContext(fs.readFileSync(target, 'utf8'), ctx);
    assert.deepEqual(Object.keys(ctx.window.WISHPLAN_FIREBASE_CONFIG), []);
    assert.equal(ctx.window.WISHPLAN_KOL_AI_ENABLED, false);
    assert.doesNotMatch(fs.readFileSync(target, 'utf8'), /wishplan-staging/);
    assert.equal(fs.readFileSync(path.join(root, 'checkkol/firebase-config.js'), 'utf8'), original);
  } finally {fs.rmSync(dir, {recursive:true,force:true});}
});

test('Pages deploy waits for a unique artifact from the current run attempt', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/pages.yml'), 'utf8');
  assert.match(workflow, /PAGES_ARTIFACT_NAME: github-pages-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
  assert.match(workflow, /uses: actions\/upload-pages-artifact@v3\s+with:\s+name: \$\{\{ env\.PAGES_ARTIFACT_NAME \}\}/);
  const barrier = workflow.indexOf('name: Wait for the Pages artifact');
  assert.ok(barrier > workflow.indexOf('uses: actions/upload-pages-artifact') && barrier < workflow.indexOf('uses: actions/deploy-pages'));
  assert.match(workflow, /uses: actions\/deploy-pages@v4\s+with:\s+artifact_name: \$\{\{ env\.PAGES_ARTIFACT_NAME \}\}/);
});

test('Pages staging step applies guard after copying tools and before artifact upload', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/pages.yml'), 'utf8');
  const copy = workflow.indexOf('rsync -a');
  const guard = workflow.indexOf('node scripts/disable-public-cloud.cjs');
  const upload = workflow.indexOf('uses: actions/upload-pages-artifact');
  assert.ok(copy >= 0 && guard > copy && upload > guard);
});
