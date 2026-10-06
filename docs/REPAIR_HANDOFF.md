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

## Remaining groups

4. Make saves/revisions atomic, expose accurate save/error feedback, and recover missed live updates.

## Group 3: Scoring and ranks

- Combined times include penalties and reject invalid pass counts; partial configs retain defaults.
- Distance secondary passes rank greater distances first, with missing passes last.
- One versioned dispatcher rejects unimplemented formats/versions instead of silently using fastest pass.
- One competition-rank helper uses all sporting tiebreakers; true ties share numeric ranks (1,1,3), and ineligible entries are unranked.
- Spectator lists, CSV and print outputs follow scoring order; the scoring desk retains draw order.
- The parser preserves original input, supports feet plus inches, and returns validation errors for zero times, invalid text and numeric overflow.
- Finalization uses shared ranks, clears stale ranks on ineligible entries, and checks query/write errors; atomic finalization is addressed in group 4.

Validation: 30 tests including new regression cases, TypeScript, production build and diff checks.

Billing and self-serve registration remain Phase 4 work. Series standings integration, immutable
official snapshots, full tier controls, and real-browser/end-to-end validation remain separate work.
