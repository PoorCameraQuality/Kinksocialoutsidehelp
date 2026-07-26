#!/usr/bin/env bash
set -euo pipefail
cd /opt/c2k
set -a
source .env.production
set +a
export NODE_ENV=production
export USE_DATABASE=true
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}"
COMPOSE="docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml --env-file .env.production"

echo "==> npm ci (host deps for migrate/build; node_modules not rsynced)"
npm ci --omit=optional

echo "==> Migrations"
node scripts/migrate-prod.mjs

echo "==> Docker build"
$COMPOSE build api web worker

echo "==> Docker up"
$COMPOSE up -d

echo "==> Wait for API"
sleep 25
curl -sf https://kink.social/api/health/ready

echo "==> ECKE seed"
export ALLOW_ALPHA_SEED=true
npm run db:seed:alpha:ecke -w @c2k/api

echo "==> Final health"
curl -sf https://kink.social/api/health/ready
curl -sf https://kink.social/api/health/mail | head -c 300
echo ""
$COMPOSE ps
echo "DEPLOY_COMPLETE"
