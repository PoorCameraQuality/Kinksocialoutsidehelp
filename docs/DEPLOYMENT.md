# Deployment

Supported production path: **VPS + Docker Compose + Caddy**.

Related files in this snapshot:

- `docker-compose.prod.yml`
- `docker-compose.prod.vps.yml`
- `.env.production.example`
- `Caddyfile`
- `docker/api.Dockerfile`, `docker/web.Dockerfile`
- `npm run db:migrate-prod`

## Required services

| Service | Role |
|---------|------|
| Postgres (PostGIS) | Primary data |
| Redis | BullMQ and optional realtime bridge |
| API | Fastify HTTP and WebSocket |
| Worker | BullMQ jobs |
| Web | Static SPA behind nginx |
| Caddy | TLS and reverse proxy |
| External S3-compatible storage | Uploads (production compose does not include MinIO) |
| SMTP or Resend | Transactional mail |

## Environment

Copy `.env.production.example` to `.env.production` on the host. Never commit real secrets.

Minimum for a working pilot:

| Variable | Notes |
|----------|--------|
| `NODE_ENV=production` | Set by compose for api/worker |
| `USE_DATABASE=true` | Required for `/api/v1/*` |
| `DATABASE_URL` | Production Postgres |
| `REDIS_URL` | Production Redis |
| `AUTH_SECRET`, `COOKIE_SECRET` | Strong random values |
| `AUTH_ALLOW_FALLBACK` | Must not be `true` in production (API exits if explicitly enabled) |
| `C2K_FIELD_ENCRYPTION_KEY` | Required when DB mode is on |
| `EMAIL_LOOKUP_PEPPER` | Required when DB mode is on |
| `EXTERNAL_STORE_SECRET` | Required in production for encrypted storefront secrets |
| `CORS_ORIGIN` | Public web origin |
| `C2K_PUBLIC_WEB_URL` | Canonical site URL, no trailing slash |
| `DOMAIN` | Hostname for Caddy TLS |
| `S3_*` | Required when uploads are enabled |
| Mail vars | `C2K_MAIL_TRANSPORT`, `C2K_MAIL_FROM`, SMTP or Resend |

Web build: leave `VITE_API_URL` empty for same-origin Caddy.

Full table: [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md).

## First deploy (VPS Compose)

1. Provision Ubuntu with Docker, Compose, and Node 20 for host migrations.
2. Point DNS at the VPS.
3. Clone the repo to the deploy path.
4. Create `.env.production` from the example.
5. Configure the external S3 bucket and mail.
6. Run migrations (no seed):

```bash
# Production VPS
export NODE_ENV=production
set -a && source .env.production && set +a
npm ci
npm run db:migrate-prod
```

7. Start the stack:

```bash
# Production VPS
docker compose -f docker-compose.prod.yml up -d --build
```

Use the VPS overlay file when your host setup requires it (`docker-compose.prod.vps.yml`).

8. Create the first org through the UI. Do not run `db:seed` on production.

## Migrations

Production schema updates use:

```bash
# Production VPS
npm run db:migrate-prod
```

That script verifies env, builds the API package, pushes schema, then runs hub/incremental/organizer migrations. It exits non-zero on failure.

Local-only:

```bash
# Local development - destructive seed path, blocked in production
npm run db:prepare
```

## CI in this snapshot

This slice ships `.github/workflows/ci.yml` (typecheck, build, unit tests, DB smokes). The private deploy workflow and VPS patch scripts are not included. Production release steps still follow the Compose + migrate path above; never run `db:seed` or `db:prepare` against production.

## Health checks

| Endpoint | Expected |
|----------|----------|
| `GET /api/health/live` | 200 |
| `GET /api/health/ready` | 200 and `database: "ok"` when DB mode is on |
| Web `/` | 200 SPA shell |

Readiness does not prove Redis or the worker are healthy. Check worker logs separately.

## Rollback

Application rollback restores a previous code snapshot and rebuilds. Schema rollback is separate and may need a forward fix migration. Do not assume `db:push` can undo production data changes.

Use the host rollback helper when available. Schema rollback is not automatic.

## What must never ship in a deploy package

- `.env.production` and real secrets
- Database dumps
- `node_modules`
- Logs and tarballs

## After deploy smoke

- Login sets a real session cookie on the same origin
- `GET /api/auth/session` is not a mock fallback user
- Org create works
- Upload works if S3 is configured
- Test mail works if SMTP is configured
- Convention hub WebSocket subscribe works when you use that surface
