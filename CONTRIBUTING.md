# Contributing

Thanks for helping with Kink.social. This guide is for engineers working in this review and contribution snapshot.

## Before you change code

1. Read [README.md](README.md) and [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md).
2. Skim [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/DOMAIN_GLOSSARY.md](docs/DOMAIN_GLOSSARY.md).
3. Search existing routes, tables, and hooks for the feature noun before adding a parallel path.
4. Prefer extending what already exists over a second schema, route stack, or UI flow.

## Active code

Work in:

- `packages/web`
- `packages/api`
- `packages/shared`
- `docker/` and the root Compose files when changing how the stack runs

## Development workflow

```bash
# Local development
docker compose -f docker-compose.dev.yml up -d
npm install
npm run db:prepare
npm run dev
```

Use Node 20.

Before opening a PR that changes behavior:

```bash
npm run typecheck
npm run lint
npm run build
npm run test
npm run check:dc-classes -w web
```

`npm run lint` covers the web package. See [docs/TESTING.md](docs/TESTING.md).

## Coding rules that matter here

- One `users` row per person. Store UUID `user_id` on writes, not display usernames.
- Enforce privacy and authorization on the API. UI hints are not enough.
- When REST visibility changes, update WebSocket subscribe auth in the same change.
- Side effects such as email, sync, push, and moderation jobs belong in BullMQ after commit. Do not add new inline side effects in route handlers.
- Payments for org tickets and vendor sales use per-org / per-vendor Stripe Connect. See `docs/adr/006-stripe-connect-per-org.md`.
- ECKE publishing is outbound only. Do not invent inbound ECKE member auth.
- Schema changes need a migration, compatibility note, rollback idea, and tests.
- Do not weaken auth, privacy, upload validation, rate limits, or moderation to make a test pass.

## Auth helpers

Mutating and DB-backed routes should use `requireAuthenticatedDbUser` (UUID only). Some older modules still wrap this in a local `requireUser`. Migrate those file by file. Do not fall back to a non-UUID session `sub` as a foreign key.

## Pull requests

Keep PRs focused. Include:

- What changed and why
- How you tested it
- Any migration or env impact
- Notes for privacy, auth, media, or ECKE when those areas are touched

## Security issues

Do not open a public issue for exploitable vulnerabilities. See [SECURITY.md](SECURITY.md).
