# RaceHoller acceptance tests

These tests write only to a disposable acceptance workspace. Do not point them at a customer track, roster, or user. They require a private JSON file outside git and refuse normal track slugs or user email addresses.

## Commands

Install dependencies and engines with `npm ci` and `npx playwright install --with-deps`. Set the two public Supabase environment variables as for the application. Run `npm run build` before testing a local production server.

- `RACEHOLLER_FIXTURE_FILE=/absolute/private-fixture.json npm run test:e2e` starts a local production server and runs the common browser flows.
- Add `RACEHOLLER_BASE_URL=https://your-deployment.example` for deployed acceptance. Use a stable deployment and finish the test run before deploying new server actions.
- `RACEHOLLER_FIXTURE_FILE=/absolute/private-fixture.json npm run test:offline` starts and stops its own local production server to prove offline reload. Do not supply a remote base URL for this runner.
- `RACEHOLLER_TEST_OUTPUT_DIR=test-results/run-name` separates outputs. Run suites sharing fixture accounts sequentially: global sign-out revokes those accounts’ other sessions. Without a fixture, browser scenarios are skipped; that is not an acceptance pass. CI runs lint, unit/queue tests, SQL migration/workflow replay, TypeScript and production compilation, not authenticated browser acceptance.

The fixture JSON contract is:

```json
{
  "password": "private fixture password",
  "newPassword": "different private fixture password",
  "users": [{"id": "uuid", "email": "unique@test.invalid", "mode": "single_track"}],
  "fixture": {"trackId": "uuid", "seriesId": "uuid", "eventId": "uuid", "roundTwoId": "uuid", "largeEventId": "uuid"},
  "trackSlug": "raceholler-test-unique",
  "eventSlug": "round-one",
  "largeSlug": "large-grid",
  "fastestClassId": "uuid"
}
```

Provision seven confirmed test accounts: the first five use, in order, single_track, multi_track, series, single_track_series, multi_track_series. Account zero owns the test organization/track/series; account five is a scorer at that track; account six is an outsider. The five-mode test signs in existing real Auth accounts; it does not test confirmation email delivery.

The series contains Fastest fixture, Consistency fixture and Judged fixture classes. The original two scheduled/live rounds were created from the first two defaults; add the judged default afterward. Judged fixture has two required judges, one round, average aggregation, and rubric style/Style/max10 plus difficulty/Difficulty/max20. Seed stable identities for Fixture One and Fixture Two, a once-per-event fastest bonus of five points scoped to Fastest fixture, and a separate live event with 1,205 entries named Large racer 0001 through Large racer 1205. The stateful journey adds judged roster membership linked to Fixture Two, changes only fixture rules to placement bands 10/6, creates its own events and tests audited manual awards.

Current entry-specific concurrency scenario uses the disposable Fixture Two first-round entry ID in `extended-workflows.spec.ts`; update that constant when provisioning a new fixture. Use fresh fixtures for independent full reruns: historical completed fixture events deliberately affect championship totals.

Clean up fixture events and their versions/awards/history, series, track, organization and all seven test accounts after acceptance. Fixture credentials, screenshots containing private data, and browser storage must not be committed.

Managed execution environments may require local browser libraries and test-only sandbox/proxy certificate accommodations. These are runtime settings, not application security defaults. Physical iOS/Android devices, real email delivery and naturally expired sessions require separate verification.
