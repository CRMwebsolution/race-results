# Agent Updates Log

## 2026-10-13 10:08 AM EDT — Antigravity

### What it did
1. **Account-Centric Billing & Credits Refactor**:
   - Elevated billing ownership, tier subscriptions, and event credits from ephemeral organizations to **User Accounts (`public.profiles`)**.
   - Defaulted new account registrations to **0 credits** and `'free'` tier (`handle_new_user`), allowing Cody to review signups via n8n and donate starter trial credits.
   - Dropped the `notify_orgs_webhook` trigger on `public.organizations` so creating tracks or series no longer sends redundant/spurious organization alerts to n8n. Signups fire via `notify_profiles_webhook` with the account's UUID and email.
   - Implemented `admin_grant_account_entitlement` RPC allowing platform admins to grant/donate tiers and credits directly to any user account ID.
   - Maintained backward compatibility: `admin_grant_entitlement(org_id)` resolves the owning account and routes through the account grant, synchronizing both tables.
   - Updated event quota check (`check_organization_event_quota`) to deduct credits atomically from the event owner's account profile (`profiles.event_quota`), keeping legacy organization rows synchronized.
   - Added `account_billing_overview` RPC and updated `billing_private.apply_account_payment` / `apply_paid_account_entitlement` for direct user account credit purchases.

2. **Admin Panel — Dual Visibility (Accounts & Organizations) & Account Creation**:
   - Added dedicated `/admin/accounts` route in platform admin panel:
     - Search and filter promoter accounts by email, name, or phone.
     - View account IDs, plan tiers, credit balances, expirations, and all owned tracks & series.
     - Inline credit grant/donation action for each promoter account.
     - **Create Account by Admin**: Modal/form allowing platform admins to manually create accounts for promoters with starter credits and complimentary passes, supporting either email invite links or immediate temporary passwords.
   - Preserved `/admin/organizations` for inspecting organizational entities, memberships, and linking back to the owner's account.
   - Updated admin sidebar navigation with both **Accounts & Billing** and **Organizations** links.

3. **Promoter Billing UI**:
   - Refactored `src/app/dashboard/billing/page.tsx` to remove the gate requiring an organization/track. Promoters can view plans, see their account credit balance, and purchase Event Passes ($50), Standard Season Passes ($200), or Premium Season Passes ($250) immediately upon signup.
   - Updated `/api/checkout` to support account-level checkouts where `orgId` is optional.

### Database changes
- Migration: `supabase/migrations/20261013140000_account_billing_and_credits.sql`
  - Added columns to `public.profiles`: `active_tier`, `event_quota`, `subscription_end_date`, `limits_exempt`, `stripe_customer_id`, `stripe_subscription_id`.
  - Backfilled existing profile entitlements from organizations.
  - Added RLS policy `Platform admins can view all profiles` on `public.profiles`.
  - Updated `public.handle_new_user()` trigger to initialize `active_tier = 'free'`, `event_quota = 0`.
  - Dropped trigger `notify_orgs_webhook` on `public.organizations`.
  - Created RPC `public.admin_grant_account_entitlement(uuid, text, integer, timestamptz, text, boolean)`.
  - Updated wrapper `public.admin_grant_entitlement(uuid, text, integer, timestamptz, text, boolean)`.
  - Created RPC `public.account_billing_overview()`.
  - Updated trigger function `public.check_organization_event_quota()`.
  - Altered `billing_private.payment_receipts.organization_id` to drop NOT NULL, added `user_id`.
  - Created `billing_private.apply_account_payment` and `public.apply_paid_account_entitlement`.
  - Updated `billing_private.apply_payment` to synchronize with owning profile.

### Other relevant changes
- Tests run:
  - Vitest test suite: 21 files, 109 tests passed (`npm test`).
  - TypeScript typecheck: clean (`npm run typecheck`).
  - Postgres PGlite tests: `account_billing.sql`, `billing_credits.sql`, `billing_payments.sql`, `billing_permissions.sql` all passed.
  - Production build: `npm run build` succeeded with all static/dynamic routes.
- Known issues:
  - None.



### What it did
Implemented an end-to-end guided workflow feature linked with dashboard Tips bubbles and step-by-step visual highlights (`TipHighlight`, `GuidedStepBadge`), ensuring buttons and fields are blatantly obvious in the exact sequence requested by the user:

1. **Track Workflow**:
   - `src/app/dashboard/create-track-form.tsx`: Step 1 highlight on "New Track", Step 2 badge on track form, Step 3 highlight on "Register Track".
   - `src/app/dashboard/page.tsx`: Step 4 highlight on "Manage Track" and TipBubble guide.
   - `src/app/dashboard/tracks/[trackId]/page.tsx`: Step 5 highlight on "Track Settings" when default classes missing, dynamically switching to Step 8 "Create Event" and Step 13 on newly created event card.
   - `src/app/dashboard/tracks/[trackId]/settings/page.tsx`: Step 6 badge on default classes section, Step 7 highlight on `← Back to track hub`.
   - `src/app/dashboard/tracks/[trackId]/events/new/page.tsx` & `create-event-form.tsx`: Step 9 badge (Public vs Draft), Step 10 badge (Event name), Step 11 badge (Race date), Step 12 highlight on "Save event".
   - `src/app/dashboard/tracks/[trackId]/events/[eventId]/page.tsx`: Step 14 highlight on "Manage Roster" card.
   - `src/app/dashboard/tracks/[trackId]/events/[eventId]/entries/page.tsx`: Step 15 badge on contestant form, Step 16 highlight on "Enter results" link.
   - `src/app/dashboard/tracks/[trackId]/events/[eventId]/scoring/page.tsx`: Step 17 highlight on "Go Live & Launch Scoring".
   - `src/app/dashboard/tracks/[trackId]/events/[eventId]/scoring/scoring-workspace.tsx`: Step 18 badge in TipBubble, Step 19 highlight on "Complete race" button.

2. **Series Workflow**:
   - `src/app/dashboard/page.tsx`: Step 1 highlight on "Create Series".
   - `src/app/dashboard/series/new/page.tsx` & `create-series-form.tsx`: Step 2 TipBubble and Step 2 highlight on "Register series" button.
   - `src/app/dashboard/series/[seriesId]/page.tsx`: Step 3 highlight on "Manage Classes" in Master Classes card, Step 6 highlight on "Manage Schedule" in Schedule & Venues card, Step 11 highlight on "Edit Rules" in Points System card.
   - `src/app/dashboard/series/[seriesId]/classes/page.tsx`: Step 4 badge on class form, Step 5 highlight on `← Back to series dashboard`.
   - `src/app/dashboard/series/[seriesId]/schedule/page.tsx`: Added `← Back to Series Hub` top link, Step 7 TipBubble, Step 7 highlight on "Create or manage a series season", Step 7 highlight on "Add calendar event".
   - `src/components/competition-manager.tsx`:
     - Added one-click `← Back to Series Hub` on both seasons list and season detail views (resolving the annoying double-back issue).
     - Step 8 TipBubble and highlight on "Create series season" and season selection cards.
     - Step 9 badge on "Add contestant" form and highlight on "Register entry".
     - Step 10 highlight on `← Back to Series Hub`.
     - Replaced placement points inputs with simplified `PlacementRuleInputs` (Rank, Point value, Multi-rank checkbox with through-rank, and This rank and below checkbox).
   - `src/components/placement-points-form.tsx`: Dedicated simplified component for rank and point value with the 2 checkboxes and live preview.
   - `src/app/dashboard/series/[seriesId]/points/page.tsx`: Integrated `PlacementRuleInputs` and Step 11 TipBubble guide.

3. **Start a Race in the Series Workflow**:
   - `src/app/dashboard/series/[seriesId]/page.tsx`: Step 1 highlight on scheduled event in Schedule & Venues card.
   - `src/components/race-nav.tsx`: Added `ownerType` support, reordering series tabs to `Classes & rules`, `Date & status`, `Contestants`, `Enter results`.
   - `src/app/dashboard/tracks/[trackId]/events/[eventId]/page.tsx`: Series-specific TipBubble and highlights directing user to `Date & status` (if season unassigned) or `Contestants`.
   - `src/app/dashboard/tracks/[trackId]/events/[eventId]/settings/page.tsx`: Step 2 TipBubble, Step 2 badge on "Series season" section, and Step 2 highlight on "Assign series season".
   - `src/app/dashboard/tracks/[trackId]/events/[eventId]/entries/page.tsx`: Steps 3 & 4 TipBubble, Step 3 badge on contestant form, Step 4 highlight on "Enter results".
   - `src/components/race-entry-form.tsx`: Reworded series registration correction spot to explicitly state: `🔗 Connect a racer accidentally added as a one-timer to a series-registered contestant` with clear prompt text.
   - `src/app/dashboard/tracks/[trackId]/events/[eventId]/scoring/page.tsx`: Step 5 TipBubble and Step 5 highlight on "Go Live & Launch Scoring".
   - `src/app/dashboard/tracks/[trackId]/events/[eventId]/scoring/scoring-workspace.tsx`: Series TipBubble and Step 6 highlight on "Complete race".

### Database changes
- None.

### Other relevant changes
- Tests: All 109 unit and integration tests passed (`npm test`).
- Type Checking: Passed with 0 errors (`npx tsc --noEmit`).
- Production Build: Production build succeeded (`npm run build`).
- Working Branch: `feature/guided-dashboard-tips`.
