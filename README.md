# Kink.social

This is the code for [kink.social](https://kink.social) — tools for kink community organizers (events, conventions, orgs, groups) plus the member-facing site.

I'm shipping this as a controlled public alpha. Things break. Demo data exists. That's expected.

Public name is **Kink Social**. Internally I still call it **C2K**. The npm package is still named `coast-to-coast-kink` because renaming everything was not worth it yet.

## What's in this repo

I put this up so people can look at the real app code (auth, privacy, API, UI) and help.

It's not my whole private workspace. I left out a bunch of junk that would just get in the way: Playwright suites, one-off VPS scripts, Storybook, big seed image folders, planning notes, etc. Short list: [docs/REMOVED_FILES_SUMMARY.md](docs/REMOVED_FILES_SUMMARY.md).

## Stack (roughly)

| Piece | Where | What |
|-------|-------|------|
| Web | `packages/web` | Vite + React |
| API | `packages/api` | Fastify, Drizzle, worker |
| Shared | `packages/shared` | Types / policy helpers |
| Local stuff | `docker-compose.dev.yml` | Postgres, Redis, MinIO, Mailpit |
| Prod shape | `docker-compose.prod.yml` (+ VPS overlay) | Compose + Caddy |

```text
packages/web
packages/api
packages/shared
docker/
scripts/     # basically db prepare + migrate helpers
docs/
```

## Getting it running

Use **Node 20** if you can. CI uses 20. You'll want Docker.

```bash
docker compose -f docker-compose.dev.yml up -d
npm install
npm run db:prepare
npm run dev
```

`.env.development` is already in the repo for local defaults. Postgres is on `127.0.0.1:6432` (not 5432).

| URL | What |
|-----|------|
| http://localhost:5173 | Site |
| http://localhost:3001/api/health/ready | API health |
| http://127.0.0.1:8025 | Mailpit (caught emails) |

After seed, log in as `RopeDreamer` / `demo` (or whatever you set in `DEMO_LOGIN_PASSWORD`).

More detail: [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md).

## Commands I actually use

```bash
npm run dev
npm run typecheck
npm run lint          # web only
npm run build
npm run test          # unit tests (api runner also pulls some shared/web tests)
```

CI also runs `npm run check:dc-classes -w web`.

DB-backed tests (needs Docker up): `npm run test:db -w @c2k/api` — see [docs/TESTING.md](docs/TESTING.md).

Queues (mail, publish jobs, etc.) need the worker after an API build:

```bash
npm run build -w @c2k/api
npm run start:worker -w @c2k/api
```

## Prod (high level)

I run this on a VPS with Docker Compose and Caddy. Not Kubernetes.

1. Put secrets in `.env.production` on the server (start from `.env.production.example`)
2. Migrate with Node 20 and a `DATABASE_URL` the host can actually reach
3. `docker-compose.prod.yml`, and the VPS overlay file if you're using that setup

There's CI here. The private deploy automation is not in this repo. More in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Please don't seed or wipe a live database.

## Docs

I wrote these as I went. They're not a polished handbook. Start with the README, then whatever topic you're looking at.

| Doc | Notes |
|-----|-------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | If you're changing code |
| [SECURITY.md](SECURITY.md) | If you find a security hole |
| [docs/ENGINEERING_REVIEW_CHECKLIST.md](docs/ENGINEERING_REVIEW_CHECKLIST.md) | Loose checklist for reviews |
| [docs/FEATURE_REGISTRY.md](docs/FEATURE_REGISTRY.md) | Big route / feature dump |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the pieces fit |
| [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md) | Local setup |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deploy notes |
| [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md) | Env vars |
| [docs/TESTING.md](docs/TESTING.md) | Tests |
| [docs/DATABASE.md](docs/DATABASE.md) | DB / migrations |
| [docs/DOMAIN_GLOSSARY.md](docs/DOMAIN_GLOSSARY.md) | Words that mean different things |
| [docs/PRIVACY_AND_VISIBILITY.md](docs/PRIVACY_AND_VISIBILITY.md) | Privacy |
| [docs/MODERATION_AND_REPORTING.md](docs/MODERATION_AND_REPORTING.md) | Reports / mod |
| [docs/MEDIA_AND_STORAGE.md](docs/MEDIA_AND_STORAGE.md) | Uploads |
| [docs/ECKE_INTEGRATION.md](docs/ECKE_INTEGRATION.md) | Publishing out to ECKE |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Day-to-day ops |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | When stuff breaks |
| [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) | Known rough edges |

Full index: [docs/README.md](docs/README.md).

## Where things stand

Alpha. I'm focused on organizer tools (events, door, orgs, groups), media, moderation, and outbound ECKE. The social following-feed stuff is lower priority for now.

## Heads-up

- Some seed images aren't in this repo, so a few demo pictures may 404 locally. The app still runs.
- Auth helpers aren't perfectly consistent everywhere yet. New mutating routes should use `requireAuthenticatedDbUser`.
- Words like `friends`, `connections`, and `followers` are not always the same relationship in code. Check the glossary before changing privacy.
- More rough edges: [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md).
