#!/usr/bin/env bash
# One-time VPS bootstrap: Docker, repo clone, env template.
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER" || true
fi

echo "Clone the repo to /opt/c2k (or similar), copy .env.production.example to .env.production,"
echo "set DOMAIN and secrets, then: docker compose -f docker-compose.prod.yml up -d --build"
