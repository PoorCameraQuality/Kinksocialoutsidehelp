# Media and storage

## Upload path

1. Client uploads through API upload or domain media routes.
2. Server checks purpose, MIME, magic bytes, and size limits.
3. Object lands in quarantine-capable storage.
4. Scan pipeline runs (adapters may include malware scanning).
5. Publish-lane and attestation rules decide whether content can go live.
6. Viewer access requires rating/status checks and scope checks.

Size limits and rating enums live in `@c2k/shared` (`media-types.ts`).

## Attestations

Two shapes exist:

- Uploader UI checkboxes persisted on assets (`UPLOADER_ATTESTATION_FIELDS`)
- Compact publish-lane fields (`REQUIRED_ATTESTATION_FIELDS`)

Map with `mapUploaderAttestationToPublishLaneFields`. Do not treat the sets as identical.

## Visibility

Media visibility enums are persisted strings. Current gotcha:

- `FOLLOWERS` is an old label. Asset and item gates still require an accepted mutual connection.

Rating/status gate helper: `passesMediaRatingAndStatusGate`. Scope helpers decide whether the viewer is in the allowed audience.

## Storage

| Environment | Storage |
|-------------|---------|
| Local | MinIO via `docker-compose.dev.yml` |
| Production | External S3-compatible bucket (`S3_*` env). Compose does not ship MinIO. |

Optional imgproxy delivery is documented in `MEDIA_IMAGE_PROXY.md` and controlled by `IMGPROXY_*` env vars.

## Alpha kill switches

`alpha-upload-policy.ts` can disable some upload purposes through env flags. Read the file before changing flag names. Some purposes may share one flag.

## Safety rules

- Do not serve quarantine or rejected media as ordinary public content.
- Do not weaken validation to make a test pass.
- Explicit and suggestive ratings are off by default (`C2K_ALLOW_EXPLICIT_MEDIA`, `C2K_ALLOW_NUDITY`).
