#!/usr/bin/env bash
set -euo pipefail
cd /opt/c2k
set -a
source .env.production
set +a
export NODE_ENV=production
export USE_DATABASE=true
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}"
export C2K_DB_WIPE=false
export ALLOW_ALPHA_SEED=true

echo "==> Append-only base seed (demo actors for ECKE)"
npm run db:seed -w @c2k/api

echo "==> ECKE alpha seed"
npm run db:seed:alpha:ecke -w @c2k/api

echo "==> Health checks"
curl -sf https://kink.social/api/health/ready
echo ""
curl -sf "https://kink.social/api/v1/events?limit=3" | head -c 400
echo ""
echo "SEED_COMPLETE"
