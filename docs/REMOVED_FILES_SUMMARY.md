# What's missing from this repo

I trimmed this tree on purpose so people could review the product without wading through my private workspace.

## In here

| Thing | Why |
|-------|-----|
| `packages/web`, `packages/api`, `packages/shared` | The actual app |
| Dev / prod Compose + Caddy + Dockerfiles | How it runs |
| Env examples | So you can boot it |
| Small `scripts/` for db prepare / migrate | Local setup |
| Unit tests next to the code | Check behavior |
| Docs + ADRs | Context |
| `.github/workflows/ci.yml` | Basic checks |

## Left out

| Thing | Why |
|-------|-----|
| Playwright e2e | Huge; not needed to read auth/privacy |
| Demo seed image folders | Fat; app still runs without them |
| Storybook | Not the review path |
| Audit / smoke / VPS patch scripts | My ops junk |
| Optional compose overlays / private deploy workflow | Not the default path |
| Cursor / agent tooling, old handoffs | Noise |
| Underscore session scripts (`scripts/_*.mjs`) | One-off VPS/deploy/probe tools; not the product |
| ISO card review PNGs / `packages/api/tmp` | Local render previews only |
| Old trees (`src/`, `legacy/`, `vendor/`, `k8s/`) | Not the live app |

Local demo may show broken image URLs for some seed content. That's fine for reviewing code.

If you need something that isn't here, ask. Missing from this repo does not mean missing from the private project.
