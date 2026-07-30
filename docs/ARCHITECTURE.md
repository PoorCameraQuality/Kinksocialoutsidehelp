# Architecture

Short version: Vite React frontend, Fastify API, shared package, Postgres, Redis/BullMQ, object storage for uploads, Caddy in front in prod.

This isn't a formal design doc. It's how the pieces actually fit today.

## Runtime picture

```text
Browser (packages/web)
    |
    |  /api proxied in local Vite, same-origin via Caddy in prod
    v
Fastify API (packages/api)
    |-- PostgreSQL (Drizzle)
    |-- MinIO or S3
    |-- /api/ws realtime (subscribe auth matches REST visibility)
    '-- enqueue BullMQ jobs -> Redis -> worker process
```

Processes:

| Process | Entry | Role |
|---------|-------|------|
| Web | Vite dev or nginx SPA image | UI |
| API | `packages/api` server | HTTP, WebSocket, enqueue jobs |
| Worker | `packages/api/src/worker.ts` | BullMQ consumers |
| Postgres | Docker or managed | Primary store |
| Redis | Docker or managed | Queues and optional realtime bridge |

## Packages

| Package | Responsibility |
|---------|----------------|
| `packages/web` | Member and organizer UI |
| `packages/api` | Routes, schema, workers, integrations |
| `packages/shared` | Enums, Zod schemas, privacy helpers, ECKE safety helpers |

## Domains

High-level product domains:

- Identity and profiles
- Organizations and groups
- Events and conventions (Event Systems)
- Messaging and notifications
- Media uploads and scanning
- Moderation and reporting
- Education content
- Outbound ECKE public publishing
- Optional search (Typesense)
- Optional observability

Deeper domain notes live under [`architecture/`](./architecture/). Prefer that series when changing schema, permissions, workers, or WebSocket scopes.

## Authentication

1. Session cookie (`c2k_session`) is verified on the API.
2. Viewer resolution lives in `packages/api/src/auth/resolve-viewer.ts`.
3. Database mutations should use a UUID user id from `requireAuthenticatedDbUser` / `getViewerUserId`.
4. Production refuses startup when `AUTH_ALLOW_FALLBACK=true`.

Do not store a display username as a foreign key.

## Authorization

Permission layers, from broad to narrow:

1. Platform staff
2. Organization roles
3. Group roles
4. Convention attendee / registration state
5. Convention command-bridge grants (registration, staff ops, scheduler)
6. Resource-specific visibility

See [`architecture/03-permission-systems.md`](./architecture/03-permission-systems.md).

## Visibility and privacy

Visibility is enforced in the API. Shared helpers define levels. Domain libs apply them to queries and responses.

Important mismatches to remember:

- Settings value `friends` often means accepted mutual connections.
- Media enum `FOLLOWERS` is gated by accepted connections in current asset paths, not one-way follow.
- Feed activity `connections_only` is surface-specific. The following feed builds an audience from accepted connections plus one-way follows (the set is passed into a helper still named `viewerFollowsActor`). People/discovery post counts that use `connections_only` require mutual connections.

Details: [PRIVACY_AND_VISIBILITY.md](./PRIVACY_AND_VISIBILITY.md).

## Realtime

- Endpoint: `GET /api/ws`
- Subscribe authorization must stay aligned with REST visibility.
- Multi-replica API can use a Redis bridge (`C2K_REALTIME_REDIS_BRIDGE`). See [`architecture/05-realtime-architecture.md`](./architecture/05-realtime-architecture.md).

## Background workers

Worker process: `packages/api/src/worker.ts`.

Queues registered there include moderation, external vendor sync, lifecycle/retention, convention people sync, participation-offer email, search sync, feed activities, ECKE publish, and media RSS.

API and worker need the same database, Redis, and mail configuration for jobs that send mail or write data.

## Media

Uploads go through validation, quarantine storage, scanning, and publish-lane gates. Viewer access needs both content rating/status checks and scope checks (profile, group, org, event, and so on).

See [MEDIA_AND_STORAGE.md](./MEDIA_AND_STORAGE.md).

## Moderation

Reports map into policy reasons, then platform or scoped queues. Humans decide outcomes. P0 reasons need fast platform notify. Platform-critical reasons must not be dismissed as local-only.

See [MODERATION_AND_REPORTING.md](./MODERATION_AND_REPORTING.md).

## ECKE publishing

Kink.social owns member data. ECKE receives public-safe copies for SEO and discovery. Publishing is outbound only.

See [ECKE_INTEGRATION.md](./ECKE_INTEGRATION.md).

## Payments

Org tickets and vendor sales use Stripe Connect per organization or vendor. See [`adr/006-stripe-connect-per-org.md`](./adr/006-stripe-connect-per-org.md).

## Search and email

- Local mail capture uses Mailpit. Production uses SMTP or Resend.
- Typesense search is optional and disabled by default.

## Observability

Optional error tracking and uptime tooling are documented in [OPERATIONS.md](./OPERATIONS.md).

## Known hotspots

- `ecosystem-stubs.ts` is a legacy filename for real DB-backed routes.
- Large convention and organization route modules mix audiences.
- In-process realtime publish may need the Redis bridge when API replicas scale out.
