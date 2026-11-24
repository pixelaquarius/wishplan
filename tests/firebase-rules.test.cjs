'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, getDocs, collection, deleteDoc, updateDoc, collectionGroup } = require('firebase/firestore');
const { ref, set, get } = require('firebase/database');
const hasEmulators = !!process.env.FIRESTORE_EMULATOR_HOST && !!process.env.FIREBASE_DATABASE_EMULATOR_HOST;
let env;
const snapshot = (id = 's1') => ({ snapshotId: id, handle: '@example', savedAtIso: '2026-11-24T00:00:00.000Z',
  savedAtFormatted: '24/11/2026', scorePct: 60, followersCount: 1200, totalGmv: 5000,
  stores: [], products: [], videos: [], top20MatchedBrands: [] });
const root = path.join(__dirname, '..');
before(async () => {
  if (!hasEmulators) return;
  env = await initializeTestEnvironment({ projectId: 'demo-wishplan',
    firestore: { rules: fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8') },
    database: { rules: fs.readFileSync(path.join(root, 'database.rules.json'), 'utf8') } });
});
beforeEach(async () => { if (env) { await env.clearFirestore(); await env.clearDatabase(); } });
after(async () => { if (env) await env.cleanup(); });
const emulatorTest = (name, body) => test(name, { skip: !hasEmulators && 'Run npm run test:firebase with Java 21+' }, body);
const db = uid => env.authenticatedContext(uid).firestore();
const target = (database, uid = 'alice', id = 's1') => doc(database, `users/${uid}/snapshots/${id}`);

emulatorTest('owner can create, read, list, update and delete a compatible snapshot', async () => {
  const own = db('alice');
  await assertSucceeds(setDoc(target(own), snapshot()));
  assert.equal((await assertSucceeds(getDoc(target(own)))).data().handle, '@example');
  assert.equal((await assertSucceeds(getDocs(collection(own, 'users/alice/snapshots')))).size, 1);
  await assertSucceeds(updateDoc(target(own), { scorePct: null }));
  await assertSucceeds(deleteDoc(target(own)));
});

emulatorTest('owner deletion tombstones work and stale writes cannot resurrect them', async () => {
  const own = db('alice');
  const tombstone = { snapshotId: 's1', deleted: true, deletedAt: '2026-11-24T00:00:00.000Z' };
  await assertSucceeds(setDoc(target(own), snapshot()));
  await assertSucceeds(setDoc(target(own), tombstone));
  await assertFails(setDoc(target(own), snapshot()));
  await assertFails(deleteDoc(target(own)));
  await assertSucceeds(setDoc(target(own), { ...tombstone, deletedAt: '2026-11-25T00:00:00.000Z' }));
  await assertFails(setDoc(target(db('bob')), tombstone));
  await assertFails(setDoc(target(own, 'alice', 's2'), { ...tombstone, snapshotId: 's2', deleted: false }));
});

emulatorTest('full legacy-shaped snapshot with nullable metrics is accepted', async () => {
  const full = { ...snapshot(), dominantTrack: 'VIDEO_TRACK', isIndependent: true,
    isFemaleMajority: null, isCategoryAlignedWithSkincare: false };
  for (const key of ['fileName','avatarUrl','mcnDisplay','firstPubDate','dateRangeWindow','dataTimeText','bioText','ageGroup','detectedIndustry']) full[key] = 'example';
  for (const key of ['products30dCount','dailyGmv','liveGmv','videoGmv','showcaseGmv','aov','liveViews','videoViews','followerChange','videoCount30d','gmvPer1kFollowers','gmvPerVideo','viewsPerVideo','videoSharePct','liveSharePct','avgRoas','specialistSkincareStores','personalCareStores','apparelStores','skincareRevenue','personalCareRevenue','apparelRevenue','maxSkincareOrdersOnSingleStore','skincareSkuCount','personalCareSkuCount','apparelSkuCount']) full[key] = 1;
  await assertSucceeds(setDoc(target(db('alice')), full));
  full.totalGmv = null;
  await assertSucceeds(setDoc(target(db('alice')), full));
});

emulatorTest('actual frontend parser and saved snapshot pass owner rules and deny another user', async () => {
  const vm = require('node:vm');
  const storage = new Map(), elements = new Map();
  const element = () => ({ textContent: '', value: '', style: {}, children: [], classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, appendChild(v) { this.children.push(v); }, setAttribute() {} });
  const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, querySelector() { return null; }, addEventListener() {}, createElement: element, head: { appendChild() {} }, body: { appendChild() {} } };
  const ctx = vm.createContext({ document, console, URL, setTimeout() {}, clearTimeout() {}, localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) }, location: { href: 'https://wishplan.test/checkkol/', origin: 'https://wishplan.test' }, addEventListener() {}, alert() {}, confirm: () => true });
  ctx.window = ctx;
  const html = fs.readFileSync(path.join(root, 'checkkol/index.html'), 'utf8');
  for (const script of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    const src = script[1].match(/src="([^"]+)"/);
    if (src && !src[1].startsWith('http')) vm.runInContext(fs.readFileSync(path.join(root, 'checkkol', src[1]), 'utf8'), ctx);
    else if (!src && !script[2].includes('tailwind.config')) vm.runInContext(script[2], ctx);
  }
  // Only a synthetic creator is used. This exercises the actual parser and
  // snapshot serializer, not an independently maintained schema fixture.
  const data = vm.runInContext('parseKalodataApiBundle({creatorDetail:{handle:"integration_fixture"}})', ctx);
  ctx.fixture = data;
  vm.runInContext('saveAuditSnapshotToHistory(fixture)', ctx);
  const stored = JSON.parse(vm.runInContext('JSON.stringify(getSavedHistory()[0])', ctx));
  assert.equal(stored.handle, '@integration_fixture');
  assert.equal(stored.scorePct, null);
  const ownRef = target(db('alice'), 'alice', stored.snapshotId);
  await assertSucceeds(setDoc(ownRef, stored));
  assert.deepEqual((await assertSucceeds(getDoc(ownRef))).data(), stored);
  await assertFails(setDoc(target(db('bob'), 'alice', stored.snapshotId), stored));
});

emulatorTest('unauthenticated and user B cannot read, list, write or delete A data', async () => {
  await env.withSecurityRulesDisabled(async ctx => setDoc(target(ctx.firestore()), snapshot()));
  for (const other of [db('bob'), env.unauthenticatedContext().firestore()]) {
    await assertFails(getDoc(target(other)));
    await assertFails(getDocs(collection(other, 'users/alice/snapshots')));
    await assertFails(setDoc(target(other), snapshot()));
    await assertFails(updateDoc(target(other), { scorePct: 0 }));
    await assertFails(deleteDoc(target(other)));
  }
});

emulatorTest('owner cannot inject arbitrary fields or invalid schema', async () => {
  const own = db('alice');
  for (const bad of [{ ...snapshot(), admin: true }, { ...snapshot(), snapshotId: 'other' },
    { ...snapshot(), handle: '' }, { ...snapshot(), scorePct: 101 }, { ...snapshot(), scorePct: '100' },
    { ...snapshot(), savedAtIso: 'not-a-date' }, { ...snapshot(), followersCount: -1 },
    { ...snapshot(), stores: {} }, { ...snapshot(), videos: Array(101).fill({}) },
    { ...snapshot(), bioText: 'x'.repeat(4097) }, { handle: '@example' }]) {
    await assertFails(setDoc(target(own), bad));
  }
  await assertSucceeds(setDoc(target(own), snapshot()));
  await assertFails(updateDoc(target(own), { admin: true }));
});

emulatorTest('all other Firestore paths, quota, AI access, legacy phone docs and collection-group reads deny clients', async () => {
  const own = db('alice');
  for (const p of ['users/alice', 'users/0901234567', '_aiQuotaUsers/alice', '_aiQuotaGlobal/current', '_aiAccess/alice', 'public/data', 'users/alice/snapshots/s1/nested/x']) {
    await assertFails(setDoc(doc(own, p), { enabled: true }));
    await assertFails(getDoc(doc(own, p)));
  }
  await assertFails(getDocs(collectionGroup(own, 'snapshots')));
});

emulatorTest('transactional quota admits only one concurrent request at the user limit', async () => {
  process.env.METADATA_SERVER_DETECTION = 'none'; // Emulator-only: never probe cloud metadata or ambient credentials.
  const { initializeApp, deleteApp } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const { createHash } = require('node:crypto');
  const { createConsumeQuota, quotaUpdates } = require('../functions/quota.cjs');
  const app = initializeApp({ projectId: 'demo-wishplan' }, 'quota-emulator-test');
  const store = getFirestore(app);
  try {
    const uid = 'quota-alice';
    const hash = createHash('sha256').update(uid).digest('hex');
    const now = Date.parse('2026-11-24T12:00:00Z');
    const first = quotaUpdates({}, {}, now);
    await store.doc(`_aiAccess/${hash}`).set({ enabled: true });
    await store.doc(`_aiQuotaUsers/${hash}`).set({ ...first.user, dayCount: 4, minuteCount: 4 });
    await store.doc('_aiQuotaGlobal/current').set({ ...first.global, dayCount: 4 });
    const consume = createConsumeQuota(store, () => now);
    const results = await Promise.allSettled([consume(uid), consume(uid), consume(uid)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.ok(results.filter(result => result.status === 'rejected').every(result => result.reason.code === 'resource-exhausted'));
    assert.equal((await store.doc(`_aiQuotaUsers/${hash}`).get()).data().minuteCount, 5);
    assert.equal((await store.doc('_aiQuotaGlobal/current').get()).data().dayCount, 5);
    await assert.rejects(consume('not-approved'), { code: 'permission-denied' });
  } finally { await store.terminate(); await deleteApp(app); }
});

emulatorTest('Realtime Database denies reads and writes even with authentication', async () => {
  for (const ctx of [env.authenticatedContext('alice'), env.unauthenticatedContext()]) {
    await assertFails(set(ref(ctx.database(), 'rooms/test'), { owner: 'alice' }));
    await assertFails(get(ref(ctx.database(), 'rooms/test')));
  }
});
