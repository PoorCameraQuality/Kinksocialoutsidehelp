# Repository extraction inventory (Pass 2)

Source: private development repo on this workstation.  
Target sibling: `../kink-social-engineering`  
Goal: engineer-review snapshot that builds, tests, and documents the current VPS Compose path.  
Package manager decision: **npm only** (`package-lock.json`). Exclude `pnpm-lock.yaml` / `pnpm-workspace.yaml`.

Do not delete or rewrite the source tree for this export. Copy only.

## Top-level keep / exclude

| Path | Action | Why |
|------|--------|-----|
| `packages/api` | KEEP | Active API |
| `packages/web` | KEEP | Active web app (exclude `storybook-static`, `dist`, `node_modules`) |
| `packages/shared` | KEEP | Shared types and policy |
| `packages/drizzle-verbose.txt` | EXCLUDE | Local log artifact |
| `package.json` | KEEP | Workspace root |
| `package-lock.json` | KEEP | npm lockfile used by Docker and CI |
| `pnpm-lock.yaml` | EXCLUDE | Dual lockfile; CI/Docker use npm |
| `pnpm-workspace.yaml` | EXCLUDE | Unused by npm workspaces |
| `tsconfig.json` | KEEP | Root TS config |
| `.eslintrc.json` | KEEP | Lint config |
| `.gitignore` | KEEP | Ignore rules |
| `.dockerignore` | KEEP | Image build exclusions |
| `.deployignore` | KEEP | Deploy tarball exclusions |
| `.env.example` | KEEP | Placeholder template only |
| `.env.development` | KEEP | Local Docker placeholder values (not production secrets) |
| `.env.production.example` | KEEP | Prod template placeholders |
| `.env.local` | EXCLUDE | Local secrets file (gitignored) |
| `.github/` | KEEP | `ci.yml` + `deploy.yml` (npm) |
| `docker/` | KEEP | `api.Dockerfile`, `web.Dockerfile`, `nginx-spa.conf` |
| `docker-compose.dev.yml` | KEEP | Local infra |
| `docker-compose.prod.yml` | KEEP | Production Compose base |
| `docker-compose.prod.vps.yml` | KEEP | VPS overlay |
| `docker-compose.media.yml` | KEEP | Optional local imgproxy |
| `docker-compose.search.yml` | KEEP | Optional Typesense |
| `docker-compose.observability.yml` | KEEP | Optional observability |
| `docker-compose.staging.yml` | KEEP | Optional staging stack |
| `Caddyfile` | KEEP | Prod reverse proxy |
| `Caddyfile.staging` | KEEP | Staging proxy (paired with staging compose) |
| `e2e/` | KEEP | Playwright specs |
| `playwright.config.ts` | KEEP | E2E config |
| `scripts/` (non-`_*`) | KEEP | npm script entrypoints + ops helpers |
| `scripts/_*.mjs` / `_*.sh` | EXCLUDE | One-off VPS/session deploy and debug tools |
| `scripts/vps/` (non-`_*`) | KEEP | Documented VPS patch/smoke helpers |
| `scripts/vps/_*.mjs` | EXCLUDE | Ad-hoc VPS session scripts |
| `scripts/lib/` | KEEP | Shared script helpers (`deploy-tar-excludes.mjs`) |
| `scripts/mail/` | KEEP | Mailbox helper |
| `scripts/audit/` | KEEP | UI audit helpers referenced by npm scripts |
| `start-dev.bat` / `start-dev.ps1` | KEEP | Local convenience |
| `README.md` | KEEP | Canonical entry |
| `CONTRIBUTING.md` | KEEP | Contribution guide |
| `SECURITY.md` | KEEP | Security reporting |
| `docs/` (canonical subset) | KEEP | See docs section below |
| `k8s/` | EXCLUDE | Not the active VPS path; no script/`kubectl` use |
| `legacy/` | EXCLUDE | Old tree; not imported by packages |
| `vendor/` | EXCLUDE | Vendored third-party not used by Docker/CI path |
| `src/` (repo root) | EXCLUDE | Pre-monorepo Next-style tree; app lives in `packages/web` |
| `tailwind.config.js` (root) | EXCLUDE | Deprecated; active config is `packages/web/tailwind.config.js` |
| `postcss.config.js` (root) | EXCLUDE | Not used by Vite web package |
| `next-env.d.ts` | EXCLUDE | Legacy Next remnant |
| `AGENTS.md` | EXCLUDE | Agent workflow; not engineer product docs |
| `.cursor/` | EXCLUDE | Editor/agent rules |
| `.agents/` | EXCLUDE | Agent skills |
| `skills-lock.json` | EXCLUDE | Agent skills lock |
| `node_modules/` | EXCLUDE | Reinstall with `npm ci` |
| `**/dist/` | EXCLUDE | Rebuild |
| `test-results/`, `playwright-report/`, `coverage/` | EXCLUDE | Generated |
| `audit-output/`, `visual-audit-output/`, `.qa-audit-assets/` | EXCLUDE | Generated audits |
| `*.log`, `*-out.txt`, `tsc-*.txt`, `vite-build.txt` | EXCLUDE | Local logs |
| `*.tgz`, `*.tar.gz`, `_deploy-*` | EXCLUDE | Deploy bundles |
| `*.plan.md`, `tmp-*`, `visual-audit-routes.json` | EXCLUDE | Planning / temp |
| `.git/` | EXCLUDE | Fresh git only after verification |
| `.playwright-staging-run*.log` | EXCLUDE | Local run logs |

## Docs subset (KEEP)

Copy only:

| Path |
|------|
| `docs/README.md` |
| `docs/ARCHITECTURE.md` |
| `docs/LOCAL_DEVELOPMENT.md` |
| `docs/DEPLOYMENT.md` |
| `docs/ENVIRONMENT_VARIABLES.md` |
| `docs/TESTING.md` |
| `docs/DATABASE.md` |
| `docs/DOMAIN_GLOSSARY.md` |
| `docs/PRIVACY_AND_VISIBILITY.md` |
| `docs/MODERATION_AND_REPORTING.md` |
| `docs/MEDIA_AND_STORAGE.md` |
| `docs/ECKE_INTEGRATION.md` |
| `docs/OPERATIONS.md` |
| `docs/TROUBLESHOOTING.md` |
| `docs/KNOWN_LIMITATIONS.md` |
| `docs/DOCUMENTATION_CLEANUP_INVENTORY.md` |
| `docs/REPOSITORY_EXTRACTION_INVENTORY.md` |
| `docs/ENGINEERING_ONBOARDING.md` |
| `docs/FEATURE_REGISTRY.md` |
| `docs/adr/**` |
| `docs/architecture/**` |

Everything else under `docs/` (handoffs, audits, launch plans, UI sprints, strategic agent notes, etc.) stays in the private archive only.

After extraction, write into the sibling:

| Path |
|------|
| `docs/REMOVED_FILES_SUMMARY.md` |
| `docs/VPS_DEPLOYMENT_VERIFICATION.md` |
| `docs/ENGINEERING_REVIEW_CHECKLIST.md` |

## Docker / CI / import checks

| Check | Result |
|-------|--------|
| `docker/api.Dockerfile` COPY | `package.json`, `package-lock.json`, `packages/shared`, `packages/api`, `packages/web/public/seed` |
| `docker/web.Dockerfile` COPY | `package.json`, `package-lock.json`, `packages/shared`, `packages/web`, `docker/nginx-spa.conf` |
| Compose prod | Uses `Caddyfile`, `docker/*`, workspace packages |
| CI | `npm ci` only; Node 20 |
| Deploy workflow | `tar` with `.deployignore`; no k8s |
| Package imports of `legacy/`, `vendor/`, root `src/` | None found as module paths |
| npm scripts → `_*.mjs` | Not referenced from `package.json` |
| Secrets in export | No `.env.local`; examples only |

## Decisions recorded

1. **Deploy path:** VPS Docker Compose (+ Caddy). `k8s/` excluded as non-default / unused by scripts.
2. **Package manager:** npm. pnpm lockfiles excluded.
3. **Scripts:** Keep npm-facing and `scripts/vps` helpers; drop `_`-prefixed session tools.
4. **Docs:** Canonical engineer set + ADR + architecture series only.
5. **Stop if:** clean install fails, Docker image build fails, or secrets appear in the copy.

## Extraction procedure

1. Create empty sibling `../kink-social-engineering`.
2. Copy KEEP paths (robocopy / Copy-Item with exclusions).
3. Add REMOVED / VPS verification / review checklist docs.
4. From sibling: `npm ci`, `typecheck`, `build`, `test`, compose config validate, Docker build dry-run.
5. Only if green: `git init -b main` and one commit `Initial engineering review snapshot`.
6. Push to `outsidehelp` only when explicitly requested.
