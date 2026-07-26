#!/usr/bin/env bash
# Encrypted off-server Postgres backup for C2K alpha/production.
# Requires: pg_dump, age (https://github.com/FiloSottile/age) or gpg.
#
# Usage:
#   BACKUP_ENCRYPTION_PUBLIC_KEY=age1... DATABASE_URL=postgres://... ./scripts/backup-postgres.sh
#
# Output: ./backups/c2k-pg-YYYYMMDD-HHMMSS.sql.age (never commit backups)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${BACKUP_OUTPUT_DIR:-$ROOT/backups}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
RAW="$OUT_DIR/c2k-pg-$STAMP.sql"
ENC="$OUT_DIR/c2k-pg-$STAMP.sql.age"

mkdir -p "$OUT_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

echo "[backup] dumping postgres to $RAW"
pg_dump "$DATABASE_URL" --no-owner --no-acl -f "$RAW"

if [[ -n "${BACKUP_ENCRYPTION_PUBLIC_KEY:-}" ]]; then
  if command -v age >/dev/null 2>&1; then
    age -r "$BACKUP_ENCRYPTION_PUBLIC_KEY" -o "$ENC" "$RAW"
    rm -f "$RAW"
    echo "[backup] encrypted backup written to $ENC"
  else
    echo "age not installed — leaving unencrypted dump at $RAW (encrypt manually)" >&2
    exit 1
  fi
else
  echo "[backup] BACKUP_ENCRYPTION_PUBLIC_KEY unset — unencrypted dump at $RAW" >&2
  echo "Set BACKUP_ENCRYPTION_PUBLIC_KEY for production backups." >&2
fi

echo "[backup] done"
