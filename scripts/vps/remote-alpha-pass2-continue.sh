#!/usr/bin/env bash
# VPS Alpha Pass 2 — continue after tarball extract (backup already taken).
set -euo pipefail
cd /opt/c2k
COMPOSE="docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml --env-file .env.production"

set -a
source .env.production
set +a
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}"
export NODE_ENV=production
export USE_DATABASE=true

echo "deployed_commit_marker=$(grep -m1 '"version"' package.json || echo unknown)"
echo "package_json_mtime=$(stat -c '%y' package.json 2>/dev/null || stat -f '%Sm' package.json)"

echo "==> npm ci"
npm ci --omit=optional

echo "==> Migrations (non-destructive)"
node scripts/migrate-prod.mjs

echo "==> Docker build"
$COMPOSE build api web worker

echo "==> Docker up"
$COMPOSE up -d
sleep 35

echo "==> Services"
$COMPOSE ps

echo "==> Health checks"
curl -sf -o /dev/null -w "home=%{http_code}\n" https://kink.social/
curl -sf -o /dev/null -w "login=%{http_code}\n" "https://kink.social/?login=1"
curl -sf -o /dev/null -w "forgot=%{http_code}\n" "https://kink.social/forgot-password"
curl -sf -o /dev/null -w "messaging=%{http_code}\n" https://kink.social/messaging
curl -sf -o /dev/null -w "notifications=%{http_code}\n" https://kink.social/notifications
curl -sf https://kink.social/api/health
echo ""
curl -sf https://kink.social/api/health/ready
echo ""
curl -sf https://kink.social/api/health/mail | head -c 400
echo ""

echo "==> Alpha social seed (guarded)"
export ALLOW_ALPHA_SOCIAL_SEED=true
export FORCE_ALPHA_SOCIAL_SEED_ON_PROD=true
npm run seed:alpha-social

echo "==> Seed verification"
ALPHA_USERS="$($COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT count(*) FROM users WHERE username LIKE 'alpha_%';" | tr -d '[:space:]')"
echo "alpha_users=${ALPHA_USERS}"
FEED="$($COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT count(*) FROM feed_activities WHERE author_user_id IN (SELECT id FROM users WHERE username LIKE 'alpha_%');" 2>/dev/null | tr -d '[:space:]' || echo 0)"
echo "alpha_feed_activities=${FEED}"
GROUPS="$($COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT count(*) FROM groups WHERE slug LIKE 'alpha-%';" 2>/dev/null | tr -d '[:space:]' || echo 0)"
echo "alpha_groups=${GROUPS}"
ECKE_EVENTS="$($COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT count(*) FROM events;" | tr -d '[:space:]')"
echo "events_count=${ECKE_EVENTS}"

echo "==> Idempotency re-run"
npm run seed:alpha-social 2>&1 | tail -5
ALPHA_USERS_AFTER="$($COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT count(*) FROM users WHERE username LIKE 'alpha_%';" | tr -d '[:space:]')"
echo "alpha_users_after_rerun=${ALPHA_USERS_AFTER}"

echo "==> alpha_social login probe"
LOGIN_HTTP="$(curl -s -o /tmp/c2k-login-pass2.json -w "%{http_code}" -X POST https://kink.social/api/auth/session \
  -H 'Content-Type: application/json' \
  -d '{"username":"alpha_social","password":"AlphaSocial!23"}')"
echo "alpha_social_login_http=${LOGIN_HTTP}"
head -c 250 /tmp/c2k-login-pass2.json || true
echo ""

echo "PASS2_CONTINUE_COMPLETE"
