# Testing

Use Node 20.

## Unit and type checks

```bash
# Local development
npm run typecheck
npm run lint
npm run test
```

`npm run test` runs the API workspace unit suite (including many shared helper tests pulled in by that package script).

## Playwright

Install browser once:

```bash
# Local development
npm run test:e2e:install
```

Common commands:

| Command | What it runs |
|---------|----------------|
| `npm run test:e2e:smoke` | Desktop/mobile route smokes + auth |
| `npm run test:e2e:workflows` | Auth, org, event create, convention, door, permissions |
| `npm run test:e2e:trust-safety` | Moderation Playwright slice |
| `npm run test:e2e` | Full Playwright config |

Playwright starts `npm run dev` unless a server is already on `:5173` (non-CI) or you set `PLAYWRIGHT_SKIP_WEBSERVER=1`.

For DB-backed e2e:

```bash
# Local development
docker compose -f docker-compose.dev.yml up -d
npm run db:prepare
npm run test:e2e:smoke
```

### Useful e2e env

| Variable | Purpose |
|----------|---------|
| `E2E_DEMO_USER` | Default `RopeDreamer` |
| `E2E_DEMO_PASSWORD` | Must match API `DEMO_LOGIN_PASSWORD` |
| `MAILPIT_API` | Default `http://127.0.0.1:8025` |
| `CI=true` | Do not reuse an existing web server |
| `CI_REQUIRE_DB=true` | Ready smoke requires database ok |

Many specs skip when Postgres, seed data, or Mailpit are missing.

## Domain verification scripts

Root `package.json` also defines trust-safety, media, ECKE, and alpha gate scripts such as:

- `npm run verify:trust-safety`
- `npm run verify:ecke-photo-bridge-contract`
- `npm run verify:alpha`

Run the scripts that match the area you changed. Do not delete or weaken failing tests to force a green run.

## What good coverage looks like for a change

| Change type | Minimum |
|-------------|---------|
| Shared policy helper | Unit test in shared or API suite |
| API auth/privacy | Unit or DB test for allow and deny |
| Upload/media | Media validation/pipeline tests |
| ECKE publish | Existing ECKE contract/unit tests |
| UI route behavior | Playwright smoke or workflow for that path |
