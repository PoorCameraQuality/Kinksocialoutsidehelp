#!/usr/bin/env bash
set -euo pipefail
cd /opt/c2k
COMPOSE="docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml --env-file .env.production"
$COMPOSE exec -T postgres psql -U c2k -d c2k -c "SELECT username FROM users ORDER BY created_at LIMIT 20;"
$COMPOSE exec -T postgres psql -U c2k -d c2k -c "SELECT slug FROM organizations LIMIT 20;"
$COMPOSE ps
curl -sf https://kink.social/api/health/ready
echo ""
