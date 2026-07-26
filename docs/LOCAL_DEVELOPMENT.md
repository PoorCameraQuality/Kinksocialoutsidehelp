# Local development

## Requirements

- Node 20
- npm
- Docker and Docker Compose

## Start infrastructure

```bash
# Local development
docker compose -f docker-compose.dev.yml up -d
```

Typical local services:

| Service | Common local access |
|---------|---------------------|
| Postgres | `127.0.0.1:6432` (see compose and `.env.development`) |
| Redis | From `REDIS_URL` in `.env.development` |
| MinIO | S3-compatible local storage |
| Mailpit | SMTP capture, UI often on `http://127.0.0.1:8025` |

## Install and prepare the database

```bash
# Local development
npm install
npm run db:prepare
```

`db:prepare` waits for Postgres, runs Drizzle push, incremental migrations, seed, and preview attendee parity. It is blocked in production environments.

Optional location seed:

```bash
npm run db:seed:locations -w @c2k/api
```

## Environment files

Local defaults live in `.env.development`. Do not commit real production secrets.

Useful local mail setting:

```bash
# Local development
C2K_MAIL_TRANSPORT=smtp
# point SMTP at Mailpit (see .env.development)
```

Template fragments also appear in `.env.example`. Prefer `.env.development` for day-to-day local work.

## Run the app

```bash
# Local development
npm run dev
```

| URL | Purpose |
|-----|---------|
| http://localhost:5173 | Web (Vite) |
| http://localhost:3001/api/health/ready | API ready check |
| http://127.0.0.1:8025 | Mailpit |

Demo user after seed: `RopeDreamer` / password from `DEMO_LOGIN_PASSWORD` (default `demo`).

## Workers

Background jobs need Redis and the worker process.

```bash
# Local development - after building the API, or use the package's tsx/dev worker entry if present
npm run build -w @c2k/api
npm run start:worker -w @c2k/api
```

`start:worker` runs `node dist/worker.js`. Without a worker, the API can still serve many requests. Queue-backed mail, publish, and sweeps will not run unless a path falls back to inline execution.

## Tests

```bash
# Local development
npm run typecheck
npm run lint
npm run test
```

See [TESTING.md](./TESTING.md).

## Reset local data only

Destructive local reset paths exist for development. They are guarded against production.

Do not run production migrate, seed, or clear commands against a live database from your laptop unless you are following an explicit ops procedure.

Typical local rebuild:

```bash
# Local development - destructive for the local Docker database
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml up -d
npm run db:prepare
```

## Common setup failures

| Symptom | What to check |
|---------|----------------|
| API returns 503 on `/api/v1/*` | `USE_DATABASE=true` and Postgres is up |
| `db:prepare` hangs | Docker Postgres port and `DATABASE_URL` |
| Demo login fails | Seed ran and `DEMO_LOGIN_PASSWORD` matches |
| Mail never appears | Mailpit up and `C2K_MAIL_TRANSPORT=smtp` points at it |
| Uploads fail | MinIO/S3 env in `.env.development` |
| Node / tsx oddities | Use Node 20, not newer untested majors |

## What not to do

- Do not use production secrets in local files that might be committed.
- Do not run `db:seed` or clear scripts against production.
- Do not assume root `src/` or `legacy/` is the live UI.
