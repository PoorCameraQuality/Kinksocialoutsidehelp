#!/usr/bin/env bash
set -euo pipefail
cd /opt/c2k
COMPOSE="docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml --env-file .env.production"

echo "=== Source on disk ==="
echo -n "public-auth landing-side-hero count: "
grep -c 'landing-side-hero' packages/web/src/components/landing/public-auth.css || true
echo -n "globals.css lines: "
wc -l < packages/web/src/app/globals.css
echo -n "globals c2k-sticky-above-bottom-nav: "
grep -c 'c2k-sticky-above-bottom-nav' packages/web/src/app/globals.css || true

echo "=== Built web bundle ==="
$COMPOSE exec -T web sh -c '
  CSS=$(grep -o "assets/index-[^\"]*\.css" /usr/share/nginx/html/index.html | head -1)
  echo "css_file=$CSS"
  echo -n "landing-side-hero in bundle: "
  grep -c landing-side-hero /usr/share/nginx/html/$CSS || echo 0
  echo -n "c2k-sticky-above-bottom-nav in bundle: "
  grep -c c2k-sticky-above-bottom-nav /usr/share/nginx/html/$CSS || echo 0
  echo -n "explore-hub in bundle: "
  grep -c explore-hub /usr/share/nginx/html/$CSS || echo 0
  ls -la /usr/share/nginx/html/$CSS
'

echo "=== Web container age ==="
$COMPOSE ps web
