#!/usr/bin/env bash
set -euo pipefail
cd /opt/c2k || { echo "NO /opt/c2k"; exit 1; }
COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.vps.yml"

echo "=== HOST ==="
hostname
echo "=== COMPOSE PS ==="
$COMPOSE ps mailserver roundcube caddy api worker 2>&1 || true
echo "=== UFW ==="
ufw status 2>&1 | head -25 || true
echo "=== PTR ==="
dig +short -x 2.25.196.84 2>/dev/null || host 2.25.196.84 2>/dev/null || true
echo "=== LISTEN PORTS ==="
ss -lntp 2>/dev/null | grep -E ':25 |:587 |:465 |:993 ' || true
echo "=== MAIL ENV (masked) ==="
if [[ -f .env.production ]]; then
  grep -E '^(C2K_MAIL|SMTP_|C2K_PUBLIC|C2K_PASSWORD|DOMAIN=|VAPID_)' .env.production | \
    sed -E 's/(SMTP_PASS=|C2K_MAIL_INTAKE_[A-Z_]*PASS=|VAPID_PRIVATE_KEY=).*/\1***MASKED***/'
else
  echo "NO .env.production"
fi
echo "=== HEALTH MAIL ==="
curl -sf https://kink.social/api/health/mail || curl -sf http://127.0.0.1/api/health/mail -H 'Host: kink.social' || echo FAIL
echo ""
echo "=== MAILBOXES ==="
$COMPOSE exec -T mailserver setup email list 2>&1 | head -40 || echo "mailserver exec failed"
echo "=== DKIM ==="
test -f docker/mailserver/config/opendkim/keys/kink.social/mail.txt && head -1 docker/mailserver/config/opendkim/keys/kink.social/mail.txt || echo NO_DKIM_FILE
echo "=== WEBMAIL ==="
curl -sfI https://webmail.kink.social 2>&1 | head -3 || echo WEBMAIL_FAIL
