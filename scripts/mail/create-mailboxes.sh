#!/usr/bin/env bash
# Create or update kink.social mailboxes on docker-mailserver (production VPS).
# Safe to rerun — existing accounts are skipped or updated when MAILBOX_PASSWORD is set.
#
# Usage (on VPS, from deploy root /opt/c2k):
#   export DOMAIN=kink.social
#   export COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.vps.yml"
#   bash scripts/mail/create-mailboxes.sh
#
# Per-mailbox passwords (never commit real values):
#   export MAILBOX_PASSWORD='generate-a-strong-secret'
#   export SUPPORT_MAILBOX_PASSWORD='...'
#   export LEGAL_MAILBOX_PASSWORD='...'
#   etc.
#
# Optional staff mailboxes:
#   export STAFF_MAILBOXES='alice@kink.social,bob@kink.social'

set -euo pipefail

ROOT="${DEPLOY_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$ROOT"

DOMAIN="${DOMAIN:-kink.social}"
COMPOSE="${COMPOSE:-docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.vps.yml}"

DEFAULT_PASS="${MAILBOX_PASSWORD:-}"
if [[ -z "$DEFAULT_PASS" ]]; then
  echo "ERROR: Set MAILBOX_PASSWORD to a strong secret (not committed to git)." >&2
  echo "Example: export MAILBOX_PASSWORD=\$(openssl rand -base64 24)" >&2
  exit 1
fi

pass_for() {
  local localpart="$1"
  local upper
  upper=$(echo "$localpart" | tr '[:lower:]' '[:upper:]' | tr '@.' '_')
  local var="${upper}_MAILBOX_PASSWORD"
  if [[ -n "${!var:-}" ]]; then
    echo "${!var}"
  else
    echo "$DEFAULT_PASS"
  fi
}

add_mailbox() {
  local email="$1"
  local pass="$2"
  echo "==> Mailbox: $email"
  if $COMPOSE exec -T mailserver setup email list 2>/dev/null | grep -Fq "$email"; then
    echo "    exists — updating password"
    $COMPOSE exec -T mailserver setup email update "$email" "$pass"
  else
    $COMPOSE exec -T mailserver setup email add "$email" "$pass"
  fi
}

add_alias() {
  local alias="$1"
  local dest="$2"
  echo "==> Alias: $alias -> $dest"
  $COMPOSE exec -T mailserver setup alias add "$alias" "$dest" 2>/dev/null || \
    $COMPOSE exec -T mailserver setup alias update "$alias" "$dest" 2>/dev/null || \
    echo "    (alias may already exist)"
}

echo "==> Ensuring mailserver is running..."
$COMPOSE up -d mailserver
sleep 5

MAILBOXES=(
  "noreply@${DOMAIN}"
  "support@${DOMAIN}"
  "legal@${DOMAIN}"
  "business@${DOMAIN}"
  "security@${DOMAIN}"
  "admin@${DOMAIN}"
  "abuse@${DOMAIN}"
  "postmaster@${DOMAIN}"
)

for mb in "${MAILBOXES[@]}"; do
  localpart="${mb%%@*}"
  add_mailbox "$mb" "$(pass_for "$localpart")"
done

if [[ -n "${STAFF_MAILBOXES:-}" ]]; then
  IFS=',' read -ra STAFF <<< "$STAFF_MAILBOXES"
  for mb in "${STAFF[@]}"; do
    mb=$(echo "$mb" | xargs)
    [[ -z "$mb" ]] && continue
    localpart="${mb%%@*}"
    add_mailbox "$mb" "$(pass_for "$localpart")"
  done
fi

echo "==> Aliases (postmaster -> admin; others deliver to dedicated mailboxes)"
add_alias "postmaster@${DOMAIN}" "admin@${DOMAIN}"

echo "==> DKIM (add DNS TXT from output below)"
$COMPOSE exec -T mailserver setup config dkim domain "$DOMAIN" || \
  $COMPOSE exec -T mailserver setup config dkim || true

echo ""
echo "=== Done ==="
echo "Webmail: https://webmail.${DOMAIN}"
echo "Log in with support@${DOMAIN}, legal@${DOMAIN}, etc."
echo ""
echo "App SMTP (in .env.production on Docker network):"
echo "  SMTP_HOST=mailserver"
echo "  SMTP_USER=noreply@${DOMAIN}"
echo "  SMTP_PASS=<noreply mailbox password>"
echo ""
echo "IMAP intake (optional, disabled by default):"
echo "  C2K_MAIL_INTAKE_ENABLED=true"
echo "  C2K_MAIL_INTAKE_IMAP_HOST=mailserver"
echo "  C2K_MAIL_INTAKE_SUPPORT_USER=support@${DOMAIN}"
echo "  C2K_MAIL_INTAKE_SUPPORT_PASS=<support mailbox password>"
echo "  (repeat for legal, business, abuse, security)"
