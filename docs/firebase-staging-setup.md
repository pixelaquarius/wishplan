# Verified Firebase staging setup

Verified on 2026-11-24. Scope is exclusively `wishplan-staging` (project number `462209381308`). No billing association/upgrade, production deployment, Auth mutation, Functions, Hosting, RTDB or Storage deployment was performed by this setup task. Existing projects were not touched. No commit or push was made.

## Registered WEB app

- Display name: `WishPlan KOL Staging`
- App ID: `1:462209381308:web:f5660b818c7822488031b9`
- Resource: `projects/wishplan-staging/webApps/1:462209381308:web:f5660b818c7822488031b9`
- State: `ACTIVE`
- Auth domain: `wishplan-staging.firebaseapp.com`
- Messaging sender ID: `462209381308`
- `apps:list WEB` initially returned no apps. After creation, fresh `apps:list` and `apps:sdkconfig` verified the exact app. The local configuration was programmatically compared to the retrieved SDK JSON, including its public API key, without printing the key.
- `checkkol/firebase-config.js` retains its original comments and contains only this app's public SDK configuration. `window.WISHPLAN_KOL_AI_ENABLED = false` is explicit. No App Check debug token, private credential, database URL or AI secret is present.
- The SDK's `storageBucket` value is configuration metadata only; this task did not provision or deploy Storage.

## Default Firestore

- Resource: `projects/wishplan-staging/databases/(default)`
- UID: `55cd6232-c851-4eb1-8d67-265fa328396e`
- Created: `2026-11-24T09:42:11.751413Z`
- Location: `asia-southeast1` (Singapore)
- Type: `FIRESTORE_NATIVE`
- Edition: `STANDARD`
- Delete protection: `DELETE_PROTECTION_ENABLED`
- Point-in-time recovery: `POINT_IN_TIME_RECOVERY_DISABLED`
- API reports `freeTier: true`.

The Firestore API was initially disabled (403), so only the prerequisite `firestore.googleapis.com` service was enabled in staging. A fresh Service Usage GET returned `ENABLED`. A successful database-list call then returned an empty list before creation, preventing duplicate creation. After creation, both fresh database-get and database-list calls independently confirmed the settings above. No billing requirement was encountered; no billing changes were made.

## Tested and deployed rules

Only this command was used for deployment (run from the source directory):

```bash
npx --yes --package=node@22 node node_modules/firebase-tools/lib/bin/firebase.js deploy --only firestore:rules --project wishplan-staging --non-interactive --json
```

- Release: `projects/wishplan-staging/releases/cloud.firestore`
- Ruleset: `projects/wishplan-staging/rulesets/a87f0f18-d92f-4c85-8874-3ae8e5f0323c`
- Release update: `2026-11-24T09:44:02.976813Z`
- Source: `firestore.rules`
- SHA-256: `d4081732e6c66b3639d371801e0f630c0ddd94b99f05057fe11b6625fd0cc1b9`

After deployment, fresh Rules REST GETs read the release and its exact referenced ruleset. The single remote source file matched local `firestore.rules` byte-for-byte. Rules were not modified by this staging setup task.

## Verification

- New staging-config regression test first failed against the empty configuration, then passed after configuration.
- `npm test`: 59 tests; 50 passed, 9 emulator-only tests skipped, 0 failed.
- Explicit demo-project Firestore/RTDB emulator suite: 9 tests passed, 0 skipped, 0 failed, before staging rules deployment. No test document was written to staging by this suite.
- Existing frontend VM tests explicitly reset configuration to empty after loading the public config to retain their offline/unconfigured test fixture. A separate test checks the real staging app identity and explicit AI-off state.
- `git diff --check`: clean.
- Negative emulator cases emit expected permission-denied logs; malformed-record rejection also includes evaluation-limit diagnostics. Positive owner/full-record/parser compatibility tests passed.

## Independent Auth readback (read only)

The parent task configured Google Auth separately. Fresh Identity Toolkit v2 GETs of project config and `defaultSupportedIdpConfigs/google.com` returned:

- Google enabled: `true`
- Authorized domains: `localhost`, `wishplan-staging.firebaseapp.com`, `wishplan-staging.web.app`

No Auth setting was modified by this task. `127.0.0.1` and `wishplan.pics` were not in the returned list. Local parent testing uses `http://localhost:8765/checkkol/`; browser sign-in and end-to-end live user sync remain parent-owned verification, not claimed here.

## Repeat commands safely

Always use explicit `--project wishplan-staging` for staging Firebase CLI operations. Use Node 22 for Firebase CLI on this Windows machine because host Node 24 can crash after CLI commands. Inspect state before creating resources. Never use an unfiltered deploy or deploy Functions as part of this Spark-only setup.

Database creation used all required safety options explicitly:

```bash
npx --yes --package=node@22 node node_modules/firebase-tools/lib/bin/firebase.js firestore:databases:create '(default)' --location asia-southeast1 --edition standard --delete-protection ENABLED --point-in-time-recovery DISABLED --project wishplan-staging --non-interactive --json
```

Do not rerun creation without first listing databases; location is an intentional fixed staging boundary. Stop if any future operation requires billing rather than upgrading or weakening protection.
