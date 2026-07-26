# Operations

## Day-to-day VPS

- Prefer changed-file updates under `scripts/vps/` when possible.
- Rebuild only the services you changed (web, api, worker).
- Keep `.env.production` only on the host.
- Watch API and worker logs after deploys.

## Health

| Check | Meaning |
|-------|---------|
| `GET /api/health/live` | Process is up |
| `GET /api/health/ready` | Ready for traffic. Includes DB when enabled |
| Web `/` | SPA is being served |

Worker health is not fully covered by API readiness. Confirm the worker container is running and consuming queues.

## Mail

Local: Mailpit.

Production: SMTP or Resend. Apply the same mail env on API and worker. Operator detail remains in `docs/ops/mail-production.md`.

## Optional observability

- Error tracking via `ERROR_TRACKING_*` / Sentry-compatible DSN (off by default)
- Uptime checks: `docs/ops/uptime-kuma-checks.md`
- Optional GlitchTip notes: `docs/ops/glitchtip-self-host.md`

## Backups

Expect Postgres backups and object-storage durability to be handled by your host or managed providers. Do not rely on git or deploy tarballs as backups.

## Cutover notes

Historical VPS cutover notes may exist in `SERVER_CUTOVER_LOG.md` in the private archive. Treat that file as a journal, not as the primary runbook. Current procedure lives in [DEPLOYMENT.md](./DEPLOYMENT.md).
