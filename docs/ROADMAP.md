# RaceHoller implementation roadmap

Updated October 6, 2026. This tracker reflects inspected implementation and recorded test coverage, not a general production-readiness certification. Detailed evidence: `FIXES_1_10_REPORT.md`; concise coding context: `REPAIR_HANDOFF.md`.

| Phase | Scope | Current status |
| --- | --- | --- |
| 1 | Tenant foundation, Auth and scoring contracts | Implemented; role/SQL/unit checks passed. Actual email delivery remains a provider/field check. |
| 2 | Racing core, management, live/official results and offline scoring | Implemented with recorded acceptance coverage; physical-device/long-night verification remains. |
| 3 | Advanced scoring, multi-judge workflows and series championships | Implemented core plus admin overview; billing/grant controls remain Phase 4. |
| 4 | Billing, registration, retention and pit display | Not started. Complete the manual/provider readiness follow-ups before a paid launch. |

## Phase 1: foundation

- [x] Organizations, tracks, memberships and database tenant boundaries.
- [x] Cookie-based Supabase Auth and SSR route checks.
- [x] Five account operating modes with editable preferences and tailored navigation.
- [x] Password-change form with current-credential verification, confirmation and provider nonce flow.
- [x] Parser, scoring contracts, consistent ranks/ties, configuration and format validation.
- [x] Next.js 16 application; production builds use webpack after repeated local Turbopack cache failures.
- [ ] Provider/manual verification of confirmation, recovery and reauthentication email delivery and enabling currently disabled leaked-password protection (Pro eligibility confirmed).

## Phase 2: racing core

- [x] Event scheduling, roster/draw management and independent track/series default-class snapshots.
- [x] Class add/edit/remove/reorder, drag/drop and move alternatives; checked event editing and deletion/withdrawal.
- [x] Real track settings (details/state/timezone/defaults) and labeled mobile event steps; legacy Manage Seasons removed from track navigation.
- [x] Atomic checked attempts, revision tracking, owner lifecycle controls and audit history.
- [x] Live-priority global race feed, chronological schedules, draw/pass/rank sorting and ordered safe CSV/print output.
- [x] Realtime updates with polling/reconnect recovery; complete paginated inputs and exact counts beyond the API row cap.
- [x] Immutable official result versions and snapshot-based completed views; reopening/refinalizing preserves history.
- [x] Prepared-event IndexedDB/offline shell, durable attempt outbox, idempotent receipts, conflicts, account scope and finalization/device-session guard.
- [ ] Physical iOS/Android offline/airplane-mode and long race-night review, plus cross-deployment queued edits/storage-eviction checks.

## Phase 3: advanced scoring and series

- [x] Fastest pass, stopped distance, combined time and consistency with shared configuration/score/rank behavior.
- [x] Dedicated judge assignments and rubric scores including zero, required submissions, sum/average, per-judge permissions and correction history.
- [x] Standalone organization-owned series, multi-track schedule, master classes/configuration and roster CRUD.
- [x] Stable racer/class mapping and idempotent roster import; historical unmatched entries are explicitly excluded until deliberately linked.
- [x] Per-class championship placement/bonus/manual-award calculation using official versions, source/rule validation and retained publication history.
- [x] Public series/standings pages and event-by-event breakdowns.
- [x] Platform admin overview; tier/billing controls are identified as unimplemented.
- [ ] Judge/staff invitation automation (judges currently need existing authorized membership).
- [ ] Paid capacity/entitlements, admin grants and retention enforcement (Phase 4).

## Phase 4: next implementation work

- [ ] Stripe checkout, customer portal, signed idempotent payment webhooks and failed-payment recovery.
- [ ] Tier definitions, server-enforced quotas/entitlements and audited platform-admin overrides.
- [ ] Racer profiles and self-service event registration, promoter review and entry payments.
- [ ] Completion/tier-aware archive visibility/expiry and approved retention rules; preserve history independently of public hiding.
- [ ] Dedicated big-screen pit display and recovery behavior.

Account mode is distinct from the paid tier. Test payment flows before accepting real charges. No billing, registration or archive-expiry implementation is claimed by repairs 1–10.

## Later format expansion

- [ ] Team scoring and roster/aggregation rules.
- [ ] Head-to-head winner/progression/elimination brackets where elapsed time alone does not determine advancement.

Each expansion needs its complete storage, rules, permissions, live display, snapshots and tests. Unsupported formats currently fail explicitly.

## Acceptance checkpoint

49 unit/queue tests, 27-migration replay, nine SQL workflow suites, lint, TypeScript and production build passed. CI runs those checks on main. Deployed browser evidence includes Chromium mobile core flows and real realtime recovery; Firefox desktop and WebKit mobile preferences/series CRUD/permissions; real password credentials; two-browser save conflicts; and a disconnected browser reload/sync test. Final deployed password/concurrency/judging/championship/spectator smoke: four passed without retries. Large-event official capture also passed with 1,205 valid passes and ranks 1–1,205. Disconnected reload/sync passed again, with two receipts, one version increment per pass and a closed session. Guarded fixture/account cleanup is complete. Automated acceptance is complete; manual/provider checks above remain explicit.

Automated emulation does not prove physical-device behavior or first-time usability. The remaining provider/field checks are documented in the report and handoff. Legacy season data/routes were retained rather than dropped.
