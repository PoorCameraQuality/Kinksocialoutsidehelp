#!/usr/bin/env bash
# Deploy media privacy fix without re-seeding alpha social or ECKE.
set -euo pipefail
cd /opt/c2k
COMPOSE="docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml --env-file .env.production"

set -a
source .env.production
set +a
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}"
export NODE_ENV=production
export USE_DATABASE=true

echo "==> Pass 2 media fix deploy"
echo "package_json_mtime=$(stat -c '%y' package.json 2>/dev/null || stat -f '%Sm' package.json)"

npm ci --omit=optional
node scripts/migrate-prod.mjs
$COMPOSE build api web worker
$COMPOSE up -d
sleep 35

curl -sf -o /dev/null -w "ready=%{http_code}\n" https://kink.social/api/health/ready
echo "DEPLOY_MEDIA_FIX_COMPLETE"
