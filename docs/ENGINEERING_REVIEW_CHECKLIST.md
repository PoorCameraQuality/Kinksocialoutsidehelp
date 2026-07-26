# Engineering review checklist

Use this when reviewing the Kink.social snapshot in this repository.

## Orientation

1. Read root `README.md`
2. Read `docs/ARCHITECTURE.md` and `docs/LOCAL_DEVELOPMENT.md`
3. Skim `docs/DOMAIN_GLOSSARY.md` and `docs/FEATURE_REGISTRY.md`
4. Note limits in `docs/KNOWN_LIMITATIONS.md`

## Safety and privacy

- [ ] Auth session model and `AUTH_SECRET` handling
- [ ] Authorization on org / group / convention / media routes
- [ ] Privacy gates for profiles, media, and feed visibility
- [ ] Moderation report intake and human decision path
- [ ] Upload validation, virus/scan pipeline, and delivery rules
- [ ] No guest checkout; org payments via Stripe Connect only (ADR 006)

## Product surfaces (alpha priority)

- [ ] Org and event workflows
- [ ] Convention door / attendance tooling (mobile-usable)
- [ ] Messaging and notifications basics
- [ ] ECKE outbound publish safety (no inbound federation)

## Ops

- [ ] Local Docker + Mailpit path works from docs
- [ ] Prod Compose + Caddy path matches `docs/DEPLOYMENT.md`
- [ ] Env vars match `docs/ENVIRONMENT_VARIABLES.md`
- [ ] Migrations are forward-only with rollback notes in `docs/DATABASE.md`

## What this repo is not

- Not a dump of private planning handoffs or audit screenshots
- Not an agent/Cursor rules bundle
- Not a Kubernetes-first deploy kit

See `docs/REMOVED_FILES_SUMMARY.md` if something expected is missing.
