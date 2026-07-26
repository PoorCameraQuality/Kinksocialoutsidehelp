#!/usr/bin/env bash
set -euo pipefail
cd /opt/c2k
set -a && source .env.production && set +a
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}"
export USE_DATABASE=true
npm run db:seed:reference -w @c2k/api
