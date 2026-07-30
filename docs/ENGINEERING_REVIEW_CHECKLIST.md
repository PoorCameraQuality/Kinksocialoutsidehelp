# Review checklist

Quick list if you're poking at auth / privacy / the app. Not a formal audit template.

## Start here

1. Root README
2. `docs/ARCHITECTURE.md` and `docs/LOCAL_DEVELOPMENT.md`
3. `docs/DOMAIN_GLOSSARY.md` (the relationship words are easy to get wrong)
4. `docs/KNOWN_LIMITATIONS.md`

## Safety / privacy

- [ ] Sessions and `AUTH_SECRET`
- [ ] Org / group / convention / media auth on the API
- [ ] Profile / media / feed privacy gates
- [ ] Report intake and human moderation decisions
- [ ] Upload validation and quarantine / scan rules
- [ ] No guest checkout; org money via Stripe Connect (ADR 006)

## Alpha product stuff

- [ ] Org and event flows
- [ ] Convention door / attendance on a phone
- [ ] Messaging / notifications basics
- [ ] ECKE outbound publish (no inbound federation)

## Ops

- [ ] Local Docker + Mailpit path works
- [ ] Prod Compose + Caddy notes match `docs/DEPLOYMENT.md`
- [ ] Env vars make sense vs `docs/ENVIRONMENT_VARIABLES.md`

## What this repo isn't

Not my whole private planning dump. Not Kubernetes-first. See `docs/REMOVED_FILES_SUMMARY.md` if something looks missing.
