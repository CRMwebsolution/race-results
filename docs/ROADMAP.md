# TrackScore Implementation Roadmap & Phase Tracker

This document tracks all implementation phases for the TrackScore platform, detailing the architectural scope, status, and completed features for each phase.

---

## Quick Phase Status Summary

| Phase | Focus Area | Status |
| :--- | :--- | :--- |
| **Phase 1** | Tenant Foundation, Auth & Scoring Engine Contract | ✅ **COMPLETED** |
| **Phase 2** | Racing Core, Scoring Workspace & Live Results | ✅ **COMPLETED** |
| **Phase 3** | Ultra-Admin, Advanced Scoring & Series Architecture | ✅ **COMPLETED** |
| **Phase 4** | Racer Profiles, Online Registration & Monetization | ⏳ **READY TO START** |

---

## Phase 1: Foundation & Multi-Tenant Infrastructure
**Status:** ✅ **COMPLETED**

### Scope & Deliverables
- [x] Multi-tenant database foundation (`organizations`, `organization_memberships`, `tracks`, `track_memberships`).
- [x] Strict PostgreSQL Row-Level Security (RLS) policies enforcing tenant boundary isolation.
- [x] Supabase Auth integration with cookie-based SSR sessions via `@supabase/ssr`.
- [x] Next.js 16 (Turbopack) application structure with dark-mode responsive UI.
- [x] Framework-independent scoring parser (`parser.ts`) supporting times (`SS.mmm`), distances (`FT'IN"`), and penalty markers (`DQ`, `DNF`).
- [x] Comprehensive Vitest test suite validating parsing, edge cases, and arithmetic accuracy.
- [x] Architectural Decision Records (`docs/ARCHITECTURAL_DECISIONS.md`).

---

## Phase 2: Racing Core & Live Spectator View
**Status:** ✅ **COMPLETED**

### Scope & Deliverables
- [x] **Racing Core Database Schema:**
  - `events`: Single or multi-day race meets tied to a venue.
  - `class_templates` & `event_classes`: Vehicle classes with snapshot rules and scoring formats.
  - `competitors` & `entries`: Racer enrollment and run-order seeds.
  - `attempts`: Atomic timed/measured passes.
- [x] **Track Management Hub (`/dashboard/tracks/[trackId]`):**
  - Event list, date scheduling, and class setup.
  - Roster management (adding entries and competitors).
- [x] **Official Scoring Workspace (`/dashboard/tracks/[trackId]/events/[eventId]/scoring`):**
  - Distraction-free, keyboard-first attempt entry interface.
  - Live calculations for Fastest Pass and Stopped Distance.
  - "Publish Official Results" workflow with revision counters.
- [x] **Public Spectator Experience (`/r/[slug]` and `/r/[slug]/[eventSlug]`):**
  - Mobile-first read-only leaderboards.
  - Supabase Realtime broadcast integration for instant spectator device updates.

---

## Phase 3: Ultra-Admin, Advanced Scoring & Series Architecture
**Status:** ✅ **COMPLETED**

### Scope & Deliverables
- [x] **Platform Ultra-Admin (`/admin`):**
  - Database registry `platform_admins` with RLS bypass authority (`cody@southernautomate.com`).
  - Global overview of all registered organizations, venues, and user accounts.
  - Entitlement and tier override controls.
- [x] **Advanced Scoring Algorithms:**
  - **Combined Time (`src/scoring/combined-time.ts`):** Sums multi-pass runs with penalty calculations.
  - **Consistency:** Ranks competitors by minimal delta between qualifying passes.
  - **Judged Freestyle (`src/scoring/judged-points.ts`):** Aggregate scoring based on judge points.
- [x] **Standalone Series Architecture (Overhauled from single-track Seasons):**
  - Top-level `series` entity owned directly by organizations, decoupled from tracks.
  - **Tour Schedule:** Free-text track location support with automatic atomic ghost-track provisioning (`create_ghost_track` RPC).
  - **Master Classes:** Universal class templates with rules, fees, and no rigid format restrictions (timing formats chosen per race).
  - **Points System:** Flexible rank-band allocation (`1st = 50`, `2nd = 49`, `11th-999th = 25`).
  - **Bonus Points:** Support for bonus modifiers with per-class or 1-per-race frequency scoping.
  - **Championship Roster:** Pre-seeded driver enrollment for season-long standings.
  - **Public Series Portal (`/s/[seriesId]`):** Spectator view with tour dates, master classes, and roster.
- [x] **Universal Edit & Delete Standard:**
  - Full CRUD operations enabled across series events, master classes, roster drivers, and series settings.

---

## Phase 4: Racer Profiles, Online Registration & Monetization
**Status:** ⏳ **READY TO START**

### Scope & Deliverables
1. **Billing & Subscriptions (Monetization):**
   - Stripe Checkout and Customer Portal integration.
   - Subscription tier enforcement (Event Pass, Season, Series/Promoter).
   - Ultra-Admin subscription visibility and manual grants.
2. **Racer Profiles & Self-Serve Registration:**
   - Global Driver Accounts for racers to maintain cross-track profiles and career history.
   - Self-serve event pre-registration with upfront entry fee processing.
   - Promoter/Track official queue to approve or reject online entries.
3. **Big-Screen Pit Displays:**
   - Dedicated high-contrast TV display route (`/r/[slug]/[eventSlug]/display`) with auto-scrolling leaderboards for staging lanes and pits.
4. **Elimination Brackets (Optional Expansion):**
   - Head-to-head bracket generation (8-car, 16-car) derived from qualifying passes.
