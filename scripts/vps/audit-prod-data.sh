#!/usr/bin/env bash
set -euo pipefail
cd /opt/c2k
COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.vps.yml"
PSQL="$COMPOSE exec -T postgres psql -U c2k -d c2k -t -A -c"
tables=(
  countries states places place_zips
  kink_tags kink_tag_aliases profile_kinks
  users profiles platform_staff organizations events conventions
  vendor_profiles products media_assets profile_photos
)
for t in "${tables[@]}"; do
  c=$($PSQL "select count(*) from $t" 2>/dev/null || echo ERR)
  printf '%-22s %s\n' "$t" "$c"
done
