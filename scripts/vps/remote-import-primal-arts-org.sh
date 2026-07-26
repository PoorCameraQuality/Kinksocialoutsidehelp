#!/usr/bin/env bash
set -euo pipefail
cd /opt/c2k
set -a
source .env.production
set +a
export NODE_ENV=production
export USE_DATABASE=true
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}"
export EASTCOAST_REPO="${EASTCOAST_REPO:-/opt/eastcoast/EastCoast-master}"

# Host-side tsx import must reach MinIO on the Docker network (minio hostname does not resolve on host).
MINIO_CID="$(docker ps -qf 'name=minio' | head -1 || true)"
if [ -n "${MINIO_CID}" ]; then
  MINIO_IP="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${MINIO_CID}" | awk '{print $1}')"
  if [ -n "${MINIO_IP}" ]; then
    export S3_ENDPOINT="http://${MINIO_IP}:9000"
    echo "==> S3_ENDPOINT for host import: ${S3_ENDPOINT}"
  fi
fi

echo "==> Ensure host deps (tsx)"
if [ ! -d node_modules/tsx ]; then
  npm ci
fi

echo "==> Primal Arts org import (hosting credits 2023-2026)"
npm exec -w @c2k/api -- tsx scripts/import-primal-arts-org.ts --issue-claim-token

echo "==> Verify org hub"
curl -sf "https://kink.social/api/v1/organizations/primal-arts-festival" | head -c 2000
echo ""
echo "PAF_IMPORT_COMPLETE"
