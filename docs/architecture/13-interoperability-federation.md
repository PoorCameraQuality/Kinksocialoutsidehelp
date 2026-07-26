# Interoperability & federation preparation

C2K is designed as **identity authority**; ECKE is the first downstream consumer. Future federation should reuse export surfaces, not internal kit joins.

---

## Current interoperability: ECKE

| Direction | Mechanism |
|-----------|-----------|
| C2K → ECKE | `ecke-publish-routes.ts`, `ecke-publish-entity-routes.ts`, `ecke-publish-queue.ts` |
| ECKE → C2K | None for identity — marketing links only |

**Publish transport:** `requestEcke*Publish()` enqueues to `c2k-ecke-publish` (worker: `publish-article`, `publish-vendor`, `publish-convention-event`). Inline fallback when `C2K_ECKE_PUBLISH_INLINE=true` or Redis unavailable.

**State:** `ecke_publish_targets` stores payload hash, publish status.

**Settings on convention:** `eckeListingSlug`, `dancecardSlug`, `dancecardHost`, publish status.

**Doc:** [`ECKE_C2K_ENTITY_MAP.md`](../ECKE_C2K_ENTITY_MAP.md)

---

## Activity feed (partial Layer 2)

**Shipped:** `emitActivity()` → `c2k-feed-activities` queue → `feed_activities` table (`feed-activities.ts`, `feed-activities-queue.ts`).

**Verbs today:** `post`, `connection_accepted`, `event_created`, `event_rsvp`, `presenter_assigned`, `convention_pin`, `org_announcement`, `org_join`, `group_join`, `vendor_shop_live`

**Inline fallback:** `C2K_FEED_ACTIVITIES_INLINE=true`

Following-feed UI is still phase-2 — see strategic guidance. Ingest path exists; external federation ingest API does not.

---

## Stable export identifiers

Use in any future partner API:

| Entity | Keys |
|--------|------|
| User | `user_id` (UUID), `username` (public) |
| Organization | `organization_id`, `slug` |
| Group | `group_id` |
| Calendar event | `event_id` |
| Convention | `convention_id`, `slug` |
| Program slot | `schedule_slot_id`, ISO times |
| Participation | `(convention_id, user_id)` + `access_grant.role` |

Avoid exporting `convention_persons.id` as identity — directory staging id only.

---

## Recommended federation API layers (future)

### Layer 1 — Read-only public feeds (low risk)

```
GET /api/v1/federation/conventions/:slug/program
GET /api/v1/federation/events/upcoming?org_slug=
```

Auth: partner API key per org (`convention_api_keys` kit table exists — extend).

### Layer 2 — Activity ingest (medium risk)

```
POST /api/v1/federation/activities
  { actor_user_id, verb, object_type, object_id, occurred_at }
```

**Internal equivalent today:** `emitActivity({ actorId, verb, objectType, objectId })` after domain writes — not exposed externally.

### Layer 3 — Cross-instance following (high risk)

Requires:

- User consent + block matrix across instances
- Shared or federated identity (WebFinger, signed assertions)
- Abuse reporting across boundaries

**Do not** implement until Layer 1–2 stable.

---

## Webhook outbound (existing kit)

`convention_webhook_subscriptions` + `convention_webhook_deliveries`

Organizers can receive POST on schedule changes — pattern for partner automation today.

---

## Realtime federation

Do not expose raw `/api/ws` scopes externally.

Gateway pattern:

```
Partner ◀── signed SSE/WS ── Federation gateway ◀── Redis bus ◀── C2K API
```

Scope strings remain internal contract — see [10-websocket-scopes.md](./10-websocket-scopes.md).

---

## Email & list interoperability

- `scope_email_subscribers` — export CSV via existing platform captures
- Double opt-in tokens — do not replicate subscribers cross-domain without re-consent (GDPR)

---

## Modular domain evolution checklist

| Step | Action |
|------|--------|
| 1 | Extract publish payload builders from routes into `lib/ecke-publish-payload.ts` (partially exists) |
| 2 | ~~Add `ActivityEmitter` interface~~ — **done:** `emitActivity()` / `requestFeedActivityEmit()` |
| 3 | Redis bridge for `publishToScope` before multi-region |
| 4 | Document public OpenAPI for Layer 1 read APIs |
| 5 | Partner keys scoped to org_id — never global admin |
| 6 | Expose read-only federation activity ingest (wrap existing `feed_activities` schema) |

---

## Hidden coupling to break before federation

| Coupling | Break strategy |
|----------|----------------|
| Monolithic organizer routes | Registrar per domain |
| `ecosystem-stubs` name | Split social vs calendar modules |
| In-process realtime bus | Redis pub/sub |
| Stringly notification types | Enum registry in `@c2k/shared` |
| Mock/API dual UI | Single hook boundary per domain |

**Moved to workers (no longer blockers):** ECKE publish, feed activity insert, convention people-directory sync.

---

## Compliance & trust boundaries

- Federation partners must not receive `email` or `legal_name` without explicit export policy
- Use `profiles.display_name` + public fields only in Layer 1
- Attendance/grant data is sensitive — separate scope `convention:attendance:read`

---

## Versioning

Prefix federation routes with `/api/v1/federation/` and version independently (`v1`) so core app can evolve.
