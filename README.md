# Kink.social

Controlled public alpha for [kink.social](https://kink.social). Organizer-first community tools for events, conventions, organizations, and groups, plus member social surfaces.

Public brand: **Kink Social**. Internal codename: **C2K**.

This is not a full launch. Registration may be open. Bugs and demo content are expected.

## Stack

| Layer | Path | Role |
|-------|------|------|
| Web | `packages/web` | Vite + React SPA |
| API | `packages/api` | Fastify HTTP API, Drizzle, BullMQ worker entry |
| Shared | `packages/shared` | Types, validation, privacy and policy helpers |
| Local infra | `docker-compose.dev.yml` | Postgres, Redis, MinIO, Mailpit |
| Production | `docker-compose.prod.yml` + `docker-compose.prod.vps.yml` | VPS stack with Caddy in front of web and API |

## Repository layout

```text
packages/web      Canonical UI
packages/api      API, schema, worker
packages/shared   Shared contracts
docker/           Dockerfiles and nginx SPA config
scripts/          Minimal local DB helpers (prepare / migrate)
docs/             Engineering documentation
```

This GitHub tree is a **review slice** of the product. Playwright e2e, private ops scripts, and historical trees are not included. See [docs/REMOVED_FILES_SUMMARY.md](docs/REMOVED_FILES_SUMMARY.md).

## Requirements

- **Node 20** for the supported install and test path (CI uses Node 20)
- npm (workspace root uses npm scripts and `package-lock.json`)
- Docker and Docker Compose for local Postgres, Redis, MinIO, and Mailpit

## Fast local setup

```bash
# Local development
docker compose -f docker-compose.dev.yml up -d
npm install
npm run db:prepare
npm run dev
```

| URL | Purpose |
|-----|---------|
| http://localhost:5173 | Web |
| http://localhost:3001/api/health/ready | API readiness |
| http://127.0.0.1:8025 | Mailpit UI (local mail capture) |

Demo login after seed: username `RopeDreamer`, password from `DEMO_LOGIN_PASSWORD` in `.env.development` (default `demo`).

See [Local development](docs/LOCAL_DEVELOPMENT.md).

## Common commands

```bash
npm run dev           # Vite :5173 + API :3001
npm run typecheck
npm run lint
npm run build
npm run test          # API unit tests (includes auth / privacy helpers)
```

Start the worker separately when you need queues. See [Local development](docs/LOCAL_DEVELOPMENT.md) (`npm run start:worker -w @c2k/api` after an API build).

## Production deployment overview

Supported path today: **VPS + Docker Compose + Caddy**.

1. Copy `.env.production.example` to `.env.production` on the host (never commit secrets).
2. Run `npm run db:migrate-prod` against production with Node 20.
3. Bring up the compose stack (`docker-compose.prod.yml`, plus the VPS overlay when used).

Do not run seed or database clear commands against production.

Details: [Deployment](docs/DEPLOYMENT.md).

## Documentation

| Doc | Topic |
|-----|-------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute safely |
| [SECURITY.md](SECURITY.md) | Reporting security issues |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Runtime architecture |
| [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md) | Local setup |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | VPS deploy |
| [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md) | Env reference |
| [docs/TESTING.md](docs/TESTING.md) | Tests |
| [docs/DATABASE.md](docs/DATABASE.md) | Database and migrations |
| [docs/DOMAIN_GLOSSARY.md](docs/DOMAIN_GLOSSARY.md) | Shared vocabulary |
| [docs/PRIVACY_AND_VISIBILITY.md](docs/PRIVACY_AND_VISIBILITY.md) | Privacy rules |
| [docs/MODERATION_AND_REPORTING.md](docs/MODERATION_AND_REPORTING.md) | Reports and moderation |
| [docs/MEDIA_AND_STORAGE.md](docs/MEDIA_AND_STORAGE.md) | Uploads and media |
| [docs/ECKE_INTEGRATION.md](docs/ECKE_INTEGRATION.md) | Outbound ECKE publish |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Ops and observability |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common failures |
| [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) | Current limits |

Index: [docs/README.md](docs/README.md).

## Project status

Public controlled alpha. Organizer Event Systems, orgs, groups, media, moderation, and outbound ECKE publishing are active development areas. Following-feed social work is intentionally lower priority than organizer alpha items unless product direction changes.

## Known major limitations

- Demo and seed content exist for local and alpha testing.
- Some route modules still use thin local auth wrappers. New mutating routes should use `requireAuthenticatedDbUser`.
- Relationship words (`friends`, `connections`, `followers`) are not always the same graph edge. See the glossary.
- See [Known limitations](docs/KNOWN_LIMITATIONS.md) for more.
