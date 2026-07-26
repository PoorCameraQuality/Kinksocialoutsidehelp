#!/usr/bin/env bash
# Delete MinIO media/ objects for rows already remediated in DB (public_storage_key cleared).
set -euo pipefail
cd /opt/c2k
COMPOSE="docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml --env-file .env.production"
set -a
source .env.production
set +a
BUCKET="${S3_BUCKET:-c2k-uploads}"
TMP="/tmp/c2k-remediated-media-keys.txt"

$COMPOSE exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -t -A -F '|' -c \
  "SELECT id, uploader_user_id, COALESCE(original_filename, id::text || '.png') FROM media_assets WHERE storage_state = 'VALIDATED_PRIVATE' AND public_storage_key IS NULL AND source_surface = 'profile_gallery' AND storage_key LIKE 'quarantine/%';" \
  > "$TMP"

count=0
removed=0
while IFS='|' read -r asset_id user_id filename; do
  asset_id="$(echo "$asset_id" | tr -d '[:space:]')"
  user_id="$(echo "$user_id" | tr -d '[:space:]')"
  [ -z "$asset_id" ] || [ -z "$user_id" ] && continue
  count=$((count + 1))
  ext="${filename##*.}"
  key="media/${user_id}/${asset_id}.${ext}"
  if $COMPOSE exec -T minio mc rm --force "local/${BUCKET}/${key}" 2>/dev/null; then
    removed=$((removed + 1))
    echo "removed ${key}"
  fi
done < "$TMP"

echo "==> candidates=${count} removed=${removed}"
echo "==> Spot-check tarkiz sample"
curl -s -o /dev/null -w 'tarkiz_public=%{http_code}\n' \
  'https://kink.social/media/f222c094-6887-4354-a42a-6b7edf0ec41b/1a4eb002-674f-43c7-bff4-199e94aa4d1a.png'
echo "PURGE_REMEDIATED_MINIO_DONE"
