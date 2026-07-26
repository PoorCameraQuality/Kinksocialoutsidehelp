#!/bin/sh
# Push schema + seed the STAGING database only (127.0.0.1:5433 / c2k_staging).
# Refuses to run if DATABASE_URL would point at the production database.
set -eu

cd /opt/c2k-staging

PGPW="$(grep '^STAGING_POSTGRES_PASSWORD=' .env | cut -d= -f2)"
export DATABASE_URL="postgresql://c2k_staging:${PGPW}@127.0.0.1:5433/c2k_staging?sslmode=disable"
export USE_DATABASE=true
export PGHOST=127.0.0.1
export PGPORT=5433
export S3_ENDPOINT="http://127.0.0.1:9100"
export S3_BUCKET="c2k-uploads"
export S3_ACCESS_KEY="$(grep '^MINIO_ROOT_USER=' .env | cut -d= -f2)"
export S3_SECRET_KEY="$(grep '^MINIO_ROOT_PASSWORD=' .env | cut -d= -f2)"
unset NODE_ENV C2K_ENV

case "$DATABASE_URL" in
  *5432*|*"@postgres"*|*c2k_prod*) echo "FATAL: refusing - DATABASE_URL looks like production"; exit 1 ;;
esac

node scripts/wait-for-postgres.mjs
npm run db:push -w @c2k/api
npm run db:migrate-incremental -w @c2k/api
npm run db:seed -w @c2k/api
npm run db:ensure-preview-attendee-parity -w @c2k/api
echo "STAGING_DB_READY"
