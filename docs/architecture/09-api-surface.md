# API surface areas

**Last updated:** 2026-06-06 — **70** route registrars in `server.ts`; module list in [`FEATURE_REGISTRY.md`](../FEATURE_REGISTRY.md) §4 (not duplicated here).

Fastify app registers route modules from `server.ts`. Prefix convention: **`/api/v1/...`** for DB features when `USE_DATABASE=true`.

**Authoritative route/module inventory:** [FEATURE_REGISTRY.md](../FEATURE_REGISTRY.md) §4 — ship/audit checklist. This doc = architectural grouping and patterns only.

---

## Surface map (domain buckets)

| Domain | Modules (representative) |
|--------|--------------------------|
| **Auth & health** | `auth`, `health`, `GET /api/ws` |
| **Identity & profile** | `profile*`, `settings`, `me/*`, `iso-routes` |
| **Social & feed** | `ecosystem-stubs.ts`, `social-graph-routes`, `feed-routes`, `trending-routes`, `bookmark-routes` |
| **Community places & events** | `community-places-routes`, `event-discussions-routes`, `user-ecosystem` |
| **Organizations** | `organizations.ts`, org forums/channels, `organization-moderation` |
| **Conventions (public)** | `conventions-routes`, `convention-public-routes`, `convention-attendee-routes`, hub (`convention-hub-channels-routes`, `convention-hub-ext-routes`), `convention-iso-routes`, `convention-dancecard-routes` |
| **Event Systems** | `convention-organizer-routes`, `convention-organizer/*`, `organizer-routes` (scopes hub) |
| **Education & media** | `education-articles-routes`, `education-article-series-routes`, `media-routes`, `media-assets` |
| **Interop** | `ecke-publish-routes`, `ecke-publish-entity-routes`, `share-routes` |
| **Mail & push** | `mailer` (`lib/mailer.ts`), `email-routes`, `scope-email-routes`, `push-routes`, `notification-preferences-routes` |
| **Vendors & commerce** | `vendor-*`, `shopify-integration` |
| **Trust & moderation** | `moderation-*`, `community-trust-routes`, `scoped-standing-routes`, profile flags |
| **Voice** | `livekit-voice-routes` |
| **Background** | `packages/api/src/worker.ts` (BullMQ consumers — not HTTP) |

Per-module prefixes and status: **FEATURE_REGISTRY §4** (not duplicated here).

---

## API patterns

| Pattern | Example |
|---------|---------|
| **Viewer** | `resolveViewerFromRequest` → optional auth |
| **Require user** | 401 if no session |
| **Require DB** | 503 if `USE_DATABASE` false |
| **Zod body** | 400 on invalid |
| **Organizer gate** | `requireConventionCommand(key, userId, 'scheduler')` |
| **Convention access** | `getConventionWithAccess` |
| **Side effects** | `createNotification` / `sendEmail` / `sendWebPushToUsers` + optional `publishToScope` after commit; heavier work → BullMQ (`worker.ts`) |

---

## Extension points (interop)

| Endpoint family | Purpose |
|-----------------|---------|
| `GET/POST …/ecke-publish/*` | Marketing sync |
| `GET …/platform/email-captures` | Scope-list compliance export |
| Kit: webhooks, API keys, embed tokens | External automation |
| `GET …/me/participation` | Attendee state export per convention |

**Not public yet:** Federation OAuth, cross-instance activity ingest.

---

## `ecosystem-stubs.ts` clarification

Despite the name, this module registers production routes:

- Events CRUD + RSVP + group filter
- Groups list/detail/join
- Connections graph (also `social-graph-routes`)
- Conversations/messages
- Notifications list (`/api/v1/notifications`)
- Reports create
- Moderation job enqueue

Refactoring to `ecosystem-routes.ts` would reduce onboarding confusion. New domain routes should prefer dedicated modules registered from `server.ts`.

---

## Versioning & compatibility

- New routes: add under `/api/v1/`
- Breaking changes: avoid without version bump — mobile/web deploy together
- WS `eventType` strings: treat as public contract for web client

---

## Service extraction candidates

If splitting API:

1. **Convention organizer** — highest isolation, highest value
2. **Org hub** — channels + forums + WS scopes
3. **Vendor sync** — already worker-heavy (`c2k-external-sync`, `c2k-media-rss`)

Keep **identity session** on a shared auth service or sticky gateway. Realtime multi-replica needs Redis bridge (`C2K_REALTIME_REDIS_BRIDGE`) or sticky WS.
