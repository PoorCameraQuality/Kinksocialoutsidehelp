#!/usr/bin/env bash
set -euo pipefail
cd /opt/c2k
set -a && source .env.production && set +a
COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.vps.yml"
BUCKET="${S3_BUCKET:-c2k-uploads}"
# Public read only for approved media/ prefix — never quarantine/.
$COMPOSE run --rm minio-init /bin/sh -c "
  mc alias set local http://minio:9000 \"\$MINIO_ROOT_USER\" \"\$MINIO_ROOT_PASSWORD\" &&
  mc mb --ignore-existing local/${BUCKET} &&
  mc anonymous set download local/${BUCKET}/media
"
echo "MinIO bucket ${BUCKET}/media set to public download"
