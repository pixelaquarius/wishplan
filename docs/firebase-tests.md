# Firebase test evidence — November 24, 2026

All commands below were actually executed locally against this working tree. No commit, push, Firebase deployment, billing enablement or live model call was performed.

## TDD red → green observations

| Slice | Observed red | Observed green |
| --- | --- | --- |
| Callable authentication | New test failed because `functions/analyze-kol.cjs` did not exist | Authentication test passed after handler creation |
| Callable input/feature/quota boundary | 3 tests failed with missing rejection / `undefined` instead of `{text}`; unauth test still passed | All 4 handler tests passed after strict payload validation, disabled-by-default switch and quota-before-provider orchestration |
| Quota state machine | New quota module import failed before implementation | 3 quota tests passed for increment/reset, user/global limits, corrupt counters and unapproved access |
| Provider transport | New provider module import failed before implementation | 2 provider tests passed using **injected local response fixtures**, not a live API |
| Owner snapshot access | Against default-deny rules: 5 emulator tests, 3 pass / 2 fail (`PERMISSION_DENIED` on valid owner records) | Owner create/read/list/update/delete and negative isolation/schema cases passed after rules implementation |
| Full legacy record | Full-field fixture failed with Firestore's 1,000-expression evaluation limit | Full record and null-metric rewrite passed after reducing optional-metric validation overhead |
| Tombstone compatibility | New tombstone test failed with `PERMISSION_DENIED` when writing the frontend's deletion shape | Tombstone write/repeat succeeds; stale active rewrite and physical tombstone removal are denied |

The full-record issue is why schema limits and nested-data limitations are explicitly documented, not hidden behind a tiny passing fixture.

## Final verification

- `npm ci --ignore-scripts`: successful from root npm workspace; reproducible lockfile installation.
- `npm test` on host Node **24.14.1**: **45 tests; 37 pass, 0 fail, 8 explicitly skipped emulator-only cases**. This aggregates all current child frontend suites as requested.
- `npx --yes --package=node@22 node --test tests/*.test.*` using Node **22.23.5**: **45 tests; 37 pass, 0 fail, 8 explicitly skipped**. This also verifies the declared CI/runtime Node major rather than assuming compatibility from the host.
- `npm run test:firebase`, after adding portable Java **21.0.13.1** to PATH: **8 tests, 8 pass, 0 fail, 0 skipped**. Emulators: Firestore **1.22.0**, RTDB **4.11.2**, project **demo-wishplan**, loopback only.
- The real Firestore transaction integration test seeds synthetic server-only counters at 4/5 requests, launches three concurrent quota consumers, and verifies **one** success plus stored user/global counts of **5**. Remaining requests reject with `resource-exhausted`; unapproved UID rejects with `permission-denied`.
- The callable wrapper test runs a local HTTP server and verifies missing App Check is rejected by Firebase's SDK (`401`, `Unauthenticated`) before the custom handler; it also verifies the `GEMINI_API_KEY` secret binding and direct handler auth rejection.
- `npm audit --omit=dev --audit-level=high`: **0 vulnerabilities**.
- Root developer-tool audit after a compatible audit fix and `@grpc/grpc-js` **1.14.7** override: **14 moderate**, **0 high**. These are not represented as fixed. No forced downgrade of Firebase tooling was applied.
- `git diff --check`: clean after removing an extra workflow EOF blank line.

Expected permission-denied logs are emitted by negative emulator cases. The current emulator can also report expression/evaluation errors while rejecting malformed records; valid full records and legitimate updates succeed in the explicit positive tests. This evidence is not production verification.

## Environment and remaining boundaries

Java was missing on PATH and no standard installation was found. Adoptium metadata returned HTTP 403. A portable Azul JRE was downloaded and extracted under Hermes scratch without a system installation, and the actual emulator suites ran successfully. No Java blocker remains for this session; the scratch install is disposable.

The Functions runtime is Node 22, while the host default is Node 24, so root npm install emits an engine warning. The Node 22 test run passes. App Check provider registration, Google sign-in settings, cloud IAM/rules, Secret Manager values, model selection/availability, budgets and any cloud deployment remain manual, separately authorized prerequisites. The Pages workflow was edited and YAML-linted locally but not executed on GitHub.
