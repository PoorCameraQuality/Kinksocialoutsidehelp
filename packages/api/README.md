# @c2k/api

Fastify 5 REST API + WebSocket (`/api/ws`) + BullMQ worker. PostgreSQL via Drizzle ORM.

## Develop

From **repo root** (recommended):

```bash
docker compose -f docker-compose.dev.yml up -d
npm run db:prepare     # schema push + seed
npm run dev            # api :3001 + web :5173
npm run dev:api        # api only
```

From this package:

```bash
npm run dev -w @c2k/api
```

- **Health:** http://localhost:3001/api/health
- **Readiness (DB):** http://localhost:3001/api/health/ready when `USE_DATABASE=true`

## Database

```bash
npm run db:push -w @c2k/api       # apply schema (drizzle-kit push)
npm run db:seed -w @c2k/api       # demo user + sample data
npm run db:seed:locations -w @c2k/api   # full US places (optional)
```

Schema source: `src/db/schema.ts`. Config: `drizzle.config.cjs` (loads repo-root `.env.development`).

If `db:push` fails with **module resolution** errors, build shared first from repo root:

```bash
npm run build -w @c2k/shared
npm run db:push -w @c2k/api
```

## Worker (background jobs)

```bash
npm run build -w @c2k/api
npm run start:worker -w @c2k/api
```

Queues: `c2k-moderation`, `c2k-external-sync`, `c2k-lifecycle` (group dormancy, org digest mail). Restart after schema or repeatable-job changes.

## Tests

```bash
npm run test -w @c2k/api          # unit tests (no Docker)
npm run test:db -w @c2k/api       # DB integration (needs Postgres)
```

Root `npm test` delegates to the unit suite.

## Key paths

| Path | Purpose |
|------|---------|
| `src/server.ts` | Fastify entry + WebSocket |
| `src/worker.ts` | BullMQ worker |
| `src/db/schema.ts` | Drizzle schema (single source of truth) |
| `src/routes/convention-organizer-routes.ts` | Event Systems `/api/v1/conventions/:key/…` (~60 routes) |
| `src/routes/conventions-routes.ts` | Public convention program + ISO board |
| `src/routes/ecosystem-stubs.ts` | Profiles, groups, events, connections, etc. |
| `src/lib/convention-participation.ts` | Identity Phase 1–2 registrant sync helpers |

## Docs

- Monorepo: [`../../README.md`](../../README.md)
- Env & commands: [`../../docs/technical-reference.md`](../../docs/technical-reference.md)
- Event Systems identity ADR: [`../../docs/EVENT_SYSTEMS_IDENTITY.md`](../../docs/EVENT_SYSTEMS_IDENTITY.md)
- Organizer API parity: [`../../docs/DANCECARD_ORGANIZER_PARITY.md`](../../docs/DANCECARD_ORGANIZER_PARITY.md)
