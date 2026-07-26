# ADR 003: In-person event location privacy and RSVP extensions

## Status

Accepted — implemented 2026-04-05.

## Context

C2K uses a single `events` row for all formats ([FEATURE_REGISTRY.md](../FEATURE_REGISTRY.md)). Virtual events already redact HTTPS join URLs until the viewer is the host, an org moderator+, or has RSVP **going**/**maybe** (`virtual-event-join-visibility.ts`). In-person events previously exposed the full `location` string to everyone, which is unsafe for munches, home-hosted socials, and vetting-heavy communities.

Compass research and internal [ADULT_PLATFORM_DESIGN_RESEARCH.md](../ADULT_PLATFORM_DESIGN_RESEARCH.md) call for tiered address disclosure aligned with the **munch → semi-private → private** pipeline.

## Decision

### Location visibility (`location_visibility`)

Three values on `events`:

| Value | Meaning | Who sees full `location` |
|-------|---------|---------------------------|
| `public` | Default / legacy | Everyone |
| `rsvp` | Neighborhood-style disclosure | Host, org moderator+, RSVP going/maybe |
| `approved` | Host-vetted | Host, org moderator+, RSVP going/maybe **and** `rsvp_approval_status = approved` |

When full location is hidden, clients show `public_location_summary` (e.g. city/neighborhood + venue label). If that field is empty, APIs still return `location: null` and the UI should show a generic “RSVP for details” / “Pending host approval” message as appropriate.

Virtual events: unchanged. Redaction for HTTPS join URLs remains independent of `location_visibility`.

### RSVP approval (`rsvp_approval_status` on `event_rsvps`)

- `not_required` — normal events (`location_visibility` is `public` or `rsvp`).
- `pending` — user requested **going** on an `approved` visibility event; full address hidden until host action.
- `approved` / `rejected` — host decision.

**Maybe** RSVPs do not require approval for address unlock on `approved` events (only **going** + **approved** unlocks). Hosts may still use screening answers for soft vetting.

### Waitlist (`event_rsvp_status = waitlist`)

When `capacity_max` is set and committed **going** count is at capacity, new **going** requests become **waitlist** instead of **going**. **Maybe** does not consume capacity.

`events.rsvp_count` counts only **committed going**: status `going` and `rsvp_approval_status` in (`not_required`, `approved`) — not `pending`, not `waitlist`.

### Calendar (`.ics`)

`LOCATION` is included only when the same rules as the API would return full `location` for that authenticated user. Otherwise the event still appears with summary in `DESCRIPTION` and link to the event page.

### Attendee list visibility (`attendee_list_visibility`)

- `public` — `GET .../attendees` returns display names for committed going (+ maybe optional later).
- `count_only` — only aggregate counts; no per-user rows for non-host viewers. Hosts and org moderators+ always receive the full list from the host endpoint.

## Consequences

- Org calendar and global event list must apply the same redaction helpers as `GET /api/v1/events`.
- Mutual “friends going” counts should only include committed **going**, not waitlist or pending approval.
- Legal review remains required before native paid ticketing (out of scope for this ADR).
