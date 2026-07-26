#!/usr/bin/env bash
set -euo pipefail
cd /opt/c2k
set -a && source .env.production && set +a

curl -s -c /tmp/cj.txt -X POST https://kink.social/api/auth/session \
  -H 'Content-Type: application/json' \
  -d '{"username":"alpha_social","password":"AlphaSocial!23"}' >/dev/null

echo "==> feed/home sample"
curl -s -b /tmp/cj.txt "https://kink.social/api/v1/feed/home?limit=3" | head -c 600; echo

echo "==> groups"
curl -s -o /tmp/g.json -w "groups_http=%{http_code}\n" -b /tmp/cj.txt "https://kink.social/api/v1/groups?limit=5"
head -c 300 /tmp/g.json; echo

echo "==> events upcoming"
curl -s -o /tmp/e.json -w "events_http=%{http_code}\n" -b /tmp/cj.txt "https://kink.social/api/v1/events?upcoming=true&limit=3"
head -c 300 /tmp/e.json; echo

echo "==> connections"
curl -s -o /tmp/c.json -w "connections_http=%{http_code}\n" -b /tmp/cj.txt "https://kink.social/api/v1/social-graph/connections"
head -c 300 /tmp/c.json; echo

echo "==> people search"
curl -s -o /tmp/p.json -w "people_http=%{http_code}\n" -b /tmp/cj.txt "https://kink.social/api/v1/people?limit=5"
head -c 300 /tmp/p.json; echo

echo "==> ECKE events unchanged check"
docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml --env-file .env.production exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT count(*) FROM alpha_seed_batches WHERE batch_key='alpha-ecke-seed';"

echo "==> feed activity count"
docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml --env-file .env.production exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT count(*) FROM feed_activities WHERE actor_user_id IN (SELECT id FROM users WHERE username LIKE 'alpha_%');" 2>/dev/null || echo "no feed_activities col"
