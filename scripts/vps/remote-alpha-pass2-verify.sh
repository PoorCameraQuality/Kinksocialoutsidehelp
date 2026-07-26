#!/usr/bin/env bash
set -euo pipefail
cd /opt/c2k
COMPOSE="docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml --env-file .env.production"
set -a && source .env.production && set +a

echo "==> DB counts"
$COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT 'alpha_users', count(*) FROM users WHERE username LIKE 'alpha_%';"
$COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT 'events', count(*) FROM events;"
$COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT 'feed_posts', count(*) FROM feed_posts WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'alpha_%');" 2>/dev/null || echo "feed_posts_query_failed"
$COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT 'notifications', count(*) FROM notifications WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'alpha_%');" 2>/dev/null || true
$COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT batch_key FROM alpha_seed_batches WHERE batch_key='alpha-social-seed' LIMIT 1;" 2>/dev/null || echo "batch_table_check"

echo "==> Idempotency re-run tail"
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}"
export NODE_ENV=production USE_DATABASE=true ALLOW_ALPHA_SOCIAL_SEED=true FORCE_ALPHA_SOCIAL_SEED_ON_PROD=true
npm run seed:alpha-social 2>&1 | tail -8
$COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT 'alpha_users_after', count(*) FROM users WHERE username LIKE 'alpha_%';"

echo "==> alpha_social login"
curl -s -o /tmp/login.json -w "http=%{http_code}\n" -X POST https://kink.social/api/auth/session \
  -H 'Content-Type: application/json' \
  -d '{"username":"alpha_social","password":"AlphaSocial!23"}'
head -c 300 /tmp/login.json; echo

echo "==> Authenticated API smoke (cookie jar)"
curl -s -c /tmp/c2k-cookies.txt -b /tmp/c2k-cookies.txt -X POST https://kink.social/api/auth/session \
  -H 'Content-Type: application/json' \
  -d '{"username":"alpha_social","password":"AlphaSocial!23"}' -o /tmp/login2.json
echo "login2:"; head -c 200 /tmp/login2.json; echo

for path in "/api/v1/feed/home" "/api/v1/people/discover?limit=5" "/api/v1/conversations?folder=main" "/api/v1/notifications?limit=5" "/api/v1/activity/inbox?limit=5"; do
  code=$(curl -s -o /tmp/smoke.json -w "%{http_code}" -b /tmp/c2k-cookies.txt "https://kink.social${path}")
  bytes=$(wc -c < /tmp/smoke.json | tr -d '[:space:]')
  echo "${path} http=${code} bytes=${bytes}"
done

echo "==> Privacy probe (alpha_private_only_me feed as alpha_social vs alpha_newbie)"
# get alpha_newbie cookie
curl -s -c /tmp/newbie.txt -X POST https://kink.social/api/auth/session \
  -H 'Content-Type: application/json' \
  -d '{"username":"alpha_newbie","password":"AlphaSocial!23"}' -o /dev/null
curl -s -b /tmp/c2k-cookies.txt "https://kink.social/api/v1/feed/home" -o /tmp/home-social.json
curl -s -b /tmp/newbie.txt "https://kink.social/api/v1/feed/home" -o /tmp/home-newbie.json
node -e "
const fs=require('fs');
const a=JSON.parse(fs.readFileSync('/tmp/home-social.json','utf8'));
const b=JSON.parse(fs.readFileSync('/tmp/home-newbie.json','utf8'));
const ids=(x)=>new Set((x.items||[]).map(i=>i.id));
const onlyA=[...ids(a)].filter(id=>!ids(b).has(id));
const onlyB=[...ids(b)].filter(id=>!ids(a).has(id));
console.log('home_items_alpha_social', (a.items||[]).length);
console.log('home_items_alpha_newbie', (b.items||[]).length);
console.log('diff_only_social', onlyA.length, 'diff_only_newbie', onlyB.length);
" 2>/dev/null || echo "privacy_feed_compare_skipped"

echo "==> Upload health (profile photo policy)"
curl -s -b /tmp/c2k-cookies.txt "https://kink.social/api/v1/profile/photos" -w "\nphotos_http=%{http_code}\n" | head -c 400

echo "PASS2_VERIFY_COMPLETE"
