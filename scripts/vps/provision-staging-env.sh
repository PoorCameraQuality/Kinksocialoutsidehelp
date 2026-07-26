#!/bin/sh
# Provision /opt/c2k-staging env files with generated secrets (idempotent: skips if present).
# Run on the VPS: sh /opt/c2k-staging/scripts/vps/provision-staging-env.sh
set -eu

cd /opt/c2k-staging

rm -f packages/web/src/app/settings/SettingsPrivacySection.tsx

if [ -f .env ] && [ -f .env.staging ]; then
  echo "env files already exist - leaving in place"
  exit 0
fi

PGPW="$(openssl rand -hex 16)"
MUSER="staging$(openssl rand -hex 4)"
MPW="$(openssl rand -hex 16)"

cat > .env <<EOF
STAGING_PUBLIC_URL=http://2.25.196.84:8080
STAGING_POSTGRES_PASSWORD=${PGPW}
MINIO_ROOT_USER=${MUSER}
MINIO_ROOT_PASSWORD=${MPW}
S3_BUCKET=c2k-uploads
EOF

cat > .env.staging <<EOF
USE_DATABASE=true
DATABASE_URL=postgresql://c2k_staging:${PGPW}@postgres:5432/c2k_staging?sslmode=disable
REDIS_URL=redis://redis:6379
AUTH_SECRET=$(openssl rand -hex 32)
COOKIE_SECRET=$(openssl rand -hex 32)
AUTH_ALLOW_FALLBACK=false
CORS_ORIGIN=http://2.25.196.84:8080
C2K_PUBLIC_WEB_URL=http://2.25.196.84:8080
API_PUBLIC_URL=http://2.25.196.84:8080
S3_ENDPOINT=http://minio:9000
S3_BUCKET=c2k-uploads
S3_ACCESS_KEY=${MUSER}
S3_SECRET_KEY=${MPW}
C2K_MAIL_TRANSPORT=disabled
C2K_RATE_LIMIT_DISABLE=true
C2K_FIELD_ENCRYPTION_KEY=$(openssl rand -hex 32)
EMAIL_LOOKUP_PEPPER=$(openssl rand -hex 32)
EXTERNAL_STORE_SECRET=$(openssl rand -hex 32)
ECKE_PUBLISH_ENABLED=false
C2K_LIFECYCLE_DISABLE_REPEAT=true
EXTERNAL_SYNC_DISABLE_REPEAT=true
EOF

chmod 600 .env .env.staging
echo "ENV_WRITTEN"
