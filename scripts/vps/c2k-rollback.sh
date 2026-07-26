#!/usr/bin/env bash
# Roll production code back to the newest (or a named) pre-deploy snapshot,
# then rebuild and restart. Installed root-owned at /usr/local/bin/c2k-rollback.
#
# Usage:
#   sudo /usr/local/bin/c2k-rollback              # newest snapshot
#   sudo /usr/local/bin/c2k-rollback 20260724T...  # specific stamp
#
# Restores CODE ONLY. Does not touch the database — if a migration must be
# reversed, restore from a Postgres backup per docs/DEPLOYMENT_RUNBOOK.md.
set -euo pipefail

PROD=/opt/c2k
SNAPSHOTS=/opt/c2k-code-snapshots

if [ $# -ge 1 ]; then
  SNAP="$SNAPSHOTS/code-$1.tgz"
else
  SNAP="$(ls -1t "$SNAPSHOTS"/code-*.tgz 2>/dev/null | head -n1 || true)"
fi
[ -n "${SNAP:-}" ] && [ -f "$SNAP" ] || { echo "FATAL: no snapshot found (looked for ${SNAP:-any})"; exit 1; }

echo "==> Rolling back code tree from $SNAP"
tar -xzf "$SNAP" -C "$PROD"

cd "$PROD"
COMPOSE="docker compose -f docker-compose.prod.yml -f docker-compose.prod.vps.yml --env-file .env.production"

echo "==> Rebuild + restart"
$COMPOSE build api web worker
$COMPOSE up -d

echo "==> Health"
sleep 25
curl -sf https://kink.social/api/health/ready
echo ""
echo "C2K_ROLLBACK_OK snapshot=$SNAP"
