# Antigravity Handoff: October 7th, 2026 (Phase 4 Completion)

## Overview
This document summarizes all the work, design pivots, and database changes implemented to complete Phase 4, starting from the point the updated Phase 3 code was pulled from GitHub.

## 1. Design Pivots & Registration
* **No Self-Service Registration**: Per instructions, we completely dropped the concept of competitors creating their own accounts or paying for event entry. Registration remains strictly an admin/staff function.
* **Reverted Migrations**: Deleted the previously sketched `racer_vehicles` and `racer_profiles` database migrations. The only user accounts on the platform are for Track Owners, Series Promoters, and Staff.

## 2. Dedicated Pit Display
* **New Component**: Created `<PitDisplay />` (`src/components/pit-display.tsx`), an ultra-high-contrast, massive-font leaderboard specifically designed to be displayed on TVs in staging lanes or pits.
* **Auto-Focus Logic**: The screen automatically defaults to the class with the most recent attempts (or the first class), but retains massive buttons allowing pit staff to manually migrate between classes.
* **New Routes**:
  * Track Pit Display: `src/app/r/[slug]/[eventSlug]/pit-display/page.tsx`
  * Series Pit Display: `src/app/s/[seriesId]/races/[eventSlug]/pit-display/page.tsx`
* Added quick-links to the Pit Display from the Series and Track dashboard schedule views.

## 3. Database & Billing Tiers (Migrations)
We implemented a rigid server-side quota system using 3 specific Postgres migrations to enforce the exact billing rules requested:
* **`00_billing_entitlements_foundation.sql`**: Added `stripe_customer_id`, `active_tier` (defaults to 'free'), `event_quota`, and `subscription_end_date` to the `organizations` table. Also created the `grant_organization_entitlement` admin RPC.
* **`01_billing_event_quota_trigger.sql`**: 
  * Added `check_organization_event_quota` trigger to `events`.
  * Added `check_organization_asset_limits` trigger to `tracks` and `series`.
* **`02_event_retention_archiving.sql`**: Added `archived_at` and retention sweep logic (30 days for Event Pass, end-of-year for Season Passes).

### The Enforced Tiers:
1. **Event Pass (`event_pass`)**: Max 1 track, 1 series. `event_quota` strictly tracked. (Pay-per-event).
2. **Standard (`standard`)**: Unlimited events. Max 3 Tracks **OR** 3 Series.
3. **Premium (`premium`)**: Unlimited events. Max 3 Tracks **AND** 3 Series.

## 4. Stripe Integration & Webhooks
* **Installed Packages**: Added `stripe` and `@stripe/stripe-js`.
* **Billing Dashboard**: Built `src/app/dashboard/billing/page.tsx`, a slick new UI that displays the organization's current active tier, event quota balance, and offers 3 "Buy Season Pass / Event Pass" buttons using the provided Stripe Price IDs. Added a link to this page in the main Dashboard Nav.
* **Checkout API (`/api/checkout/route.ts`)**: 
  * Handles the redirect to Stripe Checkout.
  * **Crucial Logic**: Configured to use `mode: "payment"` for ALL tiers, since Track owners will manually buy their season passes each year instead of using auto-renewing Stripe subscriptions.
* **Webhook Handler (`/api/webhooks/stripe/route.ts`)**: 
  * Listens for `checkout.session.completed`.
  * Securely upgrades the organization tier in the database using the admin RPC.
  * Fires a secondary POST request to the **n8n Webhook** (`https://n8n.southernautomate.com/...`) containing the customer email, name, tier picked, and amount paid.

## 5. Admin Organization Dashboard
* Upgraded `src/app/admin/organizations/page.tsx` to display real-time billing tiers and event quotas.
* **Manual Overrides**: Added server actions allowing platform admins to manually assign tiers to organizations without payment.
* **Bypass Limits Button**: Added a dedicated button that instantly grants an organization "Premium" status with a 9,999 event quota lasting until 2099, perfectly bypassing all Stripe requirements for specific users.

## Next Steps for the Next Dev/Model
- The application is currently completely functional and successfully compiles (`npm run build`).
- Verify the 3 Stripe Price IDs are correctly set to "One-time payment" in the Stripe Dashboard to match the checkout logic.
