# Testing

Use Node 20.

## What this review snapshot includes

- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Production build: `npm run build`
- API unit tests (auth, privacy, media helpers, and related): `npm run test`

Unit tests live next to the code under `packages/api` and `packages/shared`. That is the supported verification path here.

## What is not in this snapshot

Playwright end-to-end suites, visual audits, and long trust-safety smoke scripts live in the private development workspace. You do not need them to read auth, privacy, or API design.

## Optional DB-backed API tests

With local Postgres and Redis from `docker-compose.dev.yml`:

```bash
docker compose -f docker-compose.dev.yml up -d
npm run db:prepare
npm run test:db -w @c2k/api
```

CI also runs those DB integration tests against service containers.
