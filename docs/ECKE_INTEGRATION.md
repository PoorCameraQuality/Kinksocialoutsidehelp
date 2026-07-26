# ECKE integration

ECKE (East Coast Kink Events) is the public SEO and advertising surface. Kink.social is the member application.

## Ownership

| System | Owns |
|--------|------|
| Kink.social | Identity, sessions, private content, moderation, organizer tools, opt-in publish |
| ECKE | Public directory pages, SEO, public URLs |

Publishing is **outbound only** from Kink.social to ECKE. ECKE does not authenticate members or accept registrations for this product.

## Eligibility

Shared helper: `isEckePublishEligible` in `packages/shared/src/ecke-publish-safety.ts`.

Typical requirements:

- `publishToEcke` is true
- Public visibility
- Not UNLISTED directory visibility
- Approved moderation / published status when those fields are set

Fail closed when requirements are missing.

## Privacy rules

Before publish:

- Strip private kink.social app URLs from text and HTML
- Keep public CDN paths under `/c2k-uploads/` when allowed
- Drop private fields (member lists, private addresses, moderation notes, messages, and similar)
- Require server-side preview of the outbound payload
- Permission-check every write

Restricted field lists and entity rules are implemented in `packages/api/src/lib/ecke-redaction.ts` and related payload builders.

## Runtime pieces

| Piece | Location |
|-------|----------|
| Safety helpers | `packages/shared/src/ecke-publish-safety.ts` |
| Envelope types | `packages/shared/src/ecke-public-ingest-envelope.ts` |
| Publish service / routes | `packages/api/src/lib/ecke-publish-*.ts`, `ecke-publish-routes.ts` |
| Queue | `c2k-ecke-publish` via `ecke-publish-queue.ts` |
| Outbound auth | `ecke-ingest-auth.ts` (bearer and HMAC) |

HMAC signs the exact UTF-8 bytes of `${unixSeconds}.${body}` for the JSON body that will be posted.

## Failure behavior

Prefer BullMQ. If `C2K_ECKE_PUBLISH_INLINE=true`, or if enqueue fails, the job can run on the request path. That keeps publishes from being silently lost, but it moves side effects onto the API request. Keep Redis and workers healthy in production.

Local saves of source content should not require ECKE to be online when the product path queues publish for retry.

## Configuration

See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) for `ECKE_PUBLISH_*` and related flags. Do not point production publishing at preview hosts.

## Detailed contracts

Longer historical contracts remain in the private archive under names like `ECKE_PUBLIC_PUBLISHING_CONTRACT.md` and `ECKE_PUBLISH_PRIVACY_CONTRACT.md`. Prefer this page plus the code when they disagree.
