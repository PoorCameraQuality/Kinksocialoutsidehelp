#!/usr/bin/env bash
set -euo pipefail
cd /opt/c2k
set -a && source .env.production && set +a
COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.vps.yml"
KEY="smoke/test-$(date +%s).txt"
$COMPOSE exec -T minio sh -c "
  mc alias set local http://127.0.0.1:9000 \"\$MINIO_ROOT_USER\" \"\$MINIO_ROOT_PASSWORD\" &&
  echo 'c2k-upload-smoke' | mc pipe local/${S3_BUCKET}/$KEY
"
URL="${S3_PUBLIC_BASE_URL}/${KEY}"
echo "uploaded: $URL"
CODE=$(curl -sS -o /tmp/s3smoke.out -w '%{http_code}' "$URL")
echo "http_status: $CODE"
cat /tmp/s3smoke.out
test "$CODE" = "200"
