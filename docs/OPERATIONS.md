# Operations

## Day-to-day VPS

- Rebuild only the services you changed (web, api, worker).
- Keep `.env.production` only on the host.
- Watch API and worker logs after deploys.
- Prefer same-origin Caddy so session cookies stay simple.

## Health

| Check | Meaning |
|-------|---------|
| `GET /api/health/live` | Process is up |
| `GET /api/health/ready` | Ready for traffic. Includes DB when enabled |
| Web `/` | SPA is being served |

Worker health is not fully covered by API readiness. Confirm the worker container is running and consuming queues.

## Mail

Local: Mailpit (`docker-compose.dev.yml`, UI on port 8025).

Production: SMTP or Resend. Apply the same mail env on API and worker.

## Backups

Expect Postgres backups and object-storage durability to be handled by your host or managed providers. Do not rely on git or deploy tarballs as backups.

## More detail

See [DEPLOYMENT.md](./DEPLOYMENT.md) and [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md).
