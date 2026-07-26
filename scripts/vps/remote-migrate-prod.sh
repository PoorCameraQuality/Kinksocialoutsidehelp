#!/usr/bin/env bash
set -euo pipefail
cd /opt/c2k
set -a
source .env.production
set +a
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}"
npm run db:migrate-prod
echo "=== VERIFY ==="
docker exec c2k-postgres-1 psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='mail_intake_items');"
docker exec c2k-postgres-1 psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_notification_preferences' AND column_name='push_enabled');"
