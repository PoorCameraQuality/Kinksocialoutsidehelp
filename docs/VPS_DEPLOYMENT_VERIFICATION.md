# VPS deployment verification

This document records what was checked for the engineering snapshot and what a reviewer should still confirm on a real VPS.

## Intended production path

1. Build and run with Docker Compose:
   - `docker-compose.prod.yml`
   - `docker-compose.prod.vps.yml` overlay
2. Reverse proxy: root `Caddyfile`
3. Images: `docker/api.Dockerfile`, `docker/web.Dockerfile`
4. Migrations: `npm run db:migrate-prod` (or the VPS deploy helper that wraps it)
5. Worker: Compose `worker` service (API build + `start:worker`)
6. GitHub Deploy workflow (manual): CI gate, then tarball via `.deployignore` to the VPS `c2k-deploy` helper

Kubernetes is **not** included in this snapshot and is not the default path.

## Local verification results (Pass 2 snapshot)

| Check | Command | Result |
|-------|---------|--------|
| Install | `npm ci` | PASS |
| Typecheck | `npm run typecheck` | PASS |
| Build | `npm run build` | PASS |
| Unit tests | `npm run test` | PASS (803 tests) |
| Compose (dev) | `docker compose -f docker-compose.dev.yml config` | PASS |
| Compose (prod) | `docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml config` with placeholder `.env.production` from example + `POSTGRES_PASSWORD` / MinIO placeholders | PASS |
| API image | `docker build -f docker/api.Dockerfile .` | PASS |
| Web image | `docker build -f docker/web.Dockerfile .` | PASS |
| Lint | `npm run lint` | FAIL (pre-existing web lint issues; CI does not gate on lint) |
| E2E smoke | `npm run test:e2e:smoke` | Not run (needs local API/web + Docker infra) |

Notes:

- Prod Compose expects a host-local `.env.production` (gitignored). Use `.env.production.example` as the template.
- Generated `packages/web/storybook-static` was removed from the snapshot after copy; it is gitignored.

## Production secrets (never in git)

On the VPS only:

- `AUTH_SECRET`, `COOKIE_SECRET`
- Database credentials / `POSTGRES_PASSWORD`
- Redis URL if not Compose-internal
- S3 / MinIO keys
- SMTP credentials
- ECKE publish secrets (if bridge enabled)
- Stripe Connect keys (org onboarding)

Templates: `.env.example`, `.env.production.example`.

## Reviewer smoke on a staging host (recommended)

1. Copy env from production example; use unique DB and secrets.
2. `docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml up -d --build`
3. Run migrations.
4. Hit `/api/health/ready` and load the web shell.
5. Confirm mail goes to a safe sink (not real members) until SMTP is validated.
