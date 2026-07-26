#!/usr/bin/env bash
set -euo pipefail

TOKEN="${1:?usage: install-spaceship-ssl.sh <token>}"

BIN_URL="https://ssl-manager.s3.amazonaws.com/bin/amd64/linux/ssl-manager"
ROOT_BIN="/opt/ssl-manager/bin/ssl-manager"
DISCOVERY="https://ssl-manager.s3.amazonaws.com/discovery.json"

mkdir -p /opt/ssl-manager/bin
curl -fsSL -o "$ROOT_BIN" "$BIN_URL"
chmod +x "$ROOT_BIN"
ln -sf "$ROOT_BIN" /usr/bin/ssl-manager

echo "Registering ssl-manager with SpaceShip..."
ssl-manager --discoveryUrl "$DISCOVERY" register -t "$TOKEN"

echo "Registration complete. ssl-manager info:"
ssl-manager info || true

if ! systemctl list-unit-files | grep -q ssl-manager.service; then
  cat >/etc/systemd/system/ssl-manager.service <<'UNIT'
[Unit]
Description=SpaceShip External SSL Manager
After=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/ssl-manager cron
Restart=always
RestartSec=60

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable --now ssl-manager.service
  echo "Started ssl-manager.service"
else
  systemctl restart ssl-manager.service || true
fi

systemctl --no-pager status ssl-manager.service | head -15
