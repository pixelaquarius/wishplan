'use strict';
const { createHash } = require('node:crypto');
const { failure } = require('./analyze-kol.cjs');
const LIMITS = Object.freeze({ minute: 5, userDay: 30, globalDay: 200 });
function quotaUpdates(user, global, now) {
  const day = new Date(now).toISOString().slice(0, 10);
  const minute = Math.floor(now / 60000);
  const count = (record, windowKey, window, key) => {
    if (record[windowKey] !== window) return 0;
    const value = record[key];
    if (!Number.isSafeInteger(value) || value < 0) throw failure('resource-exhausted', 'Quota state invalid; contact administrator.');
    return value;
  };
  const dayCount = count(user, 'day', day, 'dayCount');
  const minuteCount = count(user, 'minute', minute, 'minuteCount');
  const globalCount = count(global, 'day', day, 'dayCount');
  if (dayCount >= LIMITS.userDay || minuteCount >= LIMITS.minute || globalCount >= LIMITS.globalDay) {
    throw failure('resource-exhausted', 'AI request quota reached. Try later.');
  }
  return { user: { day, dayCount: dayCount + 1, minute, minuteCount: minuteCount + 1 },
    global: { day, dayCount: globalCount + 1 } };
}
function createConsumeQuota(db, clock = Date.now) {
  return async uid => {
    const identity = createHash('sha256').update(uid).digest('hex');
    const userRef = db.doc(`_aiQuotaUsers/${identity}`);
    const globalRef = db.doc('_aiQuotaGlobal/current');
    const accessRef = db.doc(`_aiAccess/${identity}`);
    await db.runTransaction(async transaction => {
      // All reads precede writes. Firestore retries this callback on contention.
      const access = await transaction.get(accessRef);
      if (!access.exists || access.data().enabled !== true) throw failure('permission-denied', 'AI access requires administrator approval.');
      const user = await transaction.get(userRef);
      const global = await transaction.get(globalRef);
      const next = quotaUpdates(user.data() || {}, global.data() || {}, clock());
      transaction.set(userRef, next.user);
      transaction.set(globalRef, next.global);
    });
  };
}
module.exports = { quotaUpdates, createConsumeQuota, LIMITS };
