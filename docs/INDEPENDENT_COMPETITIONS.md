# Track and traveling series separation

Agreed requirements, October 6, 2026. This document supersedes earlier assumptions that a traveling series race belongs to a hosting track.

- Tracks and traveling series own separate competitions. Track in-house championships stay under Tracks.
- Traveling series races have a venue description, never a relationship to a track account. Matching names never connect entries or accounts.
- Each season has fresh racer/vehicle/class registrations. Race entry never enrolls a local in a championship.
- Overall results include all entrants and determine race prizes. Points ranks include only members eligible on the race date.
- Late registration gives zero for earlier races unless explicitly amended. Leaving preserves earned points.
- Each registered vehicle entry has its own totals, even when the driver is the same.
- Manual changes require an explanation and immutable change history. Signup bonuses can precede racing.
- Series organizers enter series results. Hosting track accounts receive no access or linkage.
- Show overall and championship standings on series pages and track in-house championship pages. Visiting series never alter track pages.
- Spectator filters: All, Tracks, Series. Track in-house championships remain Tracks.

## Implementation order

1. Preserve existing IDs, records and published history; inventory before migration.
2. Exclusive track/series race ownership, venue text, owner-based permissions and runtime actions.
3. Independent season registrations and eligible race-entry linkage; effective membership dates.
4. Owner-specific organizer routes, defaults, race entries, scoring, judging and offline operations.
5. Eligible points ranks; registration totals; signup bonuses and explained amendments.
6. Public owner-specific results and spectator filters.
7. Migration rehearsal, SQL/unit/browser acceptance, deployment and cleanup.

## Migration contract

Existing series races retain their IDs. Copy the existing venue name into the race before removing its track relationship. Existing track rows remain until their purpose is individually known; never delete real tracks or history as placeholder cleanup. Existing legacy championship versions remain archived. Existing roster entries become registrations in an initial season using recorded creation dates, rather than guessing retrospective eligibility. Each new season starts empty. Shared race/scoring tables may be used with exclusive ownership and checked permissions; they must never join a traveling series to a track.

## Required acceptance example

Jeremy (local), Jay (member), Michael (member), Scotty (local), Ronnie (local), Grumpy (member) finish in that order. Overall ranks remain 1–6. Eligible points ranks are Jay 1, Michael 2, Grumpy 3. Test both touring and track in-house seasons, vehicle separation, late registration, withdrawal, signup bonuses, explanations, history, unlinked venues and owner isolation.
