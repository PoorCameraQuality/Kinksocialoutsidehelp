# Runtime architecture series

Deeper architecture notes for backend and full-stack work.

Entry overview for new engineers: [../ARCHITECTURE.md](../ARCHITECTURE.md)

Route and feature inventory historically lived in `FEATURE_REGISTRY.md` in the private archive. Prefer code under `packages/api/src/server.ts` plus the canonical docs when those disagree.

## Documents

| Doc | Read when |
|-----|-----------|
| [01-domain-boundaries.md](./01-domain-boundaries.md) | Splitting services, avoiding duplicate models |
| [02-entity-relationships.md](./02-entity-relationships.md) | Schema and FK design |
| [03-permission-systems.md](./03-permission-systems.md) | Authorization changes |
| [04-event-workflows.md](./04-event-workflows.md) | Calendar vs convention lifecycles |
| [05-realtime-architecture.md](./05-realtime-architecture.md) | WebSocket scaling |
| [06-organizer-systems.md](./06-organizer-systems.md) | Event Systems / command bridge |
| [07-convention-operations.md](./07-convention-operations.md) | Registration, check-in, hub |
| [08-notification-systems.md](./08-notification-systems.md) | In-app, email, push, digests |
| [09-api-surface.md](./09-api-surface.md) | Route ownership |
| [10-websocket-scopes.md](./10-websocket-scopes.md) | Subscribe contracts |
| [11-background-workers.md](./11-background-workers.md) | BullMQ jobs |
| [12-moderation-systems.md](./12-moderation-systems.md) | Reports and trust |
| [13-interoperability-federation.md](./13-interoperability-federation.md) | ECKE publish and future federation |

## Runtime processes

```text
c2k-web  ->  c2k-api  ->  PostgreSQL
               |    \
               |     ->  Redis  ->  c2k-worker (BullMQ)
               |
               ->  S3 / MinIO
```

Hotspots to treat carefully:

- Large convention organizer route modules
- `ecosystem-stubs.ts` naming versus real DB-backed handlers
- In-process realtime publish versus multi-replica Redis bridge
- Convention people-directory sync called from multiple write paths
