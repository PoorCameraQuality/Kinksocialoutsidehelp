# Contributing

Thanks for looking at this. I'm not a professional open-source maintainer — these notes are just so we don't step on the same rakes.

## Before you dig in

1. Get local running from [README.md](README.md) / [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md).
2. Skim [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/DOMAIN_GLOSSARY.md](docs/DOMAIN_GLOSSARY.md) if you're touching privacy or auth.
3. Search for the thing you want to change before adding a second copy of it. There's already a lot of surface area.

## Where the real code is

- `packages/web`
- `packages/api`
- `packages/shared`
- `docker/` and the compose files if you're changing how it runs

## Local loop

```bash
docker compose -f docker-compose.dev.yml up -d
npm install
npm run db:prepare
npm run dev
```

Node 20 preferred.

Before you send changes:

```bash
npm run typecheck
npm run lint
npm run build
npm run test
npm run check:dc-classes -w web
```

Lint is web-only today. See [docs/TESTING.md](docs/TESTING.md).

## Stuff that matters (learned the hard way)

- One `users` row per person. Store UUID `user_id`, not usernames, on writes.
- Privacy/auth has to be enforced on the API. Hiding a button in the UI is not enough.
- If REST visibility changes, update WebSocket subscribe auth in the same change.
- Email / sync / mod jobs should go through BullMQ after commit. Don't pile new side effects into route handlers.
- Org tickets / vendor sales go through Stripe Connect per org or vendor. See `docs/adr/006-stripe-connect-per-org.md`.
- ECKE is outbound publish only. Don't invent inbound ECKE login.
- Schema changes need a migration and a plan for rollback. Add tests when you can.
- Don't weaken auth, privacy, upload checks, rate limits, or moderation just to make a test green.

## Auth helper

Prefer `requireAuthenticatedDbUser` (UUID only) on mutating / DB routes. Some older files still have a local `requireUser` wrapper. Migrate those when you touch them. Don't use a non-UUID session `sub` as a database id.

## PRs

Keep them small if you can. Say what you changed, how you tested it, and if migrations/env/privacy/auth/media/ECKE are involved.

## Security bugs

Don't open a public issue for something exploitable. See [SECURITY.md](SECURITY.md).
