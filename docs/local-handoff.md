# WishPlan — local implementation handoff

## Scope and location
- Working source: C:/Users/Admin/Documents/WishPlan/source
- Baseline backup: C:/Users/Admin/Documents/WishPlan/baseline.bundle
- Baseline: 5c2d6d889f13dc549604c7fdfd0e16bfb7070c46
- Branch: fix/wishplan-security
- No commit, push, remote deployment, cloud migration, billing enablement or credential rotation performed.

## Implemented locally
- WishPlan branding outside KOL business content; L.ASY remains in KOL evaluation.
- Existing routes and original storage identifiers preserved where possible. KOL now uses explicit UID/guest history boundaries.
- Removed browser-embedded model credential, custom phone/password authentication and unverified password reset.
- Firebase Google Auth/UID-scoped Firestore implementation, persistent deletion tombstones, explicit sync and server callable AI with Auth/App Check, server approval and transaction-based quotas. Cloud config is intentionally empty; no old project is used automatically.
- Disabled unsafe cross-window bookmarklet/console extraction. Manual HTML/JSON import remains available.
- Missing metrics remain unknown; incomplete audits return N/A and coverage instead of invented scores.
- Hardened imported history and nominal numeric rendering; asynchronous FileReader and transition callbacks are invalidated at auth transitions, including A→B→A.
- Temple is explicitly solo; no public MQTT or cross-tab state transport. NPC/solo activities remain.
- Image file/pixel/canvas limits and decode/export error handling. Grab chat text rendering hardened; Grab remains a simulation.
- CI test gates and public-only Pages artifact staging; local credential/log exclusions.

## Parent verification on current working tree
- npm run test:ci: SUCCESS.
- Unit/application tests: 49 pass, 0 fail; 9 emulator-dependent cases explicitly skipped in this first stage.
- Actual Firestore/Realtime Database emulator stage: 9 pass, 0 fail, 0 skipped. Includes owner access, cross-user denial, tombstones, real frontend snapshot compatibility and quota contention.
- Total distinct passing test cases across both stages: 58.
- npm audit --omit=dev --audit-level=high: 0 vulnerabilities at verification time. Developer-tool advisories remain documented separately; production audit is not an audit of every dependency.
- Browser smoke: homepage plus all four tools opened locally. Real generated PNG loaded through file input, decoded and rendered to a 120×120 output canvas. Sparse synthetic KOL JSON produced N/A/insufficient-data; AI unconfigured error is truthful, not fabricated analysis. Auth modal states public config is missing.
- JavaScript syntax checks and git diff --check passed.
- Independent first review found two history-import security bugs; both received regression tests and fixes. Final independent re-review PASSED with no remaining concrete blockers in the reviewed changes. Reviewer independently ran 49 unit tests successfully and diff checks; the 9 emulator cases were run by the parent.

## Deliberate functional changes
- Bookmarklet/console automation is OFF. Use manual exported HTML/JSON.
- Temple multiplayer is OFF. Solo and NPCs remain.
- Firebase login/sync/AI do not work live until a project is configured and deployed. No live login, provider response or production rules verification is claimed.

## Remaining cloud work / permissions
1. Select and grant access to a Firebase project; enable Google provider and authorized domains.
2. Review and deploy rules in staging, populate public firebase-config.js and configure App Check.
3. Set server secret securely and approve allowed AI users; configure quota/billing only with permission.
4. Revoke/rotate the old exposed provider key with the owning account; deleting it from source does not revoke it.
5. Migrate old phone-owned cloud records only with verified ownership mapping and a backup; do not auto-merge local guest data into a user account.
6. Verify live auth, cloud sync, rules and AI end-to-end; obtain approval before push/deploy to production.

Use docs/firebase-security.md for detailed setup prerequisites. Source archive excludes .git, dependencies, runtime state, logs and local secrets; run npm ci --ignore-scripts after extraction.
