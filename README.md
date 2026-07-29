# Kink.social

Controlled public alpha for [kink.social](https://kink.social). Organizer-first community tools for events, conventions, organizations, and groups, plus member social surfaces.

Public brand: **Kink Social**. Internal codename: **C2K**. Root npm package name remains `coast-to-coast-kink`.

This is not a full launch. Registration may be open. Bugs and demo content are expected.

## What this repository is

This GitHub tree is a **review and contribution slice** of the product: app packages, local/prod Compose shape, unit tests, and engineer docs. It is not the full private development workspace.

Omitted on purpose: Playwright e2e, private VPS/ops scripts, Storybook, demo seed images, agent tooling, and historical planning docs. See [docs/REMOVED_FILES_SUMMARY.md](docs/REMOVED_FILES_SUMMARY.md).

## Stack

| Layer | Path | Role |
|-------|------|------|
| Web | `packages/web` | Vite + React SPA |
| API | `packages/api` | Fastify HTTP API, Drizzle, BullMQ worker entry |
| Shared | `packages/shared` | Types, validation, privacy and policy helpers |
| Local infra | `docker-compose.dev.yml` | Postgres, Redis, MinIO, Mailpit (optional ClamAV profile) |
| Production | `docker-compose.prod.yml` + `docker-compose.prod.vps.yml` | VPS stack with Caddy in front of web and API |

## Repository layout

```text
packages/web      Canonical UI
packages/api      API, schema, worker
packages/shared   Shared contracts
docker/           Dockerfiles and nginx SPA config
scripts/          Local DB helpers (prepare / migrate)
docs/             Engineering documentation
```

## Requirements

- **Node 20** for the supported install and test path (CI uses Node 20; `engines` allows `>=18`)
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

Committed `.env.development` supplies local defaults (Postgres on `127.0.0.1:6432`, MinIO, Mailpit SMTP).

| URL | Purpose |
|-----|---------|
| http://localhost:5173 | Web |
| http://localhost:3001/api/health/ready | API readiness |
| http://127.0.0.1:8025 | Mailpit UI (local mail capture) |

Demo login after seed: username `RopeDreamer`. Password is `DEMO_LOGIN_PASSWORD` if set in the environment, otherwise **`demo`**.

See [Local development](docs/LOCAL_DEVELOPMENT.md).

## Common commands

```bash
npm run dev           # Vite :5173 + API :3001
npm run typecheck
npm run lint          # web ESLint
npm run build
npm run test          # @c2k/api test runner (includes shared + selected web unit tests)
npm run check:dc-classes -w web   # CI also runs this
```

Optional DB-backed API tests (Docker Postgres + Redis): `npm run test:db -w @c2k/api`. See [Testing](docs/TESTING.md).

For BullMQ mail, publish, and sweeps locally: build the API, then `npm run start:worker -w @c2k/api`.

## Production deployment overview

Supported path today: **VPS + Docker Compose + Caddy**.

1. Copy `.env.production.example` to `.env.production` on the host (never commit secrets).
2. Run migrations with Node 20 and a host-reachable `DATABASE_URL` (Compose hostname `postgres` only works inside the network).
3. Bring up `docker-compose.prod.yml`, plus `docker-compose.prod.vps.yml` when using the VPS overlay (MinIO/mail extras).

This slice includes CI (`.github/workflows/ci.yml`) but not the private deploy workflow or VPS patch scripts. See [Deployment](docs/DEPLOYMENT.md).

Do not run seed or database clear commands against production.

## Documentation

| Doc | Topic |
|-----|-------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute safely |
| [SECURITY.md](SECURITY.md) | Reporting security issues |
| [docs/ENGINEERING_REVIEW_CHECKLIST.md](docs/ENGINEERING_REVIEW_CHECKLIST.md) | Reviewer checklist |
| [docs/FEATURE_REGISTRY.md](docs/FEATURE_REGISTRY.md) | Routes and feature map |
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
| [docs/REMOVED_FILES_SUMMARY.md](docs/REMOVED_FILES_SUMMARY.md) | What this slice omits |

Index: [docs/README.md](docs/README.md).

## Project status

Public controlled alpha. Organizer Event Systems, orgs, groups, media, moderation, and outbound ECKE publishing are active development areas. Following-feed social work is intentionally lower priority than organizer alpha items unless product direction changes.

## Known major limitations

- Demo and seed content exist for local and alpha testing. This slice omits demo seed image binaries, so some catalog images may 404 locally.
- Some route modules still use thin local auth wrappers. New mutating routes should use `requireAuthenticatedDbUser`.
- Relationship words (`friends`, `connections`, `followers`) are not always the same graph edge. See the glossary.
- See [Known limitations](docs/KNOWN_LIMITATIONS.md) for more.
