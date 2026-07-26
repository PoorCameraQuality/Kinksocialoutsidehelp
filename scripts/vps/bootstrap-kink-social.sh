#!/usr/bin/env bash
# Full first-time deploy on Ubuntu VPS for kink.social (Docker Compose + mail + MinIO).
set -euo pipefail

ROOT="${DEPLOY_ROOT:-/opt/c2k}"
DOMAIN="${DOMAIN:-kink.social}"
COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.vps.yml"

export DEBIAN_FRONTEND=noninteractive

echo "==> Installing system packages..."
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg lsb-release openssl rsync ufw

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
fi

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v20* ]]; then
  echo "==> Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi

echo "==> Firewall (ufw)..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 25/tcp
ufw allow 587/tcp
ufw allow 465/tcp
ufw --force enable || true

cd "$ROOT"

mkdir -p docker/mailserver/{data,state,logs,config}

if [[ ! -f .env.production ]]; then
  export DOMAIN
  export BRAX_ADMIN_PASSWORD="${BRAX_ADMIN_PASSWORD:-Airshipknight!2}"
  bash scripts/vps/provision-env.sh "$ROOT"
fi

set -a
# shellcheck disable=SC1091
source .env.production
set +a

echo "==> Starting Postgres + Redis..."
$COMPOSE up -d postgres redis
sleep 8

echo "==> Running database migrations (host)..."
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}"
npm ci --omit=optional
node scripts/migrate-prod.mjs

echo "==> Seeding reference data (locations + kink tags)..."
npm run db:seed:reference -w @c2k/api

echo "==> Starting mailserver (pull may take a minute)..."
$COMPOSE up -d mailserver
sleep 15

echo "==> Creating SMTP mailbox ${C2K_SMTP_MAILBOX:-noreply@${DOMAIN}}..."
MAILBOX="${C2K_SMTP_MAILBOX:-noreply@${DOMAIN}}"
MAIL_PASS="${C2K_SMTP_MAILBOX_PASSWORD:-${SMTP_PASS}}"
$COMPOSE exec -T mailserver setup email add "$MAILBOX" "$MAIL_PASS" 2>/dev/null || \
  $COMPOSE exec -T mailserver setup email update "$MAILBOX" "$MAIL_PASS" 2>/dev/null || \
  echo "Mailbox may already exist — continuing."

$COMPOSE exec -T mailserver setup config dkim >/dev/null 2>&1 || true

echo "==> Building and starting full stack..."
$COMPOSE up -d --build

echo "==> MinIO public read for profile/media URLs..."
bash scripts/vps/fix-minio-public-read.sh

echo "==> Waiting for API readiness..."
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1/api/health/ready -H "Host: ${DOMAIN}" 2>/dev/null; then
    echo "API ready."
    break
  fi
  if docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.prod.vps.yml exec -T api wget -qO- http://127.0.0.1:3001/api/health/ready 2>/dev/null; then
    echo "API ready (internal)."
    break
  fi
  sleep 5
  if [[ "$i" -eq 60 ]]; then
    echo "WARN: API readiness timeout — check logs: $COMPOSE logs api"
  fi
done

echo "==> Ensuring Brax site admin..."
export BRAX_ADMIN_EMAIL="${BRAX_ADMIN_EMAIL:-brax@${DOMAIN}}"
export BRAX_ADMIN_PASSWORD="${BRAX_ADMIN_PASSWORD:-Airshipknight!2}"
npm run db:ensure-brax-site-admin

echo ""
echo "=== Deploy complete ==="
echo "Site: https://${DOMAIN}"
echo "Admin: Brax / (password from BRAX_ADMIN_PASSWORD in .env.production)"
echo ""
echo "DNS records still required for mail deliverability:"
echo "  A     mail.${DOMAIN}  -> $(curl -4 -s ifconfig.me 2>/dev/null || echo YOUR_VPS_IP)"
echo "  TXT   @               -> v=spf1 ip4:$(curl -4 -s ifconfig.me 2>/dev/null || echo YOUR_VPS_IP) -all"
echo "  TXT   _dmarc.${DOMAIN} -> v=DMARC1; p=quarantine; rua=mailto:postmaster@${DOMAIN}"
echo "  (DKIM) run: cd ${ROOT} && $COMPOSE exec mailserver cat /tmp/docker-mailserver/opendkim/keys/${DOMAIN}/mail.txt"
echo ""
$COMPOSE ps
