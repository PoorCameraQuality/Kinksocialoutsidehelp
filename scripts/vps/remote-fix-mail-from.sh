#!/usr/bin/env bash
set -euo pipefail
cd /opt/c2k

python3 <<'PY'
import re, pathlib
p = pathlib.Path(".env.production")
t = p.read_text()
t = re.sub(
    r"^C2K_MAIL_FROM=.*",
    "C2K_MAIL_FROM=\"Kink.Social <noreply@kink.social>\"",
    t,
    flags=re.M,
)
if not re.search(r"^C2K_MAIL_REPLY_TO=", t, re.M):
    t += "\nC2K_MAIL_REPLY_TO=support@kink.social\n"
else:
    t = re.sub(
        r"^C2K_MAIL_REPLY_TO=.*",
        "C2K_MAIL_REPLY_TO=support@kink.social",
        t,
        flags=re.M,
    )
p.write_text(t)
print("=== mail env (after) ===")
for line in t.splitlines():
    if line.startswith("C2K_MAIL") or line.startswith("SMTP_USER"):
        print(line)
PY

COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.vps.yml"
$COMPOSE up -d --force-recreate api worker
sleep 8
echo "=== container env ==="
$COMPOSE exec -T api sh -c 'echo C2K_MAIL_FROM=$C2K_MAIL_FROM; echo C2K_MAIL_REPLY_TO=$C2K_MAIL_REPLY_TO'
echo "=== health ==="
curl -sf https://kink.social/api/health/mail || echo "health check failed"
echo ""
