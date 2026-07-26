#!/usr/bin/env bash
# Dry-run or apply LOGGED_IN legacy media on public MinIO prefix (Alpha Hardening Pass 1).
# Usage: APPLY=false bash scripts/vps/remote-remediate-restricted-public-media.sh
set -euo pipefail
cd /opt/c2k
set -a
source .env.production
set +a
export USE_DATABASE=true
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}"
export APPLY="${APPLY:-false}"
npx tsx packages/api/scripts/remediate-restricted-public-media.ts
