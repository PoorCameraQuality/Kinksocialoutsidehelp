#!/usr/bin/env bash
# VPS Alpha Execution Pass 2 — backup, pull, migrate, build, alpha social seed (non-destructive).
set -euo pipefail
cd /opt/c2k
COMPOSE="docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml --env-file .env.production"
STAMP="$(date -u +%Y%m%d-%H%M%S)"

echo "==> Pass 2 preflight"
hostname
pwd

echo "==> Backup .env.production"
if [[ -f .env.production ]]; then
  cp -a .env.production ".env.production.bak-pass2-${STAMP}"
  echo "env_backup=.env.production.bak-pass2-${STAMP}"
else
  echo "ERROR: .env.production missing" >&2
  exit 1
fi

set -a
source .env.production
set +a
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}"
export NODE_ENV=production
export USE_DATABASE=true

echo "==> User count BEFORE"
USER_BEFORE="$($COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT count(*) FROM users;" 2>/dev/null | tr -d '[:space:]')"
echo "users_before=${USER_BEFORE}"

echo "==> Postgres backup"
BACKUP_DIR="/opt/c2k/backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="${BACKUP_DIR}/c2k-pg-pass2-${STAMP}.sql"
$COMPOSE exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl > "$BACKUP_FILE"
BACKUP_BYTES="$(wc -c < "$BACKUP_FILE" | tr -d '[:space:]')"
if [[ "${BACKUP_BYTES}" -lt 1000 ]]; then
  echo "ERROR: backup too small (${BACKUP_BYTES} bytes)" >&2
  exit 1
fi
echo "backup_file=${BACKUP_FILE}"
echo "backup_bytes=${BACKUP_BYTES}"

echo "==> Deploy source"
if [[ -d .git ]]; then
  git fetch origin desktop-ui-sprint-3-visual-polish
  git checkout desktop-ui-sprint-3-visual-polish
  git pull --ff-only origin desktop-ui-sprint-3-visual-polish
  echo "deployed_commit=$(git rev-parse HEAD)"
  git status --short | head -20 || true
else
  echo "ERROR: /opt/c2k is not a git repo — tarball deploy required" >&2
  exit 1
fi

echo "==> npm ci"
npm ci --omit=optional

echo "==> Migrations (non-destructive)"
node scripts/migrate-prod.mjs

echo "==> Docker build"
$COMPOSE build api web worker

echo "==> Docker up"
$COMPOSE up -d
sleep 30

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
BATCH="$($COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT id FROM alpha_seed_batches WHERE batch_key = 'alpha-social-seed' LIMIT 1;" 2>/dev/null | tr -d '[:space:]' || echo none)"
echo "alpha_social_batch=${BATCH}"
ECKE_EVENTS="$($COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT count(*) FROM events;" | tr -d '[:space:]')"
echo "events_count=${ECKE_EVENTS}"

echo "==> Idempotency re-run"
npm run seed:alpha-social
ALPHA_USERS_AFTER="$($COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT count(*) FROM users WHERE username LIKE 'alpha_%';" | tr -d '[:space:]')"
echo "alpha_users_after_rerun=${ALPHA_USERS_AFTER}"

echo "==> alpha_social login probe (no password change)"
LOGIN_HTTP="$(curl -s -o /tmp/c2k-login-pass2.json -w "%{http_code}" -X POST https://kink.social/api/auth/session \
  -H 'Content-Type: application/json' \
  -d '{"username":"alpha_social","password":"AlphaSocial!23"}')"
echo "alpha_social_login_http=${LOGIN_HTTP}"
head -c 200 /tmp/c2k-login-pass2.json || true
echo ""

echo "==> User count AFTER"
USER_AFTER="$($COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT count(*) FROM users;" | tr -d '[:space:]')"
echo "users_after=${USER_AFTER}"

echo "PASS2_DEPLOY_COMPLETE"
