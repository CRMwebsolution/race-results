# RaceHoller / TrackScore — ChatGPT updates and coding handoff

Prepared October 7, 2026, America/New_York. Application snapshot: `a097bf4bee12f373be73896e9c28bee2ea03dfac` on `main`.

## Scope and evidence

This handoff covers the code and database implementation history AFTER creation of the system blueprint, through completion of Phase 3 and the subsequent owner-reported fixes. The original blueprint was supplied on October 4; its canonical repository copy is `docs/TrackScore-Product-Engineering-Blueprint.md`, introduced with the project scaffold in `c53bd6b`. The change ledger begins with the next commit, `7b6860d`, and includes every subsequent commit through `a097bf4`.

The early scaffold and racing/series implementation are included so another model has a complete project history. Their presence in Git is evidence of delivery, not a claim that this assistant personally authored every early commit. Later repairs, independent competitions, usability updates, four update sessions and Phase 3 closeout are documented below. Historical approaches are explicitly distinguished from current behavior.

Sources checked for this handoff: complete local Git history and relevant diffs; current application source; all 40 repository SQL migration files; the live Supabase migration list; existing roadmap, repair handoff, acceptance report and independent-competition contract; earlier project conversation context. This was a documentation pass, not a new application acceptance audit. No race, contestant, account or database schema was created or changed for it.

## Project identity and current status

| Item | Current value |
| --- | --- |
| Repository | `CRMwebsolution/race-results` |
| Application branch | `main` |
| Public deployment alias | https://race-results-nu.vercel.app |
| Supabase project reference | `kzugyadzbqnurwbkmrik` |
| Names | Original blueprint/database project: TrackScore; current package/UI: RaceHoller |
| Runtime | Next.js 16, React 19, TypeScript, Tailwind, Supabase Auth/Postgres/Realtime |
| Build | `npm run build` uses `next build --webpack` |
| Phase 1 | Implemented: tenant boundaries, Auth, account preferences, scoring contracts |
| Phase 2 | Implemented: event setup, contestants, scoring, live/official results, offline attempt storage |
| Phase 3 | Implementation complete: advanced scoring, independent track/series competitions, class standings, staff/judge invitation links |
| Phase 4 | Not started as a functional product: billing, entitlements, racer self-service/payments, retention enforcement, pit display |

The last application changes were pushed to main. A push is not independent proof that every subsequent deployment completed. Earlier verified CI/deployment results are recorded separately below. Physical-device and provider checks remain outstanding.

## Rules the next model must preserve

### Tracks, series and separate race entry

- A track is a stationary venue with its own races, classes and optional in-house series. It remains a Track in spectator discovery even when it runs an in-house series.
- A touring series is a separate owner with recurring classes and explicitly registered racer/vehicle/class entries. Its races may occur at venues with no track account.
- A touring-series race has a free-text venue description. It has NO account relationship to the hosting track, even when both have accounts and matching names.
- Shared `events`, `event_classes`, `entries` and scoring infrastructure are allowed, but race ownership is exclusively track OR series. Never infer permissions or identity from venue text or racer names.
- Hosting a touring series gives a track owner no series access. A visiting series leaves the track-owned spectator page normal. Separate listings are intentional.
- Registration for a series and signup for a race are separate actions. Every contestant signs up individually at each event, in that event's running order. Bulk adding all series members to a race was removed.
- Local contestants can enter the same race class and compete for prizes without joining the series. Race signup never automatically enrolls them in a series.
- Separate registered vehicle entries have separate registrations and point totals, even when driven by the same person.
- New series seasons start with fresh registrations and fresh totals. Signup bonuses and other deliberate points adjustments may be awarded before racing.
- Late entrants receive zero points for races before membership. Leaving preserves earned points. Official snapshots retain eligibility so later roster edits do not erase history.
- Manual points changes support additions and overrides, require a plain-English explanation, and retain actor/history. Edge cases can be amended deliberately.

### Race results versus points

All entrants determine overall race placing and prizes. Only eligible series registrations determine points placing. Example: Jeremy, Jay, Michael, Scotty, Ronnie, Grumpy finish 1–6. Jay, Michael and Grumpy are members. Race money follows Jeremy 1st, Jay 2nd, Michael 3rd; series points follow Jay 1st, Michael 2nd, Grumpy 3rd.

Standings and point breakdowns are per class. Owner and spectator displays group each class separately. Series owners control public visibility: no points, points per race only, or points per race plus season totals. Tracks without an in-house series show per-race results, not irrelevant season standings.

Current owner standings show one list at a time: latest saved calculation by default, or a selected published snapshot. Published versions remain accessible through version links. Do not render the current calculation and published snapshot as duplicate lists again.

### Scoring, permissions and durable data

- Time & distance is the ordinary combined format (`fastest_pass` internally). Every valid completed timed run beats every noncompleted distance run. Completed runs rank by adjusted elapsed time; otherwise greater distance wins. No track-length calculation is required.
- Distance input supports decimal feet and feet/inches. `-` is accepted for no pass. Blank, DNF and DQ handling remains explicit; none should silently become a successful pass.
- Consistency, combined times, judged points and legacy distance-only scoring remain supported through the shared scoring registry. Unsupported team/bracket formats must fail explicitly.
- Scorer, spectator, CSV and finalization calculations use the same score/rank contracts. Stable competition ranks and ties are intentional; placement/bonus ties receive the configured full awards.
- Checked RPCs enforce authorization, revisions and lifecycle. Account operating mode is a UI preference, not a permission or paid entitlement.
- Only the owner/platform-authorized lifecycle role completes or reopens a race. Race-scoped helpers cannot grant ownership, manage unrelated events or enroll themselves in an organization.
- Completed inputs/metadata stay locked until owner reopening. Reopening/refinalizing appends official versions and preserves old ones. Empty races can be deleted; populated/historical races withdraw instead of losing history.
- Application stale-version conflicts return `PT409` / HTTP 409. Do not use explicit `40001` for these conflicts: PostgREST retries it indefinitely. Genuine PostgreSQL serialization failures are separate.
- Server-action redirects need a full application pathname. Query-only redirects previously caused runtime server errors.
- Critical reads paginate to completion. Exact counts must use the checked count, not the length of a capped 1,000-row response.
- Tables without an `id` need explicit unique ordering in `readAll`. `race_staff` has composite primary key `(event_id,user_id)`; both caller paths pass that ordering.

## Implementation updates by work area

### 1. Foundation, Auth, onboarding and initial racing scaffold

After the blueprint, the first commits introduced a framework-independent versioned parser/scoring engine and tests; organizations, tracks, memberships, audit events and TypeScript database types; browser/server Supabase clients; cookie/session refresh; login, callback, signout and authenticated dashboard scaffolding.

Follow-up work normalized Supabase project URLs; replaced a technical/debug home page with customer-facing navigation; removed the tenant-isolation debug UI from normal onboarding; added track shorthand, generated slugs and simplified venue creation; and replaced raw duplicate-slug constraint errors with a useful owner message.

Architectural decisions recorded platform-admin authority, intended retention rules, automatic live revision publication and owner-only official publication/reopening. The duplicate `PRODUCT_BLUEPRINT.md` was deleted while preserving the canonical blueprint; README links were corrected. These decisions describe intended product requirements: retention and dynamic paid entitlements are still Phase 4, not delivered features.

The initial Phase 2/3 scaffold added track settings/default classes/state; event scheduling and class/entry/attempt tables; running-order editing; score entry and public live leaderboards; scoring variants; CSV/print surfaces; Realtime events; legacy seasons; series configuration/classes/points/bonuses/rosters/schedules/settings; platform-admin overview and profiles needed by Auth. Initial series scheduling used ghost tracks. That ownership approach was later replaced completely for touring series.

The file named `phase_four_profiles_and_monetization` created profile/storage prerequisites and track fields. It does NOT establish implemented checkout, subscriptions, paid tiers or racer self-service. The early Phase 3 commit title likewise did not mean the eventual points engine or acceptance work was finished at that time.

### 2. Permission, schema and scoring repair pass

- Removed membership-policy paths that let callers bootstrap ownership in arbitrary organizations; split scorer editing from management/publication rights; checked track organization reassignment; and narrowed private profile/admin data exposure.
- Added route/workspace checks and allowed the necessary safe public predicates so spectators could read published races. Server-side checks and RLS both matter.
- Reconciled checked-in migrations with inspected live schema, including malformed final-rank SQL, missing columns/types, restored legacy season compatibility, signup profile trigger behavior and missing atomic series creation.
- Made onboarding/track/series/event creation transactional, including copying independent default-class settings. Added scope checks for series classes, bonuses and rosters.
- Unified scoring consumers via a shared registry; corrected penalties, distance tie direction, consistency/combined-time validation and tied competition ranks. Parser/scoring version/configuration errors surface explicitly.
- Added atomic attempt writes, monotonic working/published revisions, expected-version comparisons, lifecycle restrictions and owner audit records. Live races publish revision changes automatically.
- Added Realtime refresh with fallback polling and reconnect recovery. A failed or unavailable read must not masquerade as a successful empty roster.
- Fixed ambiguous foreign-key embeddings causing PGRST201 and invisible saved series classes/rosters/bonuses. Added `readAll`, paginated scorer/public/finalization reads and checked exact overview counts.
- Updated environment examples while keeping service credentials server-only and absent from committed values.

### 3. Management, Auth preferences and public discovery

- Copied track/series defaults into independent event classes, including scoring configuration, rules and order. Editing a race does not rewrite another race or its owner's defaults.
- Added checked class creation/removal/reordering, drag/drop and move alternatives, event metadata editing, deletion/withdrawal and completed-metadata locks. Initialized only untouched scheduled/draft events that lacked classes.
- Added five account operating modes/preferences and tailored dashboard navigation. Exposed mobile race steps and real track settings; removed the stale Manage Seasons entry from ordinary track navigation.
- Added password changes with current-password verification, confirmation and provider reauthentication-code handling.
- Prioritized live races in public discovery, then chronological event ordering. Added consistent running-order/pass/rank sorting and safe CSV/print exports, including spreadsheet-formula injection handling.
- Later added global top-left Back navigation with valid parent destinations even when a page is opened directly.
- Split `/login` from `/register`; returning owners no longer choose track versus series while signing in. Existing assets are prominent; creation controls shrink once the owner already has an asset. If only a series exists, its dashboard section appears above the empty track section.

### 4. Official history, multi-judge scoring and original championships

- Added immutable `event_result_versions` containing accepted inputs, class configuration/scoring version, calculated scores and ranks. Completed public results and exports read the frozen official snapshot.
- Reopening preserves earlier versions; refinalization appends a new version. Reconstructed preexisting finals are identified honestly without inventing an unknown original finalization time.
- Added class-specific judge assignments, rubric scores including zero, required judges/rounds, sum/average aggregation, per-judge permissions, correction history and missing-submission completion checks. Judged points are no longer disguised as elapsed time.
- Added stable racer/class identity mappings, championship rules, bonuses, explained manual awards, publication history and per-event breakdowns sourced from official race versions. Rebuilding does not duplicate awards.
- Bonus behavior includes placement, fastest/consistency ties, once-per-event deduplication and full attendance only after the complete nonwithdrawn schedule is official.
- Historical unlinked entries were explicitly excluded rather than linked by name. Later independent-season registrations superseded the old touring-series roster identity model while preserving legacy records.

### 5. Offline persistence and acceptance infrastructure

- Added a service-worker cached offline shell, IndexedDB prepared races, persistent attempt outbox, account scoping, device IDs, ordered upload queue, idempotent server receipts, retry on reconnection, retained drafts and deliberate conflict resolution.
- Backend offline sessions protect finalization from silently accepting late device uploads. Preparing/synchronizing attempts does not make offline roster restructuring or independent judge entry available.
- Added safe CSV exports and offline packet checks; repaired a truncated lockfile transfer and subsequently verified uploaded file blobs/whole trees before updating main.
- Added a fresh-database migration replay harness, role/workflow SQL suites, Vitest queue/scoring tests, Playwright browser workflows and GitHub Actions CI.
- Acceptance discovered and fixed capped 1,000-row counts, hanging explicit serialization conflicts, invalid query-only server-action redirects, event/identity integrity gaps and test selectors that did not match full standings rows.
- Added finite navigation/action timeouts and failure evidence. Later usability acceptance was split into bounded batches instead of one prolonged run.

### 6. Independent tracks and touring series migration

A new contract in `docs/INDEPENDENT_COMPETITIONS.md` superseded hosting-track/ghost-track assumptions. The application moved to exclusive event ownership plus venue description, checked race-owner permissions, independent organizer routes and owner-specific defaults, registration, scoring, judging and offline operations.

New `competition_*` tables model explicit seasons, classes, registered vehicle entries, points rules, bonuses, explained amendments and published results for both touring series and track in-house series. The migration preserves event IDs, official snapshots, legacy bookmarked track seasons, class/racer mappings and unambiguous manual awards. Existing touring roster records were mapped into an initial explicit season using recorded dates; new seasons start empty.

Official race snapshots freeze eligibility. The calculator compresses points ranks among eligible members while leaving actual race ranks unchanged. Amendments record the calculated amount and retain immutable explanation/actor history. Schedule/season/class changes invalidate affected standings and cannot leave stale cross-season mappings. Special race classes can differ from owner defaults.

Public discovery gained All / Tracks / Series filters. Touring race URLs use `/s/[seriesId]/races/[eventSlug]`; track race URLs use `/r/[slug]/[eventSlug]`. Touring results and track-owned pages remain independent. A migration rehearsal checks preserved historical fixtures; SQL/unit/browser scenarios cover the six-racer points example, local entrants, late membership, multiple vehicles, withdrawal, bonuses, amendments and owner isolation. Mobile forms and season-action rendering were subsequently repaired.

### 7. Desktop usability notes implemented before the four sessions

The owner's 23-note review led to these changes:

- Clarified that a competition must exist before adding registrations; added create/start prompts instead of a confusing Add people redirect.
- Put the registration form first and moved secondary registration/standings/correction areas into collapsible sections.
- Defaulted registration dates to the current local day; moved sorting to clickable column headings.
- Simplified Start race and registration linking. The earlier bulk import was later removed in Session 2.
- Focused the scoring screen on current-class result inputs, easy class switching and adding contestants; removed distracting setup/status panels.
- Added clear Save results / Complete race behavior and owner completion confirmation. Completion uses the checked finalization path and official snapshot capture.
- Put delete/withdraw controls at the bottom of affected management pages; added pending/success/error feedback for roster and lifecycle actions.
- Suggested creating default classes in running order; moved class rules into class creation/configuration and copied them into new races.
- Made race navigation visibly a navigation bar. Removed Judge scores from the ordinary event nav; judge-specific entry remains available for assigned judges and owner staff management.
- Made offline preparation automatic while online, retained readiness/save feedback, refreshed cached packets without discarding queued edits, and repaired closed/closing session state that could freeze typing after toggling.
- Accepted `-` as no pass while retaining decimal/inches parsing.
- Removed the Lock this device control and the intimidating open-offline-device administration block from Date & status.
- Completion confirmation now deliberately releases outstanding server device sessions with a recorded explanation before finalizing. Unsynced data stays on its device and cannot silently enter a completed race. Do not reintroduce the old scary session-management UI.
- Hid season standings for ordinary track races with no series.
- Added persistent Day / Night themes and readable input text/backgrounds in both modes; repaired live sorting while inputs are focused.

### 8. Four explicitly authorized update sessions

| Session | Commit | Delivered changes |
| --- | --- | --- |
| 1 | `0a84c25` | Existing track/series prominence, smaller create controls, separate account registration/login, top-left Back navigation. Owner requested no audit and manual review. |
| 2 | `42abc24` | Individual event signups with optional eligible series registration, event-specific draw order, removal of bulk series-member race signup, clear correction-link wording, series registration card wording, calendar-only events for tracks and series, scheduled-public status explanation, dashboard series-first ordering when no track exists. Small targeted checks; no reason to seed large races. |
| 3 | `aca6511` | Tab and Shift+Tab traverse down pass columns before moving to the next column; Time & distance labels/explanations show combined completed-time/stopped-distance behavior. Every completion outranks every stopped distance; no track-length input needed. Owner manual audit. |
| 4 | `f4a443b` | Organizer-selectable spectator points visibility, public/RLS restrictions for totals, race-specific spectator QR display/download/print, owner-specific spectator URLs and retained ordinary race results. Owner manual audit. |

Session 2 introduced `register_race_contestant` so entry creation, optional membership link and draw assignment occur atomically. The correction panel changes an existing race entry's membership link; it does not create series membership. Wrong class/season/vehicle links must be rejected. Completed results require reopening/refinalization for changed input identity to enter an official snapshot.

Calendar creation saves a scheduled event with owner defaults and zero contestants. `Open contestant registration after saving — leave unchecked to just add event to calendar` controls the post-save destination. Unchecked stays on the calendar; checked opens contestant registration. Scheduled races are publicly visible; draft races are hidden; live races broadcast scores.

### 9. Phase 3 closeout and latest fixes

- `b8403c0`: fixed signed-out touring-series access by granting the necessary safe policy-helper execution to `anon`; moved the QR button to the END of the Classes & rules / Contestants / Date & status / Results navigation, rather than inside score entry.
- `4deff32`: grouped current/published owner and spectator series standings by class, reset ranks within each class, clarified Series / Series year labels instead of confusing in-house championship / season name wording, and updated points policy language.
- `04dda43`: completed race-scoped staff/judge invitation links, acceptance, cancellation/removal, assigned-race dashboard access and judge-class onboarding; marked Phase 3 implementation complete.
- `3db244e`: fixed the apparent sign-in/dashboard error caused by `readAll` ordering `race_staff` by nonexistent `id`. The helper now accepts a unique key list; dashboard assigned races and staff lists use `event_id,user_id`. Auth itself was not the failing step.
- `c05b19b`: removed simultaneous current/published standings displays; retained one current calculation or selected published version, added the calendar checkbox explanation and clarified invitation sharing.
- `a097bf4`: removed Open email draft / `mailto:` completely and removed the unused email prop from `InvitationLink`. The only sharing action is Copy link, with instructions to send it yourself.

The earlier reported retroactive-points spectator mismatch was identified by the owner as a refresh issue and DROPPED. Do not treat it as an unresolved database bug or implement a speculative fix.

## Invitations: current implementation and boundaries

The owner creates a race-scoped invitation using the recipient email, helper/scorer or judge role, and judge class/label when applicable. A random token produces `/invitations/[token]`; pending links expire after seven days. Owners copy the link and send it themselves. There is NO automatic invitation email, SMTP/provider sender, email-draft link or Send email button.

Acceptance requires a signed-in user whose confirmed Auth email matches the invitation. Wrong email, unconfirmed email, expired/cancelled invitations and unauthorized operations fail. Login/registration preserves only a validated invitation return path; invited signup does not require choosing a track/series owner mode. Acceptance grants race staff access and, for judges, the scoped class assignment. Replay is idempotent while access remains active and must not restore a removed grant.

Owners can cancel pending invitations or remove accepted race access. Removal retains stored scores/history and prevents continued editing. Helpers access assigned races from Races you help with; they can enter contestants/results for that race but cannot finalize, reopen, delegate permissions or manage unrelated track/series data. Invitation membership is NOT season membership and never enrolls a racer.

`race_staff` and `race_staff_invitations` use RLS and restricted grants. Privileged invitation mutation implementations are in the nonexposed `race_access_private` schema; public wrappers use SECURITY INVOKER and explicit role grants. Authorization checks remain in the private implementation. Do not put privileged membership mutation functions back into publicly executable unchecked endpoints.

## Database inventory: where the work lives now

| Area | Tables / objects | Purpose and handoff notes |
| --- | --- | --- |
| Tenant/Auth foundation | `organizations`, `tracks`, `organization_memberships`, `track_memberships`, `profiles`, `platform_admins`, `audit_events`; `auth.users` | Ownership/access, preferences/profile prerequisites, platform authority and audit. Profile tier fields are not implemented billing entitlements. |
| Racing | `events`, `class_templates`, `event_classes`, `competitors`, `entries`, `attempts` | Exclusive owner and venue metadata, class/default snapshots, draw/signup and attempt inputs/revisions. |
| Official versions | `event_result_versions` | Immutable race payloads with inputs, scores/ranks and eligibility. |
| Judges | `judge_assignments`, `judge_scores`, `judge_score_history` | Independent class/rubric input and corrections. |
| Current series/in-house seasons | `competition_seasons`, `competition_classes`, `competition_registrations`, `competition_points_rules`, `competition_bonuses`, `competition_points_changes`, `competition_result_versions` | Separate registrations/vehicles, class points, bonuses, audited edits and versioned standings. |
| Touring owner/defaults and legacy compatibility | `series`, `series_classes`, `series_points_rules`, `series_bonuses`, `series_rosters`, `series_racers`, `series_manual_awards`, `series_result_versions`; `seasons`, `season_events`, `season_points_allocations` | Some original objects remain for defaults/mapping/history. Do not drop them because their names look obsolete; inspect current references and preserved customer history. |
| Offline | `offline_scoring_sessions`, `race_operation_receipts` | Device-session lifecycle, idempotent attempts and checked uploads. Session administration is hidden from the ordinary owner flow. |
| Invitations | `race_staff`, `race_staff_invitations`, `race_access_private` | Race-only staff access, token acceptance/revocation and private checked implementations. `race_staff` has no `id`. |
| Public visibility | `tracks.spectator_points_mode`, `series.spectator_points_mode`, visibility helper/RLS policies | `none`, `race`, `race_and_total`; totals restricted at API layer as well as hidden in UI. |

Important RPC families include transactional onboarding/event/default/class creation; `save_race_attempt` / `save_race_attempt_operation`; lifecycle completion/reopening/deletion; `create_competition_season`, `record_competition_points`, `publish_competition_standings`; `register_race_contestant`, `schedule_track_calendar_event`; and invitation create/accept/cancel/remove wrappers. Refer to the migration/source files for exact signatures, rather than guessing parameters from this summary.

## Migration ledger

All 40 named migrations below were confirmed in the live project's migration list during this handoff. This confirms recorded application, not a fresh check of every function body, policy or original SQL byte. Eight repository filenames have different timestamps from the corresponding live history entries; map by migration name and inspected SQL before any CLI reconciliation. Do not blindly reapply those files or rewrite migration history to make the numbers match.

| Repository file | Live version | Changes |
| --- | --- | --- |
| `20261005000000_phase_one_tenant_foundation.sql` | `20261005000000` | Organizations, tracks, memberships, tenant predicates, audit events and atomic owner bootstrap. |
| `20261005000001_add_track_shorthand_and_update_onboarding.sql` | `20261005000001` | Track shorthand and transactional register_track onboarding. |
| `20261005000002_friendly_duplicate_slug_message.sql` | `20261005000002` | Useful duplicate URL message from register_track. |
| `20261005000003_phase_two_racing_core.sql` | `20261005000003` | Events, templates, event classes, competitors, entries, attempts, scoring enum and RLS. |
| `20261005000004_event_setup_rpc.sql` | `20261005000004` | Transactional event creation and template copies. |
| `20261005000005_enable_realtime_events.sql` | `20261005000005` | Events publication for spectator live revision signals. |
| `20261005000006_platform_admins.sql` | `20261005000006` | Platform admin table, authority predicate and policies. |
| `20261005000007_seasons.sql` | `20261005000007` | Original track season/event/points tables and policies. |
| `20261005000008_phase_four_profiles_and_monetization.sql` | `20261005000008` | Auth profile prerequisites, track state/default_classes; no billing implementation. |
| `20261005000009_phase_three_standings.sql` | `20261005000009` | Entry final_rank column; malformed checked-in declaration later corrected. |
| `20261005000010_phase_three_series_architecture.sql` | `20261005000010` | Original series master classes, points, bonuses, rosters, event relationships and replacement of old season scaffold. |
| `20261005000012_bonus_frequency.sql` | `20261005000012` | Frequency setting for bonus awards. |
| `20261005142203_public_series_rls.sql` | `20261005142203` | Initial public series configuration read policies. |
| `20261005143000_series_class_scoring.sql` | `20261005143000` | Series master class scoring type/config/version support. |
| `20261005144500_ghost_track_rpc.sql` | `20261005144500` | Historical ghost venue provisioning; touring account linkage later superseded. |
| `20261005150000_series_event_rls.sql` | `20261005150000` | Historical series-organizer event policies; later replaced by exclusive-owner access. |
| `20261006140717_harden_tenant_permissions.sql` | `20261006140717` | Close membership escalation, separate editing/management, guarded ownership, public predicates and profile privacy. |
| `20261006141908_reconcile_racing_schema.sql` | `20261006141908` | Additive schema reconciliation, preserved legacy seasons, atomic track/series/event creation, scope checks and Auth profile trigger. |
| `20261006143227_atomic_race_updates.sql` | `20261006143227` | Attempt/version checked RPCs, revision triggers and lifecycle locking. |
| `20261006143818_owner_publication_audit.sql` | `20261006143818` | Owner-only publication/reopening, checked race entries and lifecycle audit. |
| `20261006175457_event_defaults_and_management.sql` | `20261006175457` | Independent series defaults, atomic class/order CRUD, metadata editing and delete/withdraw guards. |
| `20261006180352_official_result_snapshots.sql` | `20261006180352` | Immutable official race versions and completion capture; preserved reconstructed legacy finals. |
| `20261006181108_multi_judge_scoring.sql` | `20261006181108` | Judge assignments/scores/history, rubric validation, per-judge authorization and complete-submission finalization. |
| `20261006182037_series_championships.sql` | `20261006182037` | Original stable series identities, manual awards, result versions, bonus/rule validation and publication. |
| `20261006185036_offline_attempt_operations.sql` | `20261006185036` | Idempotent operation receipts, prepared device sessions, checked upload and session finalization guards. |
| `20261006191736_acceptance_integrity_guards.sql` | `20261006191736` | Preserve identity and historical results during metadata changes, delete/withdraw behavior and offline packets. |
| `20261006200522_postgrest_conflict_responses.sql` | `20261006200522` | Explicit application version conflicts return PT409 instead of indefinitely retried 40001. |
| `20261007004229_independent_competition_ownership.sql` | `20261007011100` (different timestamp) | Exclusive track/series event owners, free-text venue, owner-based race permissions/RPCs and preserved event IDs. |
| `20261007011500_competition_seasons.sql` | `20261007011106` (different timestamp) | Independent seasons, classes, vehicle registrations, rules, amendments/versions, legacy mappings and frozen eligibility. |
| `20261007012000_competition_points_and_publication.sql` | `20261007011111` (different timestamp) | Competition bonuses, explained add/override points, publish snapshots, class/default identity mapping. |
| `20261007013500_competition_guardrails.sql` | `20261007011117` (different timestamp) | Independent judge ownership, bonus scoping, fresh-season defaults and preservation of events with amendments. |
| `20261007014500_preserve_legacy_track_championships.sql` | `20261007011202` (different timestamp) | Retain bookmarked track seasons, mappings, rules and unambiguous legacy explained awards. |
| `20261007015500_competition_amendment_history.sql` | `20261007011545` (different timestamp) | Calculated-before values and explained edit history; invalidate affected seasons and prevent stale season/class mappings. |
| `20261007020500_series_class_exceptions.sql` | `20261007012130` (different timestamp) | Create race-specific touring-series class exceptions using independent owner checks. |
| `20261007102743_copy_default_class_rules.sql` | `20261007102916` (different timestamp) | Copy track default rules/configuration to newly created race classes. |
| `20261007174833_individual_race_registration.sql` | `20261007174833` | Atomic optional-member race signup plus scheduled calendar dates with zero entrants. |
| `20261007200638_spectator_points_visibility.sql` | `20261007200638` | Owner points modes, public helper and API/RLS restrictions for snapshots/rules/awards. |
| `20261007203607_signed_out_series_points_access.sql` | `20261007203607` | Safe anonymous predicate EXECUTE grant fixes signed-out series reads. |
| `20261007234916_race_staff_invitations.sql` | `20261007234916` | Race-scoped staff/invites, token/email acceptance, expiry/revocation, scoped assignment and access helpers. |
| `20261007235131_private_invitation_functions.sql` | `20261007235131` | Move privileged invitation implementations to private schema; invoker public wrappers and restricted grants. |

## Complete post-blueprint commit ledger

Every commit after the scaffold/blueprint checkpoint is included, including documentation, dependency repair and test-only updates. Dates below are the commit-recorded calendar dates; see Git for full timestamps and authors.

| Commit | Date | Recorded update |
| --- | --- | --- |
| `7b6860d` | 2026-10-04 | feat(scoring): implement framework-independent versioned scoring engine and comprehensive unit tests |
| `5423519` | 2026-10-04 | feat(database): implement tenant foundation schema, RLS policies, audit events, and TypeScript types |
| `f008ca4` | 2026-10-04 | feat(auth): configure SSR Supabase clients and Next.js session refresh middleware |
| `8f019d5` | 2026-10-04 | feat(ui): add authenticated scaffolding, sign-in flows, and tenant isolation verification views |
| `d90e1d2` | 2026-10-04 | docs: record approved architectural decisions for ultra-admin, retention, live updates, and permissions |
| `c320997` | 2026-10-04 | docs: remove duplicate PRODUCT_BLUEPRINT.md preserving canonical TrackScore-Product-Engineering-Blueprint.md |
| `a8a127c` | 2026-10-04 | fix(ui, auth): normalize Supabase project URL and overhaul customer-facing homepage and navigation |
| `d2a0d1b` | 2026-10-04 | feat(dashboard): streamline track registration with shorthand, auto-slug, and clean venue dashboard |
| `0d90aa5` | 2026-10-04 | fix(dashboard): replace raw database constraint error with user-friendly duplicate track URL message |
| `e4e25bb` | 2026-10-04 | docs: point README specification link to TrackScore-Product-Engineering-Blueprint.md |
| `dd6db61` | 2026-10-05 | feat: complete Phase 2 racing core and Phase 3 series management architecture |
| `d0fd7a2` | 2026-10-05 | docs: add Phase Roadmap and status tracker |
| `1de99d2` | 2026-10-06 | fix: harden tenant permissions and public access |
| `740da76` | 2026-10-06 | Reconcile racing schema and make onboarding creation atomic |
| `1e3e098` | 2026-10-06 | Unify scoring and correct penalties, distance ties and competition ranks |
| `49561a9` | 2026-10-06 | Make race saves and completion atomic with owner audit and live recovery |
| `eca3307` | 2026-10-06 | Update .env.example |
| `cef4b99` | 2026-10-06 | Update .env.example |
| `55961a9` | 2026-10-06 | Fix invisible series records and paginate race data reads |
| `88f9d13` | 2026-10-06 | Copy series defaults and add atomic event class management |
| `137b37f` | 2026-10-06 | Tailor dashboard modes and expose mobile race workflows |
| `18d0eb4` | 2026-10-06 | Add verified password changes and provider reauthentication flow |
| `7472ec8` | 2026-10-06 | Order public races chronologically and add shared result sorting |
| `018d5a5` | 2026-10-06 | Preserve versioned official results and render frozen final scores |
| `866ba23` | 2026-10-06 | Add independent rubric-based judge scores with audit and finalization checks |
| `42fbb04` | 2026-10-06 | Publish versioned series championships from official results and stable identities |
| `42dade0` | 2026-10-06 | Add durable offline race scoring and safe result exports |
| `6c1c879` | 2026-10-06 | Restore exact dependency lockfile after truncated transfer |
| `6c1e204` | 2026-10-06 | Add race-night acceptance coverage and close management gaps |
| `a7bde14` | 2026-10-06 | Correct large-event counts and extend deployed acceptance scenarios |
| `2f88bcf` | 2026-10-06 | Return prompt scoring conflicts and repair server-action redirects |
| `54a5844` | 2026-10-06 | Complete race-night acceptance audit and repair test selectors |
| `6342460` | 2026-10-06 | Record independent track and touring series migration contract |
| `5a6ca02` | 2026-10-06 | Separate series race ownership and add season registrations and audited points |
| `d53f24e` | 2026-10-06 | Separate spectator listings and preserve track championship history |
| `9d72b33` | 2026-10-06 | Complete migration rehearsal and audited competition workflows |
| `ec1ae41` | 2026-10-06 | Fix mobile organizer forms and season action rendering |
| `71cac3b` | 2026-10-07 | Make offline scoring automatic and accept no-pass entries |
| `f8e682f` | 2026-10-07 | Clarify race navigation and add readable Day and Night themes |
| `69648bf` | 2026-10-07 | Create classes with rules and preserve defaults in new races |
| `3794011` | 2026-10-07 | Put registration first and simplify starting series races |
| `235ab43` | 2026-10-07 | Focus race scoring and add save-and-complete workflow |
| `af2e291` | 2026-10-07 | Keep scoring column sorting responsive and expose offline readiness |
| `5671d3a` | 2026-10-07 | Add bounded usability acceptance batches for registration and scoring |
| `0a84c25` | 2026-10-07 | Make existing venues prominent and separate account registration |
| `42abc24` | 2026-10-07 | Sign up series contestants individually at each race and support calendar dates |
| `aca6511` | 2026-10-07 | Navigate score inputs down pass columns and clarify combined time and distance format |
| `f4a443b` | 2026-10-07 | Control spectator points visibility and share race spectator QR codes |
| `b8403c0` | 2026-10-07 | Fix signed-out series access and place QR last in race navigation |
| `4deff32` | 2026-10-07 | Group series standings by class and clarify series terminology |
| `04dda43` | 2026-10-07 | Complete Phase 3 with race-scoped staff and judge invitations |
| `3db244e` | 2026-10-07 | Fix dashboard and race staff reads for compound membership keys |
| `c05b19b` | 2026-10-07 | Show one series standings view and clarify calendar and invitation actions |
| `a097bf4` | 2026-10-07 | Remove email draft from invitation sharing |

## Verification already performed and its limits

These are recorded checkpoints, not a claim that this documentation run repeated them all.

| Checkpoint | Evidence |
| --- | --- |
| Initial Oct. 5 scaffold review | 23 tests, typecheck and build passed; lint and multiple functional/schema/permission issues were identified. Later repair work addressed those findings. |
| Oct. 6 repairs/acceptance (`2f88bcf`, `54a5844`) | 49 unit/queue tests; all 27 migrations at that checkpoint replayed in fresh Postgres; nine role/workflow SQL suites; lint, TypeScript and webpack build passed. Corresponding live rollback workflow checks passed. |
| Deployed race-night acceptance | Chromium mobile, Firefox desktop and WebKit mobile core/mode/series/permission flows; real password change/old credential rejection/restoration; real websocket updates, blocked-websocket fallback/reconnection; two-browser checked-save conflict; judged-score/championship/history workflows; chronological spectator feed. |
| Large event | 1,205 contestants/valid attempts/official entries, ranks 1–1,205, complete public/scorer/CSV reads and correct counts. This was earlier acceptance, not a reason to seed large tests in current sessions. |
| Disconnected browser | Cached workspace survived network/server loss and reload; two attempt operations synced exactly once, each advanced revision once, and the session closed. Browser emulation does not certify physical phones/tablets. |
| Independent competition migration | Rehearsal and SQL/unit/browser coverage for preserved legacy records and separate ownership; six-contestant local/member example, late eligibility, vehicles, amendments and histories. |
| Four recent sessions | Session 1 requested no audit; Session 2 used targeted checks; Sessions 3 and 4 requested owner manual audits. Compilation/focused checks are not a substitute for that manual verification. |
| Invitations Phase 3 closeout | Fresh local replay through all 40 migrations; targeted staff invitation, judge and tenant SQL suites; invitation return-path tests; lint/typecheck/production build; local login/register/invitation HTTP smoke; signed-out production series/race read checks. No production invitation fixture records were added for this closeout. |
| Dashboard composite-key fix | Focused actual PostgREST-builder mock tests reproduced nonexistent-id ordering and verified empty/paginated composite-key reads; five tests plus focused lint/typecheck passed. |
| Duplicate standings fix | Two render probes using the actual updated view/component: current calculation alone, selected published snapshot alone, retained version links and publish only from current view. TypeScript, focused ESLint and diff checks passed. |
| Email-draft removal | TypeScript, focused ESLint and diff checks passed. |
| This handoff | Read-only live migration inventory: all 40 names present. Commit/migration completeness and document source references checked. No new broad acceptance audit. |

Earlier disposable race-night fixtures were removed through a guarded cleanup that checked workspace/account scope, revoked refreshable sessions, removed the exact test workspace and seven test-only accounts, and verified their absence. This is a historical cleanup result, not a promise that the live database currently contains no later owner-created test events.

The connector advisor checks previously reported explicitly callable authorization predicates/mutation APIs and disabled/unverified leaked-password protection. Privileged new invitation mutation functions were moved to the private schema. Do not remove public predicate grants blindly: this broke signed-out series reads once already. This handoff does not claim a fresh global security-advisor pass or a change to Auth provider configuration.

## Remaining work, dropped issues and product boundary

### Manual/provider follow-ups

- Real confirmation, recovery and reauthentication email delivery and naturally expired-session behavior. These Auth emails are separate from race invitations, which are deliberately manual link sharing.
- Enable/verify leaked-password protection in Supabase Auth settings. Earlier investigation recorded it disabled and Pro eligibility confirmed; no successful enablement is claimed.
- Physical iOS/Android airplane-mode and tablet usability, a full race-night workload, first-time organizer review, cross-deployment queued uploads and storage-eviction/device-loss behavior.
- Offline requires the race to have been prepared while online and an open app after reconnection. Clearing site data or losing the device can remove unsynced local edits. Roster/class restructuring and independent judge submissions still require connectivity.
- A completed race cannot silently accept an abandoned device's pending edits. Owner reopening and deliberate recovery may be necessary.

### Phase 4, not implemented

1. Stripe checkout/customer portal, signed idempotent webhooks, failed-payment recovery.
2. Dynamic paid tiers, server-enforced quotas/entitlements and audited admin grants.
3. Racer profiles as a complete product, self-service event signup, promoter review and entry payments.
4. Approved tier-aware retention/public archive expiry, preserving historical records independently of public hiding. The recorded decision is 30 days after completion for a one-event pass; season/higher through calendar-year end with a 30-day minimum. Enforcement has not been implemented.
5. Dedicated large-screen pit display and reconnect/recovery behavior.

Teams and head-to-head/elimination progression are later format expansion, not delivered racing engines. Existing profiles/admin/tier fields or future-looking migration names do not prove those products work.

### Owner instructions for future work

- Do not launch a prolonged all-in-one audit. Batch acceptance into small, named sections, report results, and checkpoint/push major updates.
- For the four sessions, the owner explicitly reserved manual review for Sessions 1, 3 and 4. Session 2's small audit must stay under 10 contestants if fixtures are needed. Treat that as a continuing preference for bounded fixtures; never use customer races/accounts for testing.
- Coding pauses and specific session commands matter. Do not interpret a status question or notes as permission to start Phase 4.
- The retroactive-points spectator mismatch was dropped as a refresh issue. Keep it off the outstanding bug list.
- Finalized invitation design is Copy link and manually send only. Do not restore email draft or automatic delivery without a new request.

## Source map for the next model

| Concern | Source locations |
| --- | --- |
| Canonical blueprint and later contract | `docs/TrackScore-Product-Engineering-Blueprint.md`, `docs/ARCHITECTURAL_DECISIONS.md`, `docs/INDEPENDENT_COMPETITIONS.md` |
| Shared scoring/parser/ranks | `src/scoring/` including `registry.ts`, `parser.ts`, `types.ts`, `formats.ts`, timed/distance/consistency/combined/judge scorers |
| Current series calculation/loader | `src/championship/competition.ts`, `calculate.ts`, `load.ts`, `public-race.ts`; `src/types/competitions.ts` |
| Owner registrations/standings | `src/components/competition-manager.tsx`, `registration-list.tsx`, `series-standings.tsx`, `race-entry-form.tsx`; `src/lib/race-registration.ts` |
| Track/series organizer pages | `src/app/dashboard/tracks/[trackId]/`, `src/app/dashboard/series/[seriesId]/`; shared series event routes reuse race components |
| Score entry/finalization | Track event `scoring/` and `settings/actions.ts`; `src/components/race-nav.tsx`, `race-status-form.tsx`, `event-class-list.tsx` |
| Defaults/rules/class setup | `src/components/track-default-classes.tsx`, `scoring-fields.tsx`, `scoring-fields-form.tsx`; track settings and series classes pages |
| Public discovery/results | `src/app/page.tsx`, `src/app/r/`, `src/app/s/`, `src/components/public-competition.tsx`, `src/lib/spectator-feed.ts`, `race-order.ts`, `official-results.ts` |
| Visibility/QR | `src/lib/spectator-points.ts`, `spectator-path.ts`, `src/components/spectator-points-field.tsx`, `spectator-qr.tsx` |
| Offline queue/cache | `src/lib/offline/`, `src/app/offline/page.tsx`, `public/raceholler-sw.js`, `src/lib/event-sync.ts` |
| Auth/navigation/themes | `src/app/login/`, `register/`, `auth/`, dashboard `settings/`; `src/lib/auth-return.ts`, `account-mode.ts`, `supabase/`; `src/components/back-navigation.tsx`, `dashboard-nav.tsx`, `theme-toggle.tsx`; `src/app/globals.css` |
| Invitations/staff | Event `staff/page.tsx`, `src/app/invitations/[token]/page.tsx`, `src/components/invitation-link.tsx`, `assigned-races.tsx`; final two SQL migrations |
| Paginated reads | `src/lib/read-all.ts`; tests in `src/lib/__tests__/read-all.test.ts` and `staff-reads.test.ts` |
| SQL/types | `supabase/migrations/`, `supabase/tests/`, `src/types/database.ts` |
| Tests/tooling | `src/**/__tests__/`, `tests/e2e/`, `scripts/test-database.mjs`, `rehearse-competition-migration.mjs`, `check-offline.mjs`, `.github/workflows/ci.yml`, Playwright/Vitest config |

Older `docs/REPAIR_HANDOFF.md` and `docs/FIXES_1_10_REPORT.md` are evidence for their October 6 checkpoint. Their instructions to prepare offline manually, administer open devices or pre-authorize all judges are historical; their claim that invitation automation is absent is superseded by the scoped link-acceptance implementation. `docs/ROADMAP.md` correctly marks Phase 3 complete, but its email-draft phrase and 27-migration/49-test checkpoint are stale. This handoff and current code govern those later changes. No unrelated YSS, trailer, LDMB or other project's schema/code was changed here.

## Safe resume procedure

1. Fetch and inspect remote main, current status and newer owner instructions before editing. Preserve existing uncommitted work. In the current workspace the working checkout is `race-results-session1`; the original `race-results` checkout contains earlier preserved work and must not be reset casually.
2. Read this handoff, the independent-competition contract and relevant source/migrations. Do not restore superseded blueprint assumptions.
3. Reconcile the named live/repository migration timestamp differences before using CLI push; do not reapply already-recorded migrations.
4. Choose the smallest useful checks for the change. Available commands are `npm run lint`, `npm test`, `npm run test:db`, `npm run typecheck`, `npm run build`, `npm run test:offline` and `npm run test:e2e`. Browser suites require disposable private fixture setup from `tests/e2e/README.md`; skipped tests are not a pass.
5. Do not run every suite automatically for a documentation/text change. Keep dependent browser suites sequential when they share accounts; global signout invalidates other sessions. Keep fixtures bounded and separate from customer data.
6. Use additive migrations and explicit checked writes; preserve snapshots, membership dates and amendment history. Never commit secrets or use service-role credentials in browser code.
7. Commit/push coherent major updates. If shell push credentials are unavailable, the connected GitHub API can upload verified blobs/tree and advance main with an expected-parent lease. Do not force-push over remote work.


## October 8, 2026 — Phase 4 repair implementation

This section supersedes the completion and billing-security claims in `anitgravivity10_7_26.md`. Phase 3 remains complete. The six authorized repair sessions were implemented and pushed as separate major updates. Verification remains in small sections; no live test included more than one contestant and all SQL fixtures were rolled back.

### Behavior and code

- Regular accounts cannot directly INSERT organizations or UPDATE plan, credit, expiry, Stripe customer, exemption, or billing-owner fields. Checked onboarding still creates organizations. Normal name/contact edits remain permitted.
- Platform admins can grant plans without payment through `admin_grant_entitlement`, with a required reason, expiration for season plans, remaining credits, and an explicit event/asset-limit waiver. Grants are audited and apply across the original owning account. The admin page selects the real billing fields, checks authority, validates inputs, and displays success/errors. The legacy four-argument grant remains an authenticated, checked admin wrapper.
- Checkout accepts an organization and tier; the server selects the Stripe price. It validates that the price is active, one-time, USD, and the expected amount ($49/$199/$349). Missing configuration fails clearly. Return URLs use the configured site address. All purchases remain one-time, with no automatic renewal.
- Stripe webhooks always require a valid signature, then retrieve the session and require a paid, matching one-time purchase, exact server catalog price/amount/currency/quantity, and organization reference. Both immediate and asynchronous payment success are supported.
- Service-only `apply_paid_entitlement` atomically inserts a unique payment receipt and activates access. Duplicate session/event deliveries do not repeat credits. Event Passes preserve season plans. Buying the same season tier adds a year; buying a different season tier replaces it with that tier for a year.
- n8n notifications are queued in the same transaction as activation, sent afterward, and retained for retry on transport or HTTP errors. Retry delivery is at least once, with the session ID supplied as an idempotency key. The n8n workflow must deduplicate by session ID. A protected daily Vercel retry route requires `CRON_SECRET`; the notification endpoint may be overridden by `N8N_PAYMENT_WEBHOOK_URL`. No actual payment or production notification was sent during these checks.
- Calendar-only draft/scheduled events are free. A database lock protects account-wide credits, consumed once when an event first becomes live. Returning to live does not consume another credit. Deleted event identifiers cannot be reused to evade payment. The temporary 1,000-free-event behavior is removed. Existing live/completed events were grandfathered without a retroactive charge.
- Asset limits apply across organizations belonging to the original account owner: Free/Event Pass 1 Track + 1 Series; Standard 3 Tracks OR 3 Series; Premium 3 of each. The original owner is recorded in protected `organizations.billing_owner_id`; checked owner creation assigns it before an asset is created. Limits waived by platform admin actually bypass event and asset caps.
- `billing_overview` returns shared remaining credits, effective season activity, expiry, and associated organizations. Billing groups account assets, displays expired access correctly, and explains plan replacement/renewal. Account mode remains separate from billing.
- Public retention starts at first live activation and is recalculated once at first completion: 30 days for an Event Pass/free event; season-tier events stay public until the later of completion + 30 days or the UTC calendar-year boundary. Deadlines remain frozen across plan/date changes and reopening. Legacy active events received a migration-time grace window; legacy completed events use their recorded completion timestamp.
- Archive visibility is enforced by event RLS and the shared race predicate, covering event lists, spectator links, child race data, official snapshots, and pit routes. Staff/owners retain history. An hourly Supabase `pg_cron` job named `raceholler-archive-results` is enabled. A protected Vercel maintenance endpoint is also available; public expiration does not depend on either job running on time.
- Attempts now have server-controlled `updated_at`, advanced on insert/edit; historical attempts with unknown edit order remain null. Judge edits use the same timestamping. Pit displays default to and follow the class with the newest scoring-row edit, rather than the most attempts. Manual selection pins a class until “Follow live class” is selected. No known activity falls back to running order.
- Completed pit displays load the immutable official payload, including classes, entries, attempts, ranks, and scores. Missing snapshots and database read failures are reported rather than silently showing recalculated/empty results. Track event overview now provides the pit shortcut as well as series routes.

### Migration reconciliation

The eight Phase 3 filenames listed earlier with differing timestamps were renamed to their actual recorded live versions; their SQL contents were preserved. The billing foundation was renamed to `20261008025932_20261008000000_billing_entitlements_foundation.sql`, matching its original live history. No live history rows were rewritten. The two unrecorded Antigravity quota/archive files were retired and replaced by recorded repair migrations. Fresh replay verifies the resulting order; existing customers do not need those retired files reapplied.

New live migrations, with matching repository filenames:

| Version | Name |
| --- | --- |
| 20261008131245 | secure_billing_admin_grants |
| 20261008131618 | verified_idempotent_payments |
| 20261008151619 | account_billing_scope |
| 20261008151656 | atomic_event_credits |
| 20261008153223 | account_asset_limits |
| 20261008153245 | account_billing_view |
| 20261008153340 | account_wide_entitlement_grants |
| 20261008153502 | frozen_public_retention |
| 20261008153650 | live_retention_and_archive_bookkeeping |
| 20261008153839 | billing_expiry_state |
| 20261008153944 | scheduled_archive_sweep |
| 20261008153958 | latest_scoring_row_timestamps |
| 20261008154245 | retain_draft_creation_visibility |
| 20261008154611 | guard_credit_reuse_and_paid_tier |
| 20261008154853 | ensure_fresh_account_asset_triggers |

The new private billing schema holds checked functions, payment receipts/outbox state, and event-credit usage. Public additions are protected billing fields and event retention fields; generated database types were updated. No existing official snapshots, contestant registrations, manual points, or staff membership history were removed.

### Verification and remaining provider checks

- Live, rolled-back SQL sections passed: billing owner/admin permissions and audit reasons; service-only payment activation and duplicate retries; account-wide asset/credit enforcement and calendar behavior; retention visibility/frozen dates/owner history/sweep; server attempt timestamps with one contestant.
- Live privilege inspection confirms authenticated users cannot update tier, credits or billing ownership, cannot call payment activation, and can call only the checked admin wrapper. The service role can call payment activation.
- GitHub CI after the pit update passed lint, 77 unit tests, SQL suites, migration rehearsal, TypeScript, and the production build. Additional Stripe-boundary and official-pit-loader tests were added for final verification. Legacy workflow fixtures have explicit complimentary billing defaults only inside their isolated test database; billing tests retain real zero-credit defaults.
- The workspace execution server was unavailable. Source changes used the connected GitHub API with expected-parent leases, live migrations used Supabase, and executable checks ran through GitHub Actions. No local shell/test execution is claimed.
- Real Stripe purchase/refund flows, deployed environment values, actual n8n delivery/deduplication, and physical TV/mobile use still require provider/manual verification. No real charge was made and Phase 4 should not be called commercially accepted until those checks pass.
