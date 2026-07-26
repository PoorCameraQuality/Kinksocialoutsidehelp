#!/usr/bin/env bash
set -euo pipefail
COMPOSE="docker compose -f /opt/c2k/docker-compose.prod.yml -f /opt/c2k/docker-compose.prod.vps.yml --env-file /opt/c2k/.env.production"
$COMPOSE exec -T web sh -c '
  CSS=$(grep -o "assets/index-[^\"]*\.css" /usr/share/nginx/html/index.html | head -1)
  for s in feed-tap-pop feed-reaction-ring education-hub edu-rail-panel explore-hub create-flow organizer-panel; do
    n=$(grep -o "$s" /usr/share/nginx/html/$CSS | wc -l)
    echo "$s: $n"
  done
  echo "bundle_bytes=$(wc -c < /usr/share/nginx/html/$CSS)"
'
