# RaceHoller repair progress

Started from main at d0fd7a26a2f5238b79146648778c1ada71976cb4 on October 6, 2026.
Changes are committed in tested groups directly on main, as requested.
The Supabase target is kzugyadzbqnurwbkmrik; migration filenames match its applied history.

## Group 1: Tenant permissions

- Removed arbitrary organization self-enrollment; onboarding still uses atomic authenticated RPCs.
- Officials retain scoring rights without membership/track administration rights.
- Added track-transfer checks, restricted ghost-track provisioning, and secured RPC execution grants.
- Protected private profiles and entitlement columns; audit writes are reserved for checked RPCs.
- Fixed anonymous schedule/result access and safe public promoter-name reads.
- Scoped dashboard listings and guarded dashboard/series management pages.
- Normalized the generated type file to UTF-8 for readable changes.

Validation: 23 existing tests, TypeScript, production build, diff checks; live rollback SQL
tested owner, official, member, outsider, platform-admin, and anonymous roles before and after
applying the migration. Fixtures were rolled back, including Auth users.

## Group 2: Schema consistency

- Captured the live series-creation RPC and Auth profile trigger in migrations.
- Retained legacy season tables and policies additively, preserving existing data.
- Added missing bonus timestamps and fixed the damaged historical final-rank migration.
- Track creation saves state atomically; event creation copies default classes atomically.
- Enforced event/series organization scope and roster/bonus class scope in Postgres.
- Revoked client access to retired SECURITY DEFINER RPCs without deleting their definitions.
- Replaced the nonexistent billing-status query with an explicit pending state and fixed public event links.
- Regenerated database types from the live project; added `npm run test:db` for full migration replay.

Validation: empty Postgres replay, live rollback workflows (Auth profile creation, registration state,
series creation, event defaults, rejected foreign scopes and unauthorized creation), unit tests,
TypeScript, production build, and diff checks. PGlite uses Auth role stubs, not the Supabase HTTP API.

## Group 3: Scoring and ranks

- Combined times include penalties and reject invalid pass counts; partial configs retain defaults.
- Distance secondary passes rank greater distances first, with missing passes last.
- One versioned dispatcher rejects unimplemented formats/versions instead of silently using fastest pass.
- One competition-rank helper uses all sporting tiebreakers; true ties share numeric ranks (1,1,3), and ineligible entries are unranked.
- Spectator lists, CSV and print outputs follow scoring order; the scoring desk retains draw order.
- The parser preserves original input, supports feet plus inches, and returns validation errors for zero times, invalid text and numeric overflow.
- Finalization uses shared ranks, clears stale ranks on ineligible entries, and checks query/write errors; atomic finalization is addressed in group 4.

Validation: 30 tests including new regression cases, TypeScript, production build and diff checks.

## Group 4: Atomic saves, completion and recovery

- `save_race_attempt` locks its event and validates track/event/class/entry scope and the expected cell version before upserting.
- Database triggers revise attempts, entries and classes atomically, using `working_revision + 1`; live changes promote the same revision. Drafts remain unpublished.
- Direct client attempt writes are revoked; official scoring remains available through the checked RPC.
- `complete_race_event` validates the calculation revision and full entry coverage, writes all ranks and changes event status in one transaction.
- Completed attempts, classes and roster edits are blocked in Postgres. Reopening clears old ranks.
- Track/organization owners control lifecycle publication and reopening; platform admins retain emergency authority. Ordinary administrators and officials cannot bypass this restriction.
- Every lifecycle change writes an immutable client-protected audit row; completion and reopening have explicit action names.
- The scoring desk distinguishes editing, saving, unsaved errors, confirmed saves and locked finals. Only confirmed attempts affect scores. Cell inputs are controlled; pending cells are disabled.
- Failed/unfinished input remains in the grid and in session storage when browser storage is available; successful saves clear their drafts. Existing penalties survive edits.
- Public event subscriptions remain attached across revisions and handle status changes, reconnects, online/focus/visibility recovery and 15-second fallback checks. The refresh indicator uses the actual router transition.
- `create_race_entry` allocates `max(order_num)+1` under the event lock, validates route scope and preserves explicit draw numbers. Roster mutation errors are displayed.
- Track dashboard routes now require actual membership. Scoring and lifecycle pages additionally enforce their respective role requirements.
- Updated `docs/ROADMAP.md` to distinguish current implementation from pending snapshots, tier controls, multi-judge workflows and modern championship standings.

Validation: 35 unit/regression tests, replay of all 20 migrations into empty Postgres, all three SQL
workflow suites against the live project with rollback, TypeScript, production build and diff checks.
The live atomic suite covers rapid revision increments, version conflicts, invalid-write rollback,
stale/incomplete finalization, completed-result locks, owner-only lifecycle rights, audit records and roster numbering.

## Commits and operational state

| Group | Commit on main |
| --- | --- |
| Tenant permissions | `1de99d28a06b51ac3ac407e2fba418f914eb3fd0` |
| Schema consistency | `740da76` |
| Shared scoring and ranks | `1e3e098` |
| Atomic saves and recovery | The commit containing this completed checkpoint; resolve with `git log -1 --format=%H -- docs/REPAIR_HANDOFF.md` |

New migrations are applied to `kzugyadzbqnurwbkmrik`, and source filenames match remote versions:
`20261006140717`, `20261006141908`, `20261006143227`, `20261006143818`.
Generated types were refreshed from that project after schema changes. Existing legacy tables/data were retained.
No application deployment or production-browser validation is claimed; a successful local build verifies compilation.

## Remaining work and practical limits

- Phase 4 billing, Stripe integration, quota/tier enforcement and self-serve racer registration remain unimplemented.
- Modern series championship standings still need class/roster mapping, event-rank aggregation and bonus application. Legacy season routes remain for compatibility.
- Official immutable snapshot history is still missing: completed data is locked, but owners can reopen it, and public ranks are calculated with the current engine.
- Judged points remain a basic aggregate using attempt-time storage. Dedicated judge identities, rubrics, zero-point storage and multi-judge workflows are pending.
- Head-to-head and team formats are not implemented; the dispatcher now rejects them explicitly.
- ADR-002 archive expiry and retention enforcement are not implemented. No records were expired or deleted by these repairs.
- Tests do not exercise real Auth emails/cookies, deployed browsers, actual websocket delivery, multiple simultaneous database connections, device/offline behavior or large-event API pagination. Recovery logic is tested with mocked transport; SQL locking/conflict behavior is tested through real Postgres transactions.
- Session draft storage is best effort and scoped to the current browser session; it is not an offline scoring queue.
- Supabase security advisors still report intentional client-callable SECURITY DEFINER helpers/RPCs and disabled leaked-password protection. Helpers/RPCs were role-tested and retired endpoints revoked; the Auth password setting remains a project configuration follow-up.

To resume: work on main, inspect its latest remote head, read this file and `docs/ROADMAP.md`, then
run `npm ci`, `npm run test:db`, `npm test`, `npm run typecheck` and `npm run build`. SQL test fixtures
are wrapped in transactions and rolled back. The Postgres harness stubs Supabase Auth role functions
and publication setup; it does not run a full Supabase stack.

## Audit fixes 1–10: group 1 checkpoint

- Live PostgREST reproduced PGRST201 for both series list embeds. Explicit composite FK hints return the saved roster/bonuses successfully.
- Series mutations redirect with provider errors; dashboard has a retry boundary for failed reads/actions.
- Shared paginated reads cover series, event scoring/finalization and public result inputs; failures reject partial data.
- Validation: 37 unit tests, 20 migration replay, existing SQL suites, TypeScript/build, live anonymous API before/after query comparison. Authenticated browser workflows are reserved for group 10.

### Audit group 2: event defaults and management

Series event insertion copies names/rules/fees/order/scoring configuration transactionally with stable series-class links. Untouched existing draft/scheduled events are initialized once. Event class reorder, allocation and removal use checked locked RPCs. UI includes drag/drop plus move buttons, independent rules/configuration, checked edit actions, and confirmed event deletion/withdrawal. Populated/completed events retain history via withdrawal. Empty venues can move atomically before registration; completed metadata is locked.
Validation: 21-migration replay and event-management rollback workflow locally and on the live project; unit tests, TypeScript and production build. A corrupt Turbopack cache was moved aside and the clean build passed. Migration 20261006175457 is applied; types regenerated.

### Audit group 3: account modes and mobile navigation

Five exact operating modes are offered at registration and persisted in Auth user metadata; account settings allow switching. Dashboard track/series sections follow those preferences while access checks remain unchanged. Existing accounts see a selection reminder and retain all access. Navigation now exposes account settings and a labeled event workflow on small screens; controls wrap and receive visible focus/touch sizing. Track details/state/timezone and defaults are separate settings sections. Manage Seasons was removed from track navigation; legacy data/routes remain. Branding now reads RaceHoller.
Validation: TypeScript, 37 tests, production build, diff checks. Browser viewport/onboarding acceptance follows in group 10.

### Audit group 4: password changes

Account settings verify current credentials in an isolated nonpersistent Auth client before password update, validate confirmation/minimum length, and expose the provider's email nonce reauthentication flow. Errors and success are visible; passwords are never logged or audited. Callback return paths are restricted to local paths. Leaked-password protection remains unverified/disabled: the connector cannot inspect/change Auth configuration or confirm paid-plan availability; Supabase documents Pro+ as required. Real credential acceptance tests follow in group 10; no email delivery claim is made.
TypeScript, tests and production compilation passed. Repeated Turbopack cache panics prompted selecting Next's supported webpack production builder for stable builds.

### Audit group 5: chronology and result sorting

Spectator home is now a global race feed with live priority, ascending date/id order, track/state and upcoming/results filters, including published finals. Track and series schedules use the same ordering. Staff and spectators can sort run order, rank and every configured/recorded pass in either direction. Adjusted times ascend, distances descend, invalid/missing passes stay last, and display changes never alter draw/ranks. Staff row positions freeze while focus remains inside the input grid. Print/CSV identify the chosen order.
Validation: 39 tests including chronology/pass-sort penalties/missing/distance regressions, TypeScript, production build and diff checks. Actual focus/mobile/browser tests follow in group 10.

### Audit group 6: immutable official results

Completion atomically records versioned event/class configuration, identities, attempts, canonical score labels/details/ties/ranks, source revision, actor and timestamps. Reopening retains every version; subsequent finals append. Completed spectator/staff reads and print output use stored official values without invoking the current scoring engine. Historical completed races receive explicitly reconstructed records with unknown original finalization time/score labels. Authenticated clients cannot write snapshots.
Validation: 22-migration replay, live and local finalize/reopen/refinalize rollback workflow, stale completion/role suites, unit tests, TypeScript/build/diff checks. Applied migration 20261006180352; types refreshed.

### Audit group 7: dedicated multi-judge scoring

Judges have independent assignments and versioned category scores, with zero allowed, limits/precision enforced in Postgres, own-assignment-only writes and correction history. Classes configure required judge counts/rounds, sum or average, and rubric bounds. Owner/staff judging screens expose assignment counts and missing submissions; the normal time grid links to judging instead of writing points as elapsed time. Finalization rejects incomplete judge submissions in both application and database, and captures all judge inputs in official versions. Legacy basic totals are imported without changing numerical meaning; old official snapshots remain unchanged.
Validation: 41 tests (hand-calculated zero/sum/average/missing/duplicate/bounds cases), 23-migration replay, live role/conflict/audit workflow, TypeScript/build/diff checks. Applied migration 20261006181108; types regenerated. Judges must already be authorized track/org staff; invitation automation is outside this group.

### Audit group 8: modern championship standings

Stable series-racer/roster links and explicit event-class mapping replace name matching; importing a series roster is idempotent. Championship rebuilds consume latest official completed versions, reject overlapping placement bands/duplicate bonuses, apply placement and fastest/consistency/full-attendance bonuses, and preserve source/rule versions. Full attendance is awarded once only after every nonwithdrawn published schedule date is official. Ties receive full placement/bonus points and shared competition ranks. Once-per-event bonuses deduplicate racer identities across classes. Audited reasoned manual adjustments cover custom/showmanship and corrections. Dashboard/public portals show event breakdowns; changes/reopening invalidate current standings while retaining historical payloads.
Validation: 44 tests with a hand-calculated multi-class/tied/duplicate-name/withdrawal/manual-award schedule, 24-migration replay, live identity/import/rule/source-validation/invalidation workflow, TypeScript/build/diff checks. Applied migration 20261006182037; types regenerated. Existing unlinked historical entries are explicitly excluded, not guessed or silently remapped; promoters can map and refinalize intentionally.

### Audit group 9: durable offline scoring

Prepared timed/distance events use IndexedDB for the event packet and ordered operation queue. Edits are committed on the device before acknowledgement, survive reload, retain account scope, and retry while the app is open. Operation receipts make lost-response retries idempotent; cell-version conflicts require deliberate server/device resolution. The generic service-worker shell caches app assets without caching private dashboard HTML. Open device sessions block official completion until every device closes or an owner records an audited release. Print/CSV label pending device results provisional. Class/roster restructuring and independent judge entry require connectivity.

Validation: Chromium at 390×844 signed in using real Supabase cookies, prepared the race, disabled networking and stopped the local production server, entered a pass, reloaded into the cached offline workspace, restored the value, entered another pass, restarted/reconnected and synced both. Supabase confirmed each pass at save version 1 with exactly one operation receipt. Session closure succeeded; page width matched the phone viewport. Queue tests cover lost acknowledgements, conflicts, account separation, quota failures and closing races. The local browser runner is `npm run test:offline` with an isolated `RACEHOLLER_FIXTURE_FILE`; it intentionally starts/stops its own local server. Browser proxy certificate handling in this execution environment is a test-only accommodation, not an application TLS setting.

Migration 20261006185036 is applied and generated types refreshed. Next/ESLint checks now use supported commands, result exports quote user labels safely, and completed judge result reads retain captured pass inputs. Group 10 completes deployed acceptance and the remaining guard refinements.

### Audit group 10: acceptance infrastructure checkpoint

Added checked edit forms for placement rules/bonuses, an organization-authority layout for private series routes, optional-storage handling that cannot break online Auth, and stable browser regression selectors. The additive integrity migration prevents changing a championship class underneath linked roster entries, withdraws reopened empty events with official history, and includes read-only confirmed judge totals in offline preparation. Migration 20261006191736 is applied; its workflow passed locally and live with rollback.

The GitHub checks workflow runs lint, scoring/queue tests, all migration/workflow suites, TypeScript and production compilation. Playwright acceptance covers five account modes, immediate/reloaded series CRUD, independent event defaults/order, 1205-entry complete reads/CSV, actual realtime/polling/reconnection, and owner/scorer/outsider routes. Deployed acceptance results will be recorded after this checkpoint deploys. Test fixture credentials remain outside git and are not included in artifacts.

The group 9 transfer briefly truncated the large lockfile. Follow-up commit restored its exact git blob; the push process now transfers base64 chunks and compares every blob plus the complete tree before updating main. Corrected group 9 head: 6c1c879ffbc1996bf927d1d3479b159a1af5cdcc; Vercel reports a successful deployment.
