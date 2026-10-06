# RaceHoller: fixes 1–10

Implementation and acceptance report • October 6, 2026

Repository: CRMwebsolution/race-results. Work was committed and pushed directly to main in coherent groups, with no feature branches or pull requests. Supabase project: kzugyadzbqnurwbkmrik. Public deployment: https://race-results-nu.vercel.app

**Outcome:** Automated acceptance for fixes 1–10 is complete. The continuation corrected test selectors and finished the previously incomplete checks; no further application-code or schema corrections were needed. Physical-device, email-delivery and password-protection follow-ups remain clearly separated below.

Application checkpoint: `2f88bcfcf6520eae300b94cf7f31486c3e8aa427`. The final report/test checkpoint is the later main commit containing this document; resolve it with `git log -1 --format=%H -- docs/FIXES_1_10_REPORT.md`.

## What changed

| Fix | Delivered behavior | Initial main commit |
| --- | --- | --- |
| 1. Saved series data and complete reads | Bonuses and roster racers display immediately and after reload; ambiguous class relationships are explicit, errors are visible, and critical reads paginate. | 55961a9 |
| 2. Defaults and event management | Series races receive independent copies of series classes/rules/fees/configuration; regular races copy track defaults. Classes can be added, reordered or safely removed; events can be edited or deleted/withdrawn. | 88f9d13 |
| 3. Mobile navigation and account modes | Registration offers the five requested modes, settings can change them, and relevant dashboard sections follow the choice. Event steps have labeled mobile controls; Track Settings contains actual details and defaults; Manage Seasons was removed from track navigation. | 137b37f |
| 4. Password changes | Account settings verify the current password, validate the new password/confirmation, update Auth credentials and expose the provider's verification-code flow when required. | 18d0eb4 |
| 5. Discovery and result sorting | Live races take priority globally; remaining eligible races sort by ascending race date with stable ties. Staff/spectators can choose draw order, rank, any available pass and direction; print/CSV identify the order. | 7472ec8 |
| 6. Official history | Finalization records immutable versioned inputs, configuration, ranks, scores and publication metadata. Reopening retains the prior version; refinalizing appends a version. Completed views use stored official values. | 018d5a5 |
| 7. Independent judges | Dedicated assignments, rubric scores including zero, required judges/rounds, sum/average aggregation, per-judge permissions, correction history and completeness checks replace points stored as elapsed time. | 866ba23 |
| 8. Championship standings | Stable racer/class links feed versioned per-class standings from official race snapshots, placement bands, bonuses and audited manual adjustments. Public standings include race breakdowns; rebuilding does not duplicate awards. | 42fbb04 |
| 9. Offline scoring | Prepared timed/distance races use a persistent device database and ordered upload queue, survive reload without signal, retry on reconnection and resolve conflicts deliberately. Open device sessions block finalization. | 42dade0 + 6c1c879 |
| 10. Acceptance and integrity | Added migration/workflow checks, deployed browser scenarios and CI; repaired large-event counts, redirect failures and API conflict retries uncovered by real acceptance. | 6c1e204 + a7bde14 + 2f88bcf |

## Validation completed

| Evidence | Verified coverage |
| --- | --- |
| Unit and queue tests | 49 passing tests in 11 files: arithmetic, ties, parser/configuration, ordering, complete reads, CSV safety, realtime recovery, offline receipts/conflicts/account scope/storage errors/closing. |
| Database replay | All 27 migrations replayed into empty Postgres; all nine role/workflow SQL suites passed. The harness stubs Auth roles/publication setup and is not a full Supabase stack. |
| Live database | Each new migration was applied to the named project. Relevant live role/workflow suites ran with rollback; final conflict, judging and championship suites passed after the PT409 correction. |
| Compilation and automation | ESLint, TypeScript and webpack production build passed. GitHub Actions and Vercel both succeeded for checkpoint 2f88bcf. CI includes all local checks above; authenticated browser tests run separately with private fixtures. |
| Deployed Chromium mobile | Five modes and settings changes; immediate/reloaded/edited/deleted roster and bonus records; independent class order; 1,205 scorer/public rows and CSV; websocket delivery, blocked-websocket polling, reconnection, pass three; owner/scorer/outsider routes. |
| Firefox desktop and WebKit mobile | All six combined core scenarios passed: account-mode/preferences flows, series roster/bonus editing and role-restricted management routes in each engine. This is automated browser coverage, not physical-device certification. |
| Real Auth credentials | Wrong current password rejected; actual password changed through settings; old credentials rejected, new credentials accepted; disposable account password restored. |
| Competing browser operators | Two independent owner/scorer contexts submitted the same saved version. Exactly one save succeeded, one showed a conflict, the database version incremented once, and the losing draft survived reload. |
| Disconnected browser | A 390×844 Chromium session prepared an event, lost networking and the local production server, recorded a pass, reloaded the cached workspace, retained the pass, added a second pass, reconnected/synced and closed its device session. The continuation repeated this successfully: stored values 7.321/7.500, exactly two new operation receipts, one version increment per pass, zero open device sessions and no page overflow. |
| Full judging/championship journey | Passed the complete deployed journey: independent judges (including zero), missing-score blocking, 25-point then 30-point official versions, unchanged old history, public/CSV output, placement/bonus/manual-award totals, duplicate-free rebuild, public breakdowns, empty deletion and populated withdrawal. |
| Large-event official snapshot and final smoke | Passed with 1,205 valid timed attempts, all 1,205 eligible official results and consecutive ranks 1–1,205; completed public results included the last racer. Final combined deployed smoke: password, two-browser conflict, complete journey and live-first chronological spectator feed all passed. |

## Issues acceptance found and corrected

Saved-but-invisible series records were caused by ambiguous PostgREST foreign-key embeddings returning PGRST201. The queries now identify the relationship explicitly and reject failed reads instead of presenting an empty successful list.

The large-event overview asked for an exact count but displayed the capped array length, reporting 1,000 instead of 1,205. It now uses a checked head/count query; scorer/public input reads paginate to completion.

Judging saved correctly but then failed during a query-only server-action redirect. Next.js attempted to parse the redirect as an absolute URL and returned a server error. Judging, championship and other affected form redirects now contain their full application path.

Explicit optimistic conflicts used SQLSTATE 40001. In the project's PostgREST 14.5 runtime, that code caused continuous transaction retries and a hanging save instead of a useful error. Six checked RPCs now return PT409/HTTP 409 for application version conflicts; genuine PostgreSQL serialization failures keep their normal semantics. The offline queue recognizes the new response and retains compatibility with the previous code. Supabase documents this behavior and the PT409 remedy: https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b

A large lockfile transfer was initially truncated. Follow-up commit 6c1c879 restored its exact contents before subsequent deployment. Transfers now verify each blob and the complete Git tree before updating main; corrected and later deployments passed.

## Acceptance continuation

The October 6 continuation reran all 49 unit/queue tests, all 27 migrations and all nine fresh-database SQL suites, lint, TypeScript and the production build successfully. All nine SQL suites also passed against the live project in rollback transactions. The deployed 1,205-racer finalization test verified 1,205 stored official entries, valid timed attempts and eligible results, consecutive ranks 1–1,205, public rendering after completion, and reopening.

The full judging journey passed judge assignments, zero-point scoring, missing-judge blocking, public/CSV official values and two retained official versions. Its initial championship pause was a test-selector defect: an exact label did not match the select containing option text. The harness now targets the form controls by name and applies finite action/navigation timeouts with failure evidence. A second selector expected a name alone even though each public row contains rank, name, class and points. It now checks the full standings row and opens the manual-award breakdown. The corrected combined run passed all four scenarios without retries; the large-race test separately passed with 1,205 valid attempts, eligible results and consecutive ranks 1–1,205.

The security advisor reports intentionally callable, authorization-checked definer functions, rather than missing RLS errors. Public predicates return authorization booleans, and the public organization-name helper returns the series organization display name. Authenticated mutation RPCs have role/workflow regression coverage. Retain these explicit API grants with checked authorization; do not remove grants blindly and break public policies. Advisor references: [public functions](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Product rules now in place

- Class defaults are snapshots. Editing one race does not rewrite another race or the series/track defaults. New series races use series defaults. Previously untouched scheduled/draft races with no classes were initialized once.
- Empty events without official history can be deleted. Events with racers or official versions are withdrawn so their history remains. Completed metadata/results stay locked until an owner reopens the event.
- Operating mode controls presentation, while database membership controls permissions. Choosing multi-track or series mode does not grant unpaid capacity; paid entitlements belong to Phase 4.
- Race feeds prioritize live events, then order by date from earliest to latest. Draw/pass/rank sorting changes display only, and the operator's rows stay stable while an input remains focused.
- Official history includes the scoring version and exact accepted inputs. Reconstructed older finals are labeled honestly; an unknown original finalization time is not invented.
- Judges must already have authorized track/organization access. The promoter assigns their class/rubric; each judge edits only their assigned submissions. Missing required submissions block completion.
- Championships are per class. Placement ties receive full points and shared competition ranks. Fastest/consistency bonus ties receive full awards; once-per-event bonuses deduplicate stable racer identities across classes. Full attendance is awarded once only after every nonwithdrawn scheduled race is official.
- Names do not establish identity. Unlinked historical entries are excluded rather than guessed; promoters must deliberately map them and refinalize. Custom/showmanship adjustments retain actor and reason; corrections use audited negative awards.

## Using offline scoring at a race

Prepare the event on each scoring device while online after setting up classes and racers. Confirm the offline-ready state before losing signal. Enter times or distances normally; Saved on device means the edit is committed to that browser's local database, and the displayed results are provisional until uploaded.

Keep the app open after reconnecting or use Retry uploads. A conflict requires choosing the current server value or deliberately reapplying the device value. Finish every device session after uploading; an owner can release an abandoned session only with a recorded reason. Official completion is blocked while sessions remain open.

The initial offline scope covers prepared scoring attempts. Class/roster restructuring and independent judge score entry require connectivity. No upload is promised while every browser window is closed. Expired/revoked sessions require signing back in; queued edits are retained. Browser storage must remain available—clearing site data, private-browser eviction or device loss can remove unsynced local data. A site deployment can require reopening the current online dashboard before retained edits upload through current server actions.

## Remaining checks and Phase 4 boundary

The code work for groups 1–9 is delivered, and group 10 has the automated coverage listed above. Manual/provider checks remain explicit:

- Actual confirmation, recovery and reauthentication-code email delivery; naturally expired sessions; physical iPhone/Android airplane-mode testing and long race-night operation.
- Supabase leaked-password protection remains disabled/unverified. The connector could not verify/change the Auth setting or paid-plan availability. Check it in project Auth settings before claiming it is enabled.
- Real mobile usability review with a track operator. Navigation/actions are exposed and browser-tested; that does not prove the setup flow is intuitive to a first-time promoter.
- Cross-deployment queued uploads, browser-storage eviction and a full night of conflicting offline edits still deserve field verification. Basic disconnected reload/sync and conflicts have distinct browser/unit evidence above.

Phase 4 was not implemented: Stripe checkout/webhooks/customer portal, tiers/quotas/admin grants, racer profiles/self-service registration, archive retention/expiry and pit-screen display remain next work. Head-to-head/elimination and team formats remain later expansion; unsupported formats are rejected instead of silently scored as fastest pass. Legacy season routes/data were retained. The ordinary track default-class picker lists four formats; stopped-distance classes remain available in the per-event editor.

The strongest improvement is dependable race data: explicit failures, complete reads, checked writes, historical official results and recoverable device scoring. The remaining product work is monetization, real-world usability and field validation; polished navigation and sound database tests do not substitute for those checks.

## Migration and source handoff

Applied migrations for this batch, in order: 20261006175457 event defaults/management; 20261006180352 official results; 20261006181108 multi-judge scoring; 20261006182037 championships; 20261006185036 offline operations; 20261006191736 acceptance guards; 20261006200522 PostgREST conflict responses. Earlier foundation/atomic repair migrations remain part of the 27-file replay. Existing customer and legacy data were preserved.

| Area | Repository paths |
| --- | --- |
| Modes/navigation/settings | `src/lib/account-mode.ts`; `src/components/dashboard-nav.tsx`; `src/app/dashboard/settings/`; track `settings/` and event `layout.tsx`. |
| Series setup/read errors | `src/app/dashboard/series/[seriesId]/points/page.tsx`; `roster/page.tsx`; `classes/page.tsx`; `schedule/page.tsx`; `src/lib/read-all.ts`. |
| Event CRUD/class defaults | `src/components/event-class-list.tsx`; `src/components/scoring-fields.tsx`; `src/app/dashboard/tracks/[trackId]/events/`; migration `20261006175457`. |
| Scoring/race order/live recovery | `src/scoring/`; `src/lib/race-order.ts`; `src/lib/event-sync.ts`; event `scoring/`; `src/app/r/[slug]/[eventSlug]/live-leaderboard.tsx`. |
| Official/judged results | `src/lib/official-results.ts`; `src/scoring/multi-judge.ts`; event `judging/page.tsx` and `settings/actions.ts`; migrations `20261006180352`, `20261006181108`. |
| Championship calculations | `src/championship/calculate.ts`; series `standings/page.tsx`; `src/components/series-standings.tsx`; public `src/app/s/[seriesId]/page.tsx`. |
| Offline persistence/sync | `src/lib/offline/`; `src/app/offline/page.tsx`; `src/components/account-safety.tsx`; `public/raceholler-sw.js`; migration `20261006185036`. |
| Acceptance/automation | `tests/e2e/`; `scripts/check-offline.mjs`; `scripts/test-database.mjs`; `supabase/tests/`; `.github/workflows/ci.yml`. |

Read `docs/REPAIR_HANDOFF.md` and `docs/ROADMAP.md` before the next coding session. Run `npm ci`, `npm run lint`, `npm test`, `npm run test:db`, `npm run typecheck`, `npm run build`. Browser fixture instructions are in `tests/e2e/README.md`; missing fixtures mean skipped tests, not a verified pass.

Fixture cleanup: complete. A guarded transaction checked the exact test track, series, organization, seven test-only accounts and absence of unrelated memberships; revoked refreshable sessions; removed the test workspace, related official/judge/award records, and all seven Auth accounts; and asserted absence afterward. Customer and legacy workspaces were outside its scope. Provider audit-log retention is unchanged.
