# Domain boundaries

Domains are **operational systems** with stable nouns and workflows. Pages are views on these domains.

---

## Bounded contexts

| Domain | Owns | Must not own |
|--------|------|----------------|
| **Identity** | `users`, `profiles`, sessions, bans | Per-event duplicate person accounts |
| **Social graph** | `connections`, `user_follows`, blocks, mutes, DMs | Org membership |
| **Feed (global)** | `feed_posts`, trending | Convention program |
| **Feed (following)** | `feed_activities`, `feed-routes.ts` | Second post table for same content |
| **Org hub** | `organizations`, org channels, org forums, org calendar | Convention kit registrant schema |
| **Group** | `groups`, group forums, group events filter | Separate group identity model |
| **Calendar event** | `events`, `event_rsvps`, contributors | Multi-day slot grid (→ convention) |
| **Convention (attendee)** | Public hub, grants, pins, hub channels, ISO board | Organizer import batches |
| **Event Systems (organizer)** | Registrants, program CRUD, messaging campaigns, exports | ECKE login state |
| **Vendor commerce** | `vendor_profiles`, `products`, external listings cache | Org billing |
| **Discovery** | People search, groups nearby, presenters directory | Feed ranking engine (minimal today) |
| **Trust & safety** | `reports`, moderation jobs, reputation events | Business workflow state |
| **Platform comms** | Mail, push, digests, scope email lists | Message body storage for campaigns (uses kit tables) |
| **Publish bridge** | `ecke_publish_targets`, outbound payloads | Inbound ECKE auth |

---

## Service boundary (deployable)

| Process | Code entry | Stateful? |
|---------|------------|-----------|
| **API** | `packages/api/src/server.ts` | Yes — in-memory realtime bus |
| **Worker** | `packages/api/src/worker.ts` | No — Redis queues only |
| **Web** | Static SPA | No |

All business rules today live in **API `lib/` + `routes/`**. Worker invokes the same libs for sweeps and async fan-out (`org-digest-sweep`, `pinned-digest-sweep`, `c2k-feed-activities`, `c2k-convention-people-sync`, etc.).

---

## Cross-domain integration rules

1. **Identity spine:** Any write that represents a person on C2K resolves to `users.id` first ([`EVENT_SYSTEMS_IDENTITY.md`](../EVENT_SYSTEMS_IDENTITY.md)).
2. **Extend before add:** New convention-scoped behavior extends `conventions`, `schedule_slots`, or kit tables — no parallel “attendee table” differing only by FK ([`EXTEND_BEFORE_ADD.md`](../EXTEND_BEFORE_ADD.md)).
3. **Realtime scopes are contracts:** `convention:{id}:schedule` and `org:{id}:channel:{id}` must stay stable for WS clients and future federation consumers.
4. **Notifications are a side effect:** `createNotification()` and mail/push are invoked from domain routes — not a separate notification microservice.

---

## Coupling map (intentional vs risky)

| Coupling | Type | Notes |
|----------|------|-------|
| Convention → Organization | FK `conventions.organization_id` | Required for organizer; conventions without org cannot use command bridge |
| Event → Convention | `conventions.anchor_event_id` | Ticketing/RSVP on event; program on convention |
| Registrant → Access grant | `syncAccessGrantOnRegistration()` | Registration write must keep gate in sync |
| Registrant → People directory | `requestConventionPeopleDirectorySync()` → worker `c2k-convention-people-sync` | Called after registrant/import writes |
| Org chat → WS | `publishToScope` after message insert | Client refetch pattern |
| ECKE publish → Convention settings | `settings.dancecardSlug`, `eckeListingSlug` | Outbound only |

**Risky:** Discover still reads global `feed_posts` while Following reads `feed_activities` — dual home paths; see [`FETLIFE_CLASS_HOME.md`](../FETLIFE_CLASS_HOME.md).

---

## Federation-ready boundaries (future)

Treat these as **export surfaces**, not internal joins:

| Export | Stable keys |
|--------|-------------|
| Actor | `user_id`, public `username` |
| Event listing | `event_id`, `convention_id`, `slug` |
| Program slot | `schedule_slot_id`, times, location labels |
| Participation | `(convention_id, user_id)` + grant role |
| Activity | `feed_activity_id`, verb, object_type, object_id |

Avoid federation partners writing to `convention_persons` without `user_id` — staging table only.

---

## Module ownership (code)

| Path prefix | Domain |
|-------------|--------|
| `routes/organizations.ts` | Org hub |
| `routes/conventions-routes.ts` | Convention hub + program API (large) |
| `routes/convention-attendee-routes.ts`, `convention-public-routes.ts` | Attendee hub + public self-registration |
| `routes/convention-hub-channels-routes.ts`, `convention-hub-ext-routes.ts` | Hub chat, pin, gallery (not org channels) |
| `routes/convention-organizer-routes.ts`, `routes/convention-organizer/*` | Event Systems (door, people, ops, program ext) |
| `routes/ecosystem-stubs.ts` | Calendar events, groups, connections, DMs, notifications (misnamed) |
| `routes/social-graph-routes.ts` | Follows + connection lifecycle helpers |
| `routes/feed-routes.ts` | Following feed read |
| `routes/ecke-publish-routes.ts`, `ecke-publish-entity-routes.ts` | Outbound marketing |
| `lib/convention-participation.ts` | Registrant upsert + access-grant sync |
| `lib/convention-people-sync.ts` | People directory rebuild |
| `lib/convention-command-access.ts` | Command bridge resolution |
