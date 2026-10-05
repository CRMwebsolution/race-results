# TrackScore Architectural Decision Records (ADRs)

This document records authoritative product decisions approved by the system owner for TrackScore. These decisions resolve the open items identified in `docs/PRODUCT_BLUEPRINT.md` (Section 27).

---

## ADR-001: Platform Ultra-Admin & Dynamic Entitlements

- **Status**: Approved
- **Owner**: `cody@southernautomate.com`
- **Context**: Blueprint Section 4 specifies that pricing, quotas, event allowances, and seat limits must be dynamic configuration rather than hardcoded conditionals.
- **Decision**:
  - The email account `cody@southernautomate.com` possesses platform "ultra-admin" privileges.
  - An administrative management interface allows the ultra-admin to configure product tiers, pricing, event allowances, staff seat limits, and track quotas dynamically.
  - Access is verified at the database level using a secure function `is_platform_admin()` verifying the authenticated email, independent of user-editable client metadata.

---

## ADR-002: Public Archive Retention Rules

- **Status**: Approved
- **Context**: Blueprint Section 4 & 5 requires an explicit, written archive retention policy for published event results.
- **Decision**:
  - **One-Time Event Pass**: Published results and public archive remain accessible for **30 calendar days** following event completion (`completed_at + 30 days`).
  - **Season & Higher Tiers**: Published results remain accessible until the **end of the calendar year** (December 31st, 23:59:59), but with a minimum floor of no less than 30 days from event completion:
    $$\text{retention\_until} = \max(\text{end\_of\_calendar\_year}(\text{completed\_at}), \text{completed\_at} + 30\text{ days})$$
  - RLS policies and public API handlers enforce these retention boundaries against anonymous spectator requests.

---

## ADR-003: Real-Time Live Event Updates

- **Status**: Approved
- **Context**: Blueprint Section 20 & 21 addresses publication flow during active race nights.
- **Decision**:
  - During live events, saves performed by authorized track operators automatically publish results to spectators in real time.
  - Each successful save transaction in live mode advances `working_revision` and immediately promotes `published_revision`, triggering the Supabase realtime broadcast signal.
  - Spectators receive instant revision signals via Supabase Realtime with automatic 15-second fallback polling.

---

## ADR-004: Publication & Heat Reopening Authorization

- **Status**: Approved
- **Context**: Blueprint Section 14, 20 & 23 defines roles for sensitive race operations (publishing official results and reopening finalized heats/brackets).
- **Decision**:
  - Only the primary account to which the race belongs (`role = 'owner'` of the track / organization) is permitted to publish official revisions or reopen completed heats/classes.
  - Operating staff, scorers, judges, and helpers cannot publish official results or reopen completed heats.
  - Any reopening action by the owner generates an immutable audit record in `audit_events`.
