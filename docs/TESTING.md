# Testing

I use Node 20.

## What you can run here

```bash
npm run typecheck
npm run lint
npm run build
npm run test
```

`npm run test` hits the API test runner. That pulls in a bunch of shared helpers and some web unit tests too. Tests live next to the code.

## What's not here

I didn't put Playwright e2e or the long smoke/audit scripts in this repo. You don't need them to read auth and privacy.

## Optional DB tests

Needs Docker Postgres + Redis:

```bash
docker compose -f docker-compose.dev.yml up -d
npm run db:prepare
npm run test:db -w @c2k/api
```

CI runs those too.
