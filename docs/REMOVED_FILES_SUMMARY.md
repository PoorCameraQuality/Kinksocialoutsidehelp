# What this snapshot leaves out

This repository is a **review and contribution slice**, not a dump of the private development workspace.

## Included (essential)

| Area | Why |
|------|-----|
| `packages/web`, `packages/api`, `packages/shared` | The product |
| `docker-compose.dev.yml` + env examples | Run locally |
| `docker-compose.prod*.yml`, `Caddyfile`, `docker/` | Understand production shape |
| Minimal root `scripts/` (`db:prepare`, migrate, wait-for-postgres) | Get a database up |
| Unit tests inside packages | Review behavior with code |
| Core engineer docs + ADRs + architecture series | Context for auth, privacy, media, events |
| `.github/workflows/ci.yml` | How checks run |

## Intentionally omitted

| Area | Why |
|------|-----|
| Playwright `e2e/` | UI automation suite; not required to review architecture or auth |
| Demo seed image trees (`public/seed/*`) | ~20 MB of local alpha imagery; app and unit tests do not need them |
| Storybook | Component workshop; not the review path |
| Audit / verify / smoke / VPS patch scripts | Private ops and launch tooling |
| Optional Compose overlays and deploy workflow | Not the default review path |
| Agent / Cursor tooling, historical handoffs | Noise for reviewers |
| Legacy trees (`src/`, `legacy/`, `vendor/`, `k8s/`) | Not the active app |

Local demo seed may show broken image URLs for some catalog items. That does not affect auth, privacy, or API review.

If you need something omitted here, ask the maintainers.
