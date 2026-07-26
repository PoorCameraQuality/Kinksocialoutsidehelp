# Organizer systems (Event Systems)

The organizer console is the **control plane** for conventions. Attendee-facing Dancecard on ECKE is a **runtime** surface, not a second admin.

**Product routes, tabs, smoke paths:** [ORGANIZER_CONSOLE.md](../ORGANIZER_CONSOLE.md) — authoritative UX/API inventory.

**This doc:** backend module map, command bridge, people sync, program ops — not a duplicate route table.

---

## Entry points (web)

See [ORGANIZER_CONSOLE.md](../ORGANIZER_CONSOLE.md) for `/organizer`, org/group/convention scopes, and tab matrix. API hub: `GET /api/v1/organizer/scopes` (`organizer-routes.ts`).

---

## API structure

| Module | Responsibility |
|--------|----------------|
| `convention-organizer-routes.ts` | Bootstrap, event settings, registrants, program slots, messaging campaigns/templates (large monolith) |
| `convention-organizer/index.ts` | Registers extension registrars via `registerConventionOrganizerExtensionRoutes` |
| `convention-organizer/people-routes.ts` | Directory, role buckets, enrichment |
| `convention-organizer/registration-routes.ts` | Categories, forms, questions |
| `convention-organizer/participation-routes.ts` | Participation offers (staff → applicant) |
| `convention-organizer/door-routes.ts` | Check-in, door export |
| `convention-organizer/program-ext-routes.ts` | Program extensions, CSV/ICS exports |
| `convention-organizer/ops-routes.ts` | Integrations, API keys, webhooks |
| `convention-organizer/policy-routes.ts` | Policy documents |
| `convention-organizer/modules-routes.ts` | Feature modules (ISO moderation shim, etc.) |

**Bootstrap payload:** `GET …/organizer/bootstrap` returns permissions, event DTO, slots, shifts, timezone window — drives entire shell.

---

## Command bridge (authorization product)

**Problem solved:** Org MODERATOR used to imply full convention access; now fine-grained grants for volunteers.

| Domain | Typical user |
|--------|----------------|
| `registration` | Registration desk, vetting |
| `staff_ops` | Volunteer coordinator, safety |
| `scheduler` | Program chair |

**Team API:** `GET|PUT|DELETE …/command-team` — CRUD `convention_command_grants`.

**Nav filtering:** Client reads `permissions` from bootstrap; API enforces on every mutating route.

Types live in `packages/shared/src/convention-command-permissions.ts` — keep in sync with API checks.

---

## People hub (identity merge)

**Workflow:**

1. Staff adds signup → `convention_registrants` with `user_id`
2. `syncConventionPeopleDirectory` merges into `convention_persons` + role buckets (registered, staff, presenter, …)
3. Organizer views **Signups** (registrant rows) or **Roster** (directory) with cross-links (`directoryPersonId`)

**Async sync:** Most writes call `requestConventionPeopleDirectorySync` → BullMQ queue `c2k-convention-people-sync` (`worker.ts` runs `syncConventionPeopleDirectory`). Inline sync remains for seed/scripts.

**Munch template:** `settings.eventSystems.peopleHubTemplate = 'munch'` → UI shows signups + roster tabs only.

**Read API:** `GET …/people` returns `participation: { registrantId, registered }` per directory row.

---

## Program operations

- Slots: CRUD, conflict warnings (`computeDancecardConflicts` in `conflictScanner.ts`), CSV import/export
- Bulk import publish: `scheduleImportPublish.ts` → WS `schedule_import_publish`
- Presenters: linked to `presenter_profiles` / slot presenters
- Locations/venues: `convention_locations` + migration from legacy `venueRooms` settings
- Publish: slot mutations → WS `schedule_slot_*` / `schedule_staff_updated` events via `publishToScope`

---

## Messaging ops (organizer)

Kit tables: `convention_message_templates` → `convention_message_campaigns` → `convention_message_deliveries`.

Routes live in `convention-organizer-routes.ts` (`…/message-templates`, `…/message-campaigns`, `…/send`).

- Test send hits real `sendEmail` (`lib/mailer.ts`) when transport enabled
- Distinct from hub chat (attendee, `convention-hub-channels-routes.ts`) and org channels (community)

---

## Exports & integrations

- CSV exports (registrants, program) — extension registrars + monolith
- Webhooks, embed tokens, Google sheet connections (kit)
- ECKE publish preview/publish (`ecke-publish-routes.ts`); worker queue `c2k-ecke-publish`

---

## Coupling hotspots

| Hotspot | Why it matters |
|---------|----------------|
| Monolithic `convention-organizer-routes.ts` | Hard to extract microservice; extension routes only partially split |
| People directory sync (queued + idempotent) | Must stay safe to retry; worker required for async path |
| Bootstrap aggregates slots+shifts | Large payload; permission-gated partial load |
| Kit schema in separate file | Migrations must run both schema files |

---

## Modular evolution path

1. Split monolith routes by domain registrar (people, program, registration, door, ops already started)
2. Extract `OrganizerService` libs with no Fastify types — enables worker/CLI reuse
3. Expose **read-only** organizer APIs for federation (`/api/v1/federation/...`) without duplicating kit tables
