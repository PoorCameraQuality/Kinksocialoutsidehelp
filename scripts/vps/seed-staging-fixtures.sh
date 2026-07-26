#!/bin/sh
# Optional E2E fixtures for STAGING (moderation cases + alpha social users).
set -eu

cd /opt/c2k-staging

PGPW="$(grep '^STAGING_POSTGRES_PASSWORD=' .env | cut -d= -f2)"
export DATABASE_URL="postgresql://c2k_staging:${PGPW}@127.0.0.1:5433/c2k_staging?sslmode=disable"
export USE_DATABASE=true
export S3_ENDPOINT="http://127.0.0.1:9100"
export S3_BUCKET="c2k-uploads"
export S3_ACCESS_KEY="$(grep '^MINIO_ROOT_USER=' .env | cut -d= -f2)"
export S3_SECRET_KEY="$(grep '^MINIO_ROOT_PASSWORD=' .env | cut -d= -f2)"
unset NODE_ENV C2K_ENV

npm run db:seed-moderation-ts-fixtures -w @c2k/api
ALLOW_ALPHA_SOCIAL_SEED=true npm run db:seed:alpha:social -w @c2k/api
echo "STAGING_FIXTURES_READY"
