// Public Firebase WEB configuration only. No service-account keys or AI secrets.
// Deployment must replace {} with its own project configuration, for example:
// window.WISHPLAN_FIREBASE_CONFIG = { apiKey: 'public-web-api-key',
//   authDomain: 'YOUR-PROJECT.firebaseapp.com', projectId: 'YOUR-PROJECT',
//   appId: 'YOUR-WEB-APP-ID' };
// Enable Google sign-in and authorize the hosting domain in Firebase Console.
// Cloud Functions must deploy analyzeKol in us-central1 with owner-only rules
// on users/{uid}/snapshots. AI is disabled unless deployment also sets
// window.WISHPLAN_KOL_AI_ENABLED = true after securing/deploying the callable.
// Also set window.WISHPLAN_FIREBASE_APPCHECK_SITE_KEY = 'public-recaptcha-v3-site-key'
// and register App Check + the server-side AI UID allowlist. Never enable debug
// tokens in deployed config. The SDK attaches Auth/App Check tokens to analyzeKol.
// Deletion contract: users/{uid}/snapshots/{id} must allow owner-written immutable
// tombstones { snapshotId: id, deleted: true, deletedAt: ISO-date-string }.
// Rules must forbid replacing a tombstone with a live snapshot. Without that
// rules integration deletion remains pending and upload fails closed.
// Verified isolated staging web app; AI backend is intentionally not deployed.
window.WISHPLAN_FIREBASE_CONFIG = {
  "projectId": "wishplan-staging",
  "appId": "1:462209381308:web:f5660b818c7822488031b9",
  "storageBucket": "wishplan-staging.firebasestorage.app",
  "apiKey": "AIzaSyAjvECbycKAXiENh-aQXG5XRmMcOGx1qz4",
  "authDomain": "wishplan-staging.firebaseapp.com",
  "messagingSenderId": "462209381308",
  "projectNumber": "462209381308",
  "version": "2"
};
window.WISHPLAN_KOL_AI_ENABLED = false;
