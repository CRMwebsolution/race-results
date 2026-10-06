# RaceHoller coding handoff

October 6, 2026 • `CRMwebsolution/race-results` • branch `main`

Application checkpoint: `2f88bcfcf6520eae300b94cf7f31486c3e8aa427`. Resolve the final documentation/test checkpoint with `git log -1 --format=%H -- docs/FIXES_1_10_REPORT.md`. All authorized groups were committed/pushed directly to main; no feature branches or PRs. Supabase: `kzugyadzbqnurwbkmrik`. Public alias: https://race-results-nu.vercel.app

## Delivered scope

Groups 1–9 implement visible series roster/bonus records and complete reads; independent track/series class defaults and event CRUD; five account modes/mobile workflow navigation/real track settings; password changes; live-priority chronological discovery and draw/pass/rank sorting; immutable official versions; dedicated independent judges; stable-identity per-class championships; and durable prepared-event offline scoring.

Group 10 adds CI, SQL integrity guards and real Auth/deployed browser acceptance. Acceptance repaired three additional application defects: capped overview counts, invalid query-only server-action redirects, and retrying application version conflicts. Detailed evidence and source anchors are in `docs/FIXES_1_10_REPORT.md`. A Word completion report accompanies the repository Markdown for the owner.

## Rules to preserve

- Tenant membership and checked RPCs enforce authorization; account mode is a presentation preference, not an entitlement.
- Copy defaults into independent event classes. Preserve stable series-class/racer identity links; never match championship racers by name.
- Completed inputs/metadata are locked. Owner reopening retains official versions; subsequent completion appends. Populated/historical events withdraw rather than erase history.
- Championships use latest official completed snapshots and produce per-class standings. Ties receive full placement/bonus awards; per-event bonuses deduplicate racer identities; full attendance waits for the complete nonwithdrawn schedule.
- Prepared attempts are committed to IndexedDB before Saved on device. Uploads are ordered and receipt-idempotent. Conflicts require a deliberate choice; open offline sessions block completion. Class/roster setup and judge entry remain online.
- Application optimistic conflicts return `PT409`, not `40001`: PostgREST 14 retries explicit 40001 errors indefinitely. Do not reintroduce that code for a stale version. Genuine database transaction serialization errors are separate.
- Server-action redirects include a full application pathname. Query-only `redirect('?…')` fails in the installed Next runtime.
- Critical lists paginate using `readAll`; count summaries use checked exact count queries. A 1,000-row API cap is not the end of an event.

## Validation and operational state

49 unit/queue tests; 27-migration replay; nine SQL role/workflow suites; live rollback checks; lint, TypeScript and webpack production build passed. GitHub Actions and Vercel succeeded at the application checkpoint.

Deployed Chromium/mobile verified mode preferences, series CRUD, event order, 1,205-entry scorer/public/CSV, real websocket updates, blocked-websocket polling/reconnection and permissions. Firefox desktop and WebKit mobile passed mode/preferences, series CRUD and permissions. Real password old/new credentials and two browser operators' conflicting saves were checked. A real disconnected Chromium session survived server shutdown/reload and synced two operations exactly once.

Final acceptance: complete for automated scope. The deployed judging/championship/event CRUD journey, password, concurrent scoring and spectator ordering all passed without retries. Large-event finalization verified 1,205 valid attempts and ranks 1–1,205. The disconnected rerun uploaded two durable edits exactly once and closed its device session; guarded cleanup removed the disposable workspace and all seven test accounts. The remaining manual/provider checks below are not claimed as passed.

Applied batch migrations: `20261006175457`, `20261006180352`, `20261006181108`, `20261006182037`, `20261006185036`, `20261006191736`, `20261006200522`. Filenames match live versions. The last migration changes function bodies only; signatures/types remain unchanged. Customer/legacy tables were retained.

## Remaining scope and limits

Phase 4 is unimplemented: billing, Stripe/webhooks, quotas/admin grants, racer accounts/self-service registration, archive expiry/retention and pit displays. Teams/head-to-head/elimination remain later expansion and unsupported formats are rejected.

Manual/provider follow-ups: real confirmation/recovery/reauthentication emails; naturally expired sessions; physical iOS/Android offline testing and a full race-night load; first-time promoter UX review; cross-deployment offline queues and browser-storage eviction. Leaked-password protection remains confirmed disabled (Pro plan confirmed); check Auth settings before claiming it is enabled. Judges must already be track/org staff; invitation automation is not implemented.

Offline synchronization requires an open app after reconnection and working device storage. Clearing site data or device loss can remove unsynced edits. All-browser acceptance and physical-device verification are distinct; the automated results do not certify devices/email delivery.

## Resume safely

Inspect the latest remote main before coding and read `docs/ROADMAP.md`, the detailed report and `tests/e2e/README.md`. Run `npm ci`, `npm run lint`, `npm test`, `npm run test:db`, `npm run typecheck`, `npm run build`. Browser tests need fresh private disposable fixtures and are skipped without them. Suites sharing fixture accounts run sequentially because global sign-out revokes other sessions. Never seed or score customer events for acceptance.

Use additive migrations and checked writes, preserve data/history, and pair any new owner-facing Markdown report with a Word document. Continue the authorized coherent-group test/commit/push workflow on main unless the owner changes it.
