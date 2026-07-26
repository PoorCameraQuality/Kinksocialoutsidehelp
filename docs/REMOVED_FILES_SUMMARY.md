# What this snapshot leaves out

This repository is a **review and contribution slice**, not a dump of the private development workspace.

## Included (essential)

| Area | Why |
|------|-----|
| `packages/web`, `packages/api`, `packages/shared` | The product |
| `docker-compose.dev.yml` + env examples | Run locally |
| `docker-compose.prod*.yml`, `Caddyfile`, `docker/` | Understand production shape |
| Minimal `scripts/` (`db:prepare`, migrate, wait-for-postgres) | Get a database up |
| Unit tests inside packages | Review behavior with code |
| Core engineer docs + ADRs + architecture series | Context for auth, privacy, media, events |
| `.github/workflows/ci.yml` | How checks run |

## Intentionally omitted

| Area | Why |
|------|-----|
| Playwright `e2e/` | Large UI automation suite; not required to review architecture or auth |
| Audit / verify / smoke / VPS patch scripts | Private ops and launch tooling |
| Optional Compose overlays (media, search, observability, staging) | Not the default path |
| Deploy workflow and SSH session tools | Private production operations |
| Agent / Cursor tooling, historical handoffs, audits | Noise for reviewers |
| Legacy trees (`src/`, `legacy/`, `vendor/`, `k8s/`) | Not the active app |

If you need something omitted here, ask the maintainers. Do not assume absence means the product lacks that coverage privately.
