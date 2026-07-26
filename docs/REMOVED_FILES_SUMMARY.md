# Removed files summary

This tree is a cleaned engineer-review snapshot of Kink.social. The private development repository remains intact. Nothing was deleted from the source tree for this export.

## Intentionally omitted

| Category | Examples | Reason |
|----------|----------|--------|
| Agent / editor tooling | `.cursor/`, `.agents/`, `AGENTS.md`, `skills-lock.json` | Not product or deploy surface |
| Legacy app trees | root `src/`, `legacy/`, `vendor/` | Active app is `packages/*` |
| Dual package manager | `pnpm-lock.yaml`, `pnpm-workspace.yaml` | CI and Docker use npm |
| Kubernetes manifests | `k8s/` | VPS Docker Compose is the documented deploy path |
| Session deploy scripts | `scripts/_*.mjs`, `scripts/vps/_*.mjs` | One-off VPS/debug tools with SSH password usage |
| Historical docs | handoffs, audits, launch plans, UI sprint packets | Private archive material |
| Deprecated root CSS tooling | root `tailwind.config.js`, `postcss.config.js`, `next-env.d.ts` | Vite app configs live under `packages/web` |
| Secrets | `.env.local`, real `.env` / `.env.production` | Never ship workstation secrets |
| Generated artifacts | `node_modules/`, `dist/`, logs, tarballs, Playwright reports, audit outputs | Rebuild locally |
| Planning scratch | `*.plan.md`, `tmp-*`, visual-audit route dumps | Not required to build or deploy |

## Kept for review

- Active monorepo packages (`api`, `web`, `shared`)
- Docker Compose (dev + prod + optional overlays) and Dockerfiles
- Caddy configs
- npm lockfile and GitHub Actions (CI + deploy)
- Playwright e2e suite
- npm-facing scripts and non-underscore `scripts/vps` helpers
- Canonical engineer docs, ADRs, and architecture series

## How to restore omitted material

Use the private development repository. See `docs/REPOSITORY_EXTRACTION_INVENTORY.md` for the full keep/exclude table.
