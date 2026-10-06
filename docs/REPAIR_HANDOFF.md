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

## Remaining groups

2. Reconcile source migrations with live definitions, fix missing-column queries and registration state.
3. Correct penalties, distance tiebreakers, parsing, and shared scoring/rank handling.
4. Make saves/revisions atomic, expose accurate save/error feedback, and recover missed live updates.

Billing and self-serve registration remain Phase 4 work. Series standings integration, immutable
official snapshots, full tier controls, and real-browser/end-to-end validation remain separate work.
