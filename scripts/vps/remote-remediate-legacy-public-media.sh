#!/usr/bin/env bash
# Remove wrongly-promoted LOGGED_IN profile photo from public MinIO prefix (Pass 1 leak remediation).
# Non-destructive to DB except aligning one media_assets row to VALIDATED_PRIVATE.
set -euo pipefail
cd /opt/c2k
COMPOSE="docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml --env-file .env.production"

ASSET_ID="${1:-f3732a5d-a8f6-45ae-8bcd-c82101ecfedf}"
USER_ID="${2:-8242e4da-f348-4d10-bc78-aa6016d9ea1e}"
OBJECT="media/${USER_ID}/${ASSET_ID}.png"

set -a
source .env.production
set +a

echo "==> Remediate public MinIO object: ${OBJECT}"
$COMPOSE exec -T minio mc rm --force "local/${S3_BUCKET:-c2k-uploads}/${OBJECT}" 2>/dev/null || echo "mc_rm_skipped_or_missing"

echo "==> Align media_assets storage to VALIDATED_PRIVATE"
$COMPOSE exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c \
  "UPDATE media_assets SET storage_state = 'VALIDATED_PRIVATE', public_storage_key = NULL, storage_key = COALESCE(quarantine_storage_key, storage_key), updated_at = NOW() WHERE id = '${ASSET_ID}';"

echo "REMEDIATE_LEGACY_PUBLIC_MEDIA_DONE"
