# Known limitations

Current product and engineering limits that outside engineers should know.

## Product stage

- Public controlled alpha, not a finished launch.
- Demo seed content exists for local and alpha testing.
- Organizer Event Systems are higher priority than Following-feed social expansion.

## Auth and identity

- Some route modules still define local `requireUser` wrappers. High-risk paths were moved toward `requireAuthenticatedDbUser`. Remaining copies migrate file by file.
- Fallback/demo sessions can use non-UUID `sub` values in local modes. Never store those as foreign keys.

## Privacy vocabulary

- `friends`, `connections`, and `followers` are not one graph.
- Media `FOLLOWERS` currently means accepted connections in asset/item gates.
- Feed `connections_only` is surface-specific (following feed audience vs discovery mutual connections).

## Large modules

These are real and active, but hard to navigate:

- `packages/api/src/routes/ecosystem-stubs.ts` (legacy name, real routes)
- Large convention and organization route modules
- Large ECKE publish service and route files
- Large web convention/event pages

Prefer extending helpers over growing unrelated logic in those files.

## Deployment

- Documented production path is VPS Compose + Caddy.
- This snapshot omits Kubernetes manifests, pnpm lockfiles, and the private deploy workflow. Use npm + Compose as documented here.

## ECKE

- Outbound only. Entity coverage and transports vary by kind.
- Some docs in the private archive describe older rollout phases. Trust code plus [ECKE_INTEGRATION.md](./ECKE_INTEGRATION.md).

## Media

- Explicit and suggestive uploads are feature-flagged off by default.
- Scanner adapters and alpha kill switches differ between local and strict runtimes.

## Payments

- Org tickets and vendor sales use Stripe Connect per connected account.
- Guest checkout and platform merchant-of-record for those sales are out of scope.

## Documentation archive

The private development repository still contains planning logs, handoffs, UI sprint packets, and audit screenshot trees. They are not required to run the app. The engineer-facing canonical docs are listed in [README.md](./README.md).
