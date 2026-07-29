# Database

Primary store: PostgreSQL with PostGIS. Schema and queries use Drizzle in `packages/api`.

## Local database

```bash
# Local development
docker compose -f docker-compose.dev.yml up -d
npm run db:prepare
```

`db:prepare`:

1. Refuses production environments
2. Waits for Postgres
3. Drizzle push
4. Incremental migrations
5. Seed
6. Preview attendee parity helpers

## Production migrations

```bash
# Production VPS
npm run db:migrate-prod
```

This builds the API package, pushes schema, then runs hub/incremental/organizer migration scripts. It fails closed on errors.

Do not run seed or wipe scripts against production.

## Identity rule

One `users` row per person. Ownership columns should reference the user UUID.

Capability profiles (presenter, vendor, organizer roles) attach to that identity. Do not invent parallel account tables for those roles.

## Retention

Shared defaults live in `packages/shared/src/retention-policy.ts` (security logs, DMs, notifications, abandoned accounts, and related windows).

When changing retention, update the shared constants, the worker sweep behavior, and this doc together.

## Schema change checklist

1. Add a migration or incremental script as the project expects
2. Note backward compatibility
3. Document rollback or forward-fix approach
4. Add migration or regression tests where possible
5. Never rely on local-only `db:prepare` as the production path

## Seeds

Local and alpha seeds create demo orgs, conventions, and users such as `RopeDreamer`. Treat seed passwords as local test credentials only.
