# Troubleshooting

## Local

| Problem | Likely cause | What to try |
|---------|--------------|-------------|
| `/api/v1/*` returns 503 | DB mode off or Postgres down | Set `USE_DATABASE=true`, start `docker-compose.dev.yml` |
| `db:prepare` fails | Postgres not ready or wrong URL | Check compose port and `DATABASE_URL` |
| Demo login fails | Seed missing or password mismatch | Re-run `db:prepare`, check `DEMO_LOGIN_PASSWORD` |
| No mail in local tests | Mailpit down or wrong SMTP | Start compose, open Mailpit UI, check mail env |
| Upload errors | MinIO/S3 env missing | Check S3 settings in `.env.development` / `.env.development.example` |
| Unit tests odd on Node 24 | Unsupported Node for current toolchain | Use Node 20 |

## Production

| Problem | Likely cause | What to try |
|---------|--------------|-------------|
| API will not start | `AUTH_ALLOW_FALLBACK=true` | Set it false |
| Ready check fails | Database URL or network | Check `DATABASE_URL`, Postgres health |
| Sessions missing | Split origin / cookie settings | Prefer same-origin Caddy, review `CORS_ORIGIN` and cookie flags |
| Uploads fail | Missing external S3 | Configure `S3_*` |
| Jobs stuck | Worker or Redis down | Check worker container and `REDIS_URL` |
| ECKE publish stale | Bridge misconfigured or worker down | Check `ECKE_PUBLISH_*`, worker logs, queue |

## Privacy and auth bugs

If a user can see content they should not:

1. Reproduce with a non-staff account.
2. Check the API path, not only the UI.
3. Confirm both rating/status and scope gates for media.
4. Confirm WebSocket subscribe auth if the leak is realtime.
5. Confirm staff bypasses use DB-aware moderator helpers when intended.

## Getting more detail

- [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)
- [TESTING.md](./TESTING.md)
