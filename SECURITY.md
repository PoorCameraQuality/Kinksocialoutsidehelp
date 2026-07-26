# Security

## Reporting a vulnerability

If you find a security issue in Kink.social, report it privately.

Do not file a public GitHub issue for exploitable bugs, credential leaks, or privacy bypasses.

Include:

- What you found
- Steps to reproduce
- Impact (who could be affected)
- Whether you have a suggested fix

Use the contact path published for the project (security contact on the live site policy pages, or the repository owner's private channel). If a `security.txt` contact is published on kink.social, prefer that.

## Security expectations for contributors

- Never commit real secrets, production `.env` files, private keys, or database dumps.
- Never disable auth, privacy, upload validation, rate limiting, or moderation checks only to pass a test.
- Production must keep `AUTH_ALLOW_FALLBACK=false`. The API refuses to start in production when fallback auth is enabled.
- Platform staff bootstrap env lists are not a substitute for full DB staff checks on privacy bypass paths.
- Media quarantine and scan status must be respected on serve paths.
- Report and moderation P0 reasons need fast human attention. Do not treat them as local-only dismissals.

## Sensitive areas

Engineers reviewing changes should pay extra attention to:

| Area | Why |
|------|-----|
| Session and auth | Cookie signing, UUID user ids, fallback sessions |
| Authorization | Org, group, convention, event, and media scope gates |
| Privacy | Profile fields, DMs, connections lists, feed activity |
| Uploads | Magic-byte checks, size limits, quarantine, scanners |
| Moderation | Report intake, hide/delete/suspend execution |
| ECKE publish | Outbound-only, redaction, private URL stripping |
| WebSockets | Subscribe auth must match REST visibility |
| Legal / admin step-up | Privileged staff password step-up before sensitive actions |

## Supported versions

Security fixes target the current mainline application in `packages/web`, `packages/api`, and `packages/shared`. Historical trees under `legacy/`, root `src/`, and `vendor/` are not supported as deployable apps.
