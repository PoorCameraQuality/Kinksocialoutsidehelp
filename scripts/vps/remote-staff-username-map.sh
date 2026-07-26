#!/usr/bin/env bash
# Read-only: map staff env UUID lists to usernames (no env values printed).
set -euo pipefail
cd /opt/c2k
set -a && source .env.production && set +a
COMPOSE="docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml --env-file .env.production"

echo "==> env var names present (values redacted)"
for v in C2K_SITE_OWNER_USER_IDS C2K_SITE_ADMIN_USER_IDS C2K_PLATFORM_MODERATOR_USER_IDS; do
  if [[ -n "${!v:-}" ]]; then echo "${v}=set"; else echo "${v}=unset"; fi
done

map_uuids() {
  local label="$1"
  local csv="$2"
  [[ -z "$csv" ]] && return
  IFS=',' read -ra ids <<< "$csv"
  for id in "${ids[@]}"; do
    id="$(echo "$id" | tr -d '[:space:]')"
    [[ -z "$id" ]] && continue
    $COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A \
      -c "SELECT '${label}', u.username FROM users u WHERE u.id='${id}' LIMIT 1;" 2>/dev/null || echo "${label}|missing|${id}"
  done
}

map_uuids owner "${C2K_SITE_OWNER_USER_IDS:-}"
map_uuids site_admin "${C2K_SITE_ADMIN_USER_IDS:-}"
map_uuids platform_mod "${C2K_PLATFORM_MODERATOR_USER_IDS:-}"

echo "==> platform_staff roles (username only)"
$COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A \
  -c "SELECT u.username, ps.role FROM platform_staff ps JOIN users u ON u.id=ps.user_id ORDER BY ps.role, u.username LIMIT 20;"
