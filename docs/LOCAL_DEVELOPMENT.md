# Local development

How I run this on my machine. If something here is wrong, the compose file and `.env.development` win.

## What you need

- Node 20
- npm
- Docker + Docker Compose

## Start the containers

```bash
docker compose -f docker-compose.dev.yml up -d
```

Usual local services:

| Service | Where |
|---------|-------|
| Postgres | `127.0.0.1:6432` (see compose / `.env.development`) |
| Redis | From `REDIS_URL` in `.env.development` |
| MinIO | Local S3 |
| Mailpit | Caught mail UI, usually `http://127.0.0.1:8025` |

## Install + DB

```bash
npm install
npm run db:prepare
```

`db:prepare` waits for Postgres, pushes schema, runs incremental migrations, seeds, and a preview attendee parity step. It refuses to run against production-looking env.

Optional places seed:

```bash
npm run db:seed:locations -w @c2k/api
```

## Env files

`.env.development` has the local defaults. Don't commit real prod secrets.

Mail locally:

```bash
C2K_MAIL_TRANSPORT=smtp
# SMTP points at Mailpit — see .env.development
```

`.env.example` is a short template. Day to day I just use `.env.development`.

## Run it

```bash
npm run dev
```

| URL | What |
|-----|------|
| http://localhost:5173 | Site |
| http://localhost:3001/api/health/ready | API ready |
| http://127.0.0.1:8025 | Mailpit |

After seed: `RopeDreamer` / `demo` (or `DEMO_LOGIN_PASSWORD` if you set one).

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
