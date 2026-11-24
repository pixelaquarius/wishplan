# Firebase security foundation (local only)

No Firebase project was created, billed or deployed by this change. No live AI requests or production-data reads/writes are part of the tests. The frontend remains a GitHub Pages site; Firebase deployment is a separate, explicitly approved operation.

## Local tests

Use Node.js 22 and Java 21+ (Firestore and RTDB emulators). From the repository root:

```sh
npm ci --ignore-scripts
npm test
npm run test:firebase
# Both, in order:
npm run test:ci
```

The root npm workspace installs the Functions runtime dependencies as well as test tooling. `npm test` discovers **all** `tests/*.test.*` files, including other frontend suites. Emulator cases are explicitly skipped outside an emulator session; `npm run test:firebase` starts both services on loopback, sets the emulator environment variables and runs those cases for real. It uses only `demo-wishplan`, not an existing project. Do not change that test project to production. Ports are Firestore 8080, RTDB 9000; configuration also reserves Auth 9099 and Functions 5001 for future local integration.

On the inspected Windows host Java was absent from PATH and from standard Java installation directories. A portable Azul Zulu JRE 21 was downloaded to Hermes scratch (not installed system-wide or committed). To repeat on that same host in Git Bash:

```sh
export PATH="/c/Users/Admin/AppData/Local/hermes/cache/scratch/wishplan-java/zulu21.54.201-ca-jre21.0.13.1-win_x64/bin:$PATH"
npm run test:firebase
```

That scratch directory is disposable; install/provide your own approved Java 21+ distribution if it is pruned. The first emulator run downloads official Firebase emulator JARs to Firebase's local cache. Expected denied-operation logs in negative rules tests are not test failures. The Admin quota integration test disables metadata-server detection and connects only to the emulator.

## Frontend contract

- `checkkol/firebase-config.js` provides `window.WISHPLAN_FIREBASE_CONFIG` with **public** Firebase web configuration, not a Gemini key, Admin credential or access authorization.
- Google Sign-In is handled by Firebase Authentication. Only Firebase's verified UID identifies an owner. Neither phone numbers nor browser storage establish identity.
- Collection path: `users/{uid}/snapshots/{snapshotId}`. Queries must be scoped to the signed-in UID; collection-group reads are not granted.
- Callable: `analyzeKol`, region `us-central1`, request `{ prompt: string }`, response `{ text: string }`. This matches `checkkol/cloud.js`. No client-supplied key, model, UID or quota is accepted.
- Frontend AI enablement additionally needs `window.WISHPLAN_KOL_AI_ENABLED === true` and a configured `window.WISHPLAN_FIREBASE_APPCHECK_SITE_KEY`. These public switches are UX only; server checks remain authoritative.

## Snapshot schema and limits

Rules are default-deny for every other path, including user-root docs, legacy `users/{phone}` docs, nested snapshot subcollections, server quota and access records. RTDB denies all reads and writes, even for authenticated users; no multiplayer network storage is enabled.

Active snapshots preserve the existing **flat** HTML/API parser shape rather than inventing a payload wrapper. Required fields:

| Field | Constraint |
| --- | --- |
| `snapshotId` | Matches document ID; at most 200 characters |
| `handle` | Nonempty string, at most 120 characters |
| `savedAtIso` | UTC ISO timestamp string in `YYYY-MM-DDTHH:mm:ss.sssZ` shape |
| `scorePct` | Number 0–100 or `null` for unknown |

The explicit allowlist in `firestore.rules` is the authoritative list of optional legacy fields. Text is string-or-null with per-field limits (bio 4096; avatar URL 2048; labels generally 64–256). Flags are boolean-or-null. Metrics are number-or-null; follower count is bounded 0–10^15, follower change ±10^15 and shares 0–100. Unknown values remain null, not fabricated zero. `dominantTrack` is `VIDEO_TRACK`, `LIVE_TRACK`, absent or null. `stores`, `videos`, `products` and `top20MatchedBrands` must be lists of at most 100 entries if supplied.

**Limitations:** nested list entries remain untrusted source data; rules validate the container, not each product/store/video's internal business schema. Other metric fields are type-checked rather than uniformly range-checked to keep full legacy records within Firestore's 1,000-expression rules limit. Firestore's own maximum document size still applies. Timestamp rules validate representation, not calendar validity, trustworthy chronology or freshness. User snapshots are not authoritative scores, financial statements, rendered HTML or backend instructions. Clients must validate imports, bound nested input and render strings safely; future authoritative processing must revalidate server-side. There is no per-user storage-count quota in these rules.

### Deletion protocol

The current frontend writes an exact tombstone shape:

```json
{ "snapshotId": "example_123", "deleted": true, "deletedAt": "2026-11-24T00:00:00.000Z" }
```

Only the owner can write/read it. Rules forbid replacing a tombstone with an active record or physically deleting a tombstone, so stale uploads cannot resurrect that ID. Repeating a tombstone write is permitted. Owners may physically delete active records, but the frontend uses tombstones for cross-device deletion. Do not prune tombstones until an approved retention/migration protocol can prevent resurrection. Restoring an intentionally deleted ID requires a new ID or a separately approved admin operation. Cross-account access remains denied for both record shapes.

## Server AI protections

`functions/index.cjs` exports a second-generation Firebase callable with:

1. App Check enforcement by the Firebase wrapper and Firebase Auth required by the handler.
2. AI disabled by default (`KOL_AI_ENABLED=false`). Local Functions emulation refuses live AI even when enabled.
3. Exactly one request field, a nonblank prompt: maximum **16,384 UTF-8 bytes**, serialized payload maximum **20,000 bytes**. Invalid requests cannot consume quota or call the provider.
4. An administrator-managed AI allowlist. UID identity keys are `sha256(uid)` (lowercase hex). Only `_aiAccess/{sha256(uid)}` with `{ "enabled": true }` permits AI use. Clients cannot read or write this path.
5. A **single Firestore transaction** reads that approval and both counters, then reserves a request against 5 requests/UTC epoch minute, 30 requests/UID/UTC day and 200 requests/project/UTC day. Both counters commit atomically before provider access; contention retries cannot admit extra requests. Corrupt counters in the current window fail closed. Fixed windows can burst at a boundary; these are request quotas, not a rolling-window or exact currency budget.
6. Server-owned counters at `_aiQuotaUsers/{sha256(uid)}` and `_aiQuotaGlobal/current`. Do not delete/reset these to circumvent caps. Failed provider requests retain their reservation (no automatic retry/refund).
7. Secret Manager binding for `GEMINI_API_KEY`, accessed only at function runtime. No key in the browser, URL query, response, example config or logs.
8. An explicitly configured `GEMINI_MODEL`; no model is selected automatically. REST calls use the server-only `x-goog-api-key` header, 25-second timeout, maximum 1,100 output tokens, bounded response reading and sanitized errors. There is no live TikTok browsing, no tool execution and no access to other users' snapshots. AI text is untrusted output and must render as text.
9. Region `us-central1`, max instances 2, concurrency 10 and no minimum instances. These complement, but do not replace, request quotas or vendor-side restrictions.

Disabling a user's `_aiAccess` record stops subsequent requests; a deployment with `KOL_AI_ENABLED=false` is the global feature switch. For an immediate daily circuit breaker, an authorized administrator may set the current UTC day's `_aiQuotaGlobal/current` counter to the global limit; do not clear historical counters. In-flight requests can still finish. Billing alerts are not hard spending caps; provider/project quota settings and operational monitoring require separate review.

## Manual cloud prerequisites — NOT performed

Before any remote command or publication of functional Firebase configuration:

1. Obtain explicit approval for the target **staging** project, access policy, data region, services and any billing. Cloud Functions/Secret Manager may require billing; this repository does not enable it. Use a separate staging project and synthetic records, not the legacy live project.
2. Back up existing cloud rules and any approved migration data. Review the rules with emulator tests first. Do not infer phone-to-UID mapping, migrate password hashes or upload guest history automatically.
3. In Firebase Console enable Google Authentication, configure support details and authorized domains for the actual Pages/custom domain and approved local origins. Keep other sign-in methods off unless explicitly authorized. These Firestore rules provide private per-UID storage to authenticated users, **not** a company-membership restriction; if storage must be invite-only, add an approved server-managed membership check to the rules before rollout. AI already has its own server-managed approval check.
4. Create/review Firestore in the approved location, deploy the reviewed rules only after separate authorization, and ensure runtime IAM is least-privilege. Admin SDK bypasses client rules; protect service accounts and never ship an Admin credential. RTDB need not be provisioned; if it is provisioned, retain deny-all rules.
5. Register App Check for the web app, configure an approved provider/site key and authorized domains, initialize it in the frontend, and verify valid and invalid attestations on staging. Do not ship debug tokens. App Check supplements Auth/quota; it is not identity or an allowlist.
6. Review a currently available Gemini model, pricing, regional/data-retention policy, key/API restrictions and project/vendor quotas. Only then approve setting **server-side** `GEMINI_API_KEY` through Secret Manager and grant access only to this function's runtime service account. Never paste a secret into browser config, chat, Git or CI variables destined for Pages.
7. With separate permission, set the secret using Firebase's supported secret workflow, configure non-secret `KOL_AI_ENABLED` and `GEMINI_MODEL`, and deploy Functions. No deploy command is run by this change or the Pages workflow. Code alone does not revoke an old exposed key: an authorized owner must review usage and rotate/revoke legacy keys separately.
8. Approve individual AI UID hashes in `_aiAccess`; do not expose an admin endpoint or let clients self-enroll. Configure logging/monitoring without prompts, PII or secrets. Test quota denial, malformed payloads, account isolation, tombstone replay and user revocation on staging before frontend enablement.
9. Enter only public Firebase web config in the frontend. Keep frontend AI disabled until staging verification, runtime configuration and App Check are complete. Review the complete diff, costs, migration and rollback before any production deployment or data change.

## CI / publication boundary

`.github/workflows/pages.yml` runs npm installation, all root unit tests, real Java-backed Firestore/RTDB emulator tests and a production dependency audit before Pages deployment. Pull requests test but do not deploy. Deployment stages only `index.html`, `CNAME` and the four public tool directories; Functions code, tests, npm dependencies, docs, rules and root environment/secret files are excluded from the Pages artifact. Firebase deployment is never automatic.

Root developer tools currently have moderate transitive npm audit advisories; there are no high advisories after the pinned `@grpc/grpc-js` override, and the Functions production dependency audit is clean. Do not blindly run `npm audit fix --force`: npm suggests old incompatible Firebase majors. Recheck advisories before release and keep tooling bound to local synthetic tests. The Functions runtime is declared Node 22; the inspected host runs Node 24, which produces a harmless local engine warning. CI uses Node 22 as declared.

## Official references reviewed

- Firebase callable functions: https://firebase.google.com/docs/functions/callable
- Secret parameters and explicit secret binding: https://firebase.google.com/docs/functions/config-env
- Rules emulator unit testing: https://firebase.google.com/docs/rules/unit-tests
- Firestore transactions and retry behavior: https://firebase.google.com/docs/firestore/manage-data/transactions
- Firestore schema/field validation: https://firebase.google.com/docs/firestore/security/rules-fields
- App Check for callable Functions: https://firebase.google.com/docs/app-check/cloud-functions
- Gemini key confidentiality and server-side calls: https://ai.google.dev/gemini-api/docs/api-key
