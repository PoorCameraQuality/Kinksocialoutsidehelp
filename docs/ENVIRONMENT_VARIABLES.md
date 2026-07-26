# Environment variables

This is a practical reference for active services. Names come from `.env.production.example`, `.env.development`, and code usage. Never put real secrets in tracked files.

For each variable:

- **Local** means day-to-day Docker + `npm run dev`
- **Production** means VPS Compose

Examples use placeholders only.

## Core runtime

| Name | Service | Local | Production | Purpose | Notes |
|------|---------|-------|------------|---------|-------|
| `NODE_ENV` | api, worker | optional | required | Runtime mode | `production` on VPS |
| `USE_DATABASE` | api, worker | required true | required true | Enables DB-backed routes | Without it, most `/api/v1/*` return 503 |
| `DATABASE_URL` | api, worker, migrate | required | required | Postgres connection | Match compose service host locally |
| `DATABASE_SSL` | api, worker | optional | optional | Managed Postgres TLS | Set for RDS/Supabase/Neon style hosts |
| `REDIS_URL` | api, worker | required for queues | required | BullMQ / Redis | Jobs will not process without it |
| `HOST`, `PORT` | api | optional | compose sets | Listen address | Prod API typically `0.0.0.0:3001` |

## Auth and cookies

| Name | Service | Local | Production | Purpose | Notes |
|------|---------|-------|------------|---------|-------|
| `AUTH_SECRET` | api | required | required | Session HMAC | Never reuse a public placeholder in prod |
| `COOKIE_SECRET` | api | required | required | Cookie signing | Separate from `AUTH_SECRET` |
| `AUTH_ALLOW_FALLBACK` | api | often true in dev | must be false | Demo/fallback session | API refuses prod startup if true |
| `CORS_ORIGIN` | api | optional | required when split | Allowed web origins | Same-origin Caddy: site URL |
| `COOKIE_SECURE` | api | optional | usually true via prod | Secure cookies | Defaults secure in production |
| `COOKIE_DOMAIN` | api | optional | optional | Shared subdomain cookies | Only if you intentionally share |

## Public URLs

| Name | Service | Local | Production | Purpose | Notes |
|------|---------|-------|------------|---------|-------|
| `C2K_PUBLIC_WEB_URL` | api, worker | recommended | required | Canonical web origin | No trailing slash |
| `API_PUBLIC_URL` | api | optional | required for some split setups | Public API base | Same origin often matches web |
| `DOMAIN` | Caddy | n/a | required | TLS hostname | Prod compose |
| `VITE_SITE_URL` | web build | optional | recommended | SEO and share links | Build-time |
| `VITE_API_URL` | web build | optional | usually empty | API base for SPA | Empty = same-origin `/api` |
| `VITE_PUBLIC_LAUNCH` / `C2K_PUBLIC_LAUNCH` | web / edge | optional | optional | Public indexing allowlist | Brand/legal paths only on kink.social |

## Object storage

| Name | Service | Local | Production | Purpose | Notes |
|------|---------|-------|------------|---------|-------|
| `S3_ENDPOINT` | api | MinIO endpoint | required for uploads | S3 API endpoint | Prod has no MinIO in compose |
| `S3_BUCKET` | api | required for uploads | required for uploads | Bucket name | |
| `S3_REGION` | api | optional | optional | Region | Default often `us-east-1` |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | api | required for uploads | required for uploads | Credentials | Never commit real values |
| `S3_PUBLIC_BASE_URL` | api | optional | optional | Public CDN base | No trailing slash |

## Mail

| Name | Service | Local | Production | Purpose | Notes |
|------|---------|-------|------------|---------|-------|
| `C2K_MAIL_TRANSPORT` | api, worker | `smtp` to Mailpit | `smtp` or `resend` | Transport | `disabled` sends nothing |
| `C2K_MAIL_FROM` | api, worker | recommended | required for pilot | From header | Use a real domain in prod |
| `C2K_MAIL_REPLY_TO` | api, worker | optional | recommended | Reply-To | |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | api, worker | Mailpit host | required for SMTP | SMTP settings | |
| `SMTP_SECURE` | api, worker | usually false local | as needed | TLS mode | |
| `RESEND_API_KEY` | api, worker | optional | if using Resend | Resend auth | |
| `C2K_PASSWORD_RESET_ENABLED` | api | optional | usually true | Password reset mail | |

## Platform staff bootstrap

| Name | Service | Purpose | Notes |
|------|---------|---------|-------|
| `C2K_SITE_OWNER_USER_IDS` | api | Owner UUID allowlist | Env bootstrap, not full staff DB |
| `C2K_SITE_ADMIN_USER_IDS` | api | Site admin UUIDs | |
| `C2K_PLATFORM_MODERATOR_USER_IDS` | api | Moderator UUIDs | Privacy bypasses should use DB+env staff helpers |

## Registration

| Name | Service | Purpose | Notes |
|------|---------|---------|-------|
| `C2K_REGISTRATION_OPEN` | api | Open/closed registration | |
| `C2K_REGISTRATION_INVITE_CODE` | api | Invite gate | Optional |

## Media and scanners

| Name | Service | Purpose | Notes |
|------|---------|---------|-------|
| `MEDIA_SCANNER_*` | api, worker | Scanner mode and adapters | Strict runtime ignores weakening overrides |
| `CLAMD_HOST` / `CLAMD_PORT` | api, worker | ClamAV | Optional depending on adapters |
| `C2K_ALPHA_DISABLE_*` | api | Alpha upload kill switches | See `alpha-upload-policy.ts` |
| `C2K_ALLOW_EXPLICIT_MEDIA` / `ALLOW_EXPLICIT_MEDIA` | api | Explicit rating gate | Default off |
| `C2K_ALLOW_NUDITY` / `ALLOW_NUDITY` | api | adultNonExplicit / edgeReview gate | Default off |
| `IMGPROXY_*` | api | Optional image proxy | Disabled unless configured |

## Search (optional)

| Name | Service | Purpose | Notes |
|------|---------|---------|-------|
| `SEARCH_PROVIDER` | api | `database` or Typesense | Default database |
| `SEARCH_HOST` / `SEARCH_*_API_KEY` | api, worker | Typesense | |
| `SEARCH_INDEXING_ENABLED` / `SEARCH_QUERY_ENABLED` | api | Feature flags | Default off |

## ECKE publish (optional until bridge configured)

| Name | Service | Purpose | Notes |
|------|---------|---------|-------|
| `ECKE_PUBLISH_ENABLED` | api, worker | Master switch | |
| `ECKE_PUBLISH_ENDPOINT` / `ECKE_UNPUBLISH_ENDPOINT` | api, worker | Ingest URLs | Production ECKE only |
| `ECKE_PUBLISH_SECRET` | api, worker | Bearer secret | |
| `ECKE_PUBLISH_HMAC_SECRET` | api, worker | HMAC signing | Exact `${timestamp}.${body}` |
| `ECKE_PUBLIC_BASE_URL` | api, worker | Public ECKE origin | |
| `C2K_ECKE_PUBLISH_INLINE` | api | Run publish inline | Local/dev or enqueue fallback |
| `ECKE_SUPABASE_*` | api, worker | Legacy REST path | Still used for some entities |
| `ECKE_*_INGEST_ENABLED` | api, worker | Per-entity cutover flags | |

## Stripe Connect (optional)

| Name | Service | Purpose | Notes |
|------|---------|---------|-------|
| `STRIPE_SECRET_KEY` | api | Server Stripe key | Per-org Connect. Never commit |
| `STRIPE_PUBLISHABLE_KEY` / `VITE_STRIPE_PUBLISHABLE_KEY` | api / web | Publishable key | |
| `STRIPE_WEBHOOK_SECRET` | api | Webhook verify | |

## Observability (optional)

| Name | Service | Purpose | Notes |
|------|---------|---------|-------|
| `ERROR_TRACKING_ENABLED` / `ERROR_TRACKING_DSN` | api, worker, web | Error tracking | Off by default |
| `WORKER_HEARTBEAT_ENABLED` | worker | Heartbeat | Optional |
| `HEALTH_STRICT_READINESS` | api | Stricter ready checks | Optional |

## Local demo helpers

| Name | Service | Purpose | Notes |
|------|---------|---------|-------|
| `DEMO_LOGIN_PASSWORD` | api | Seed demo password | Local/alpha only |
| `E2E_DEMO_PASSWORD` | Playwright | E2E login | Must match demo password |

When you add an env var in code, add it here and to the appropriate `.env*.example` file.
