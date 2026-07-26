#!/usr/bin/env bash
set -euo pipefail
cd /opt/c2k
set -a
source .env.production
set +a
export NODE_ENV=production
export USE_DATABASE=true
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}"
export ALLOW_ALPHA_SEED=true
COMPOSE="docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml --env-file .env.production"

echo "==> Restore host node_modules"
npm ci
npm install --include=optional sharp --no-save

echo "==> ECKE alpha seed"
npm exec -w @c2k/api -- tsx src/db/seed-alpha-ecke.ts

echo "==> Health + events sample"
curl -sf https://kink.social/api/health/ready
echo ""
curl -sf "https://kink.social/api/v1/events?limit=5" | head -c 800
echo ""
cd /opt/c2k
$COMPOSE ps
echo "SEED_COMPLETE"
