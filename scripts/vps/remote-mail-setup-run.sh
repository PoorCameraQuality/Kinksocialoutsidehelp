#!/usr/bin/env bash
set -euo pipefail
cd /opt/c2k
NEW_PASS="$(openssl rand -hex 24)"
export DOMAIN=kink.social
export MAILBOX_PASSWORD="$NEW_PASS"
bash scripts/mail/create-mailboxes.sh
python3 <<PY
import re, pathlib
p = pathlib.Path("/opt/c2k/.env.production")
t = p.read_text()
new = "$NEW_PASS"
t = re.sub(r"^SMTP_PASS=.*", f"SMTP_PASS={new}", t, flags=re.M)
if "SMTP_PASS=" not in t:
    t += f"\nSMTP_PASS={new}\n"
p.write_text(t)
PY
COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.vps.yml"
$COMPOSE up -d api worker
echo "=== MAILBOXES ==="
$COMPOSE exec -T mailserver setup email list
echo "=== SAVE THIS PASSWORD (all mailboxes use it unless you set per-role vars) ==="
echo "MAILBOX_MASTER_PASSWORD=$NEW_PASS"
echo "=== HEALTH ==="
curl -sf https://kink.social/api/health/mail
echo ""
