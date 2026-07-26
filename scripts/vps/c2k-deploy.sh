#!/usr/bin/env bash
# Production deploy wrapper — the ONLY entry point the `deploy` CI user may sudo.
# Installed root-owned at /usr/local/bin/c2k-deploy (chmod 755, not writable by deploy).
#
# Usage: sudo /usr/local/bin/c2k-deploy /tmp/deploy.tgz
#
# Staged release flow:
#   1. Extract tarball into /opt/c2k-releases/<UTC stamp>/
#   2. Snapshot current /opt/c2k code tree (tar, excludes runtime data) for rollback
#   3. rsync release over /opt/c2k (code only; never touches .env.production,
#      docker/mailserver state, backups, or Docker volumes)
#   4. Run scripts/vps/remote-deploy-steps.sh (migrations, build, up, health)
#   5. Record release stamp; keep last 5 releases + snapshots
set -euo pipefail

TARBALL="${1:?usage: c2k-deploy <tarball>}"
PROD=/opt/c2k
RELEASES=/opt/c2k-releases
SNAPSHOTS=/opt/c2k-code-snapshots
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
KEEP=5

[ -f "$TARBALL" ] || { echo "FATAL: tarball not found: $TARBALL"; exit 1; }
mkdir -p "$RELEASES/$STAMP" "$SNAPSHOTS"

echo "==> Extract release $STAMP"
tar -xzf "$TARBALL" -C "$RELEASES/$STAMP"
rm -f "$TARBALL"

echo "==> Snapshot current code tree"
tar -czf "$SNAPSHOTS/code-$STAMP.tgz" -C "$PROD" \
  --exclude='./docker/mailserver' \
  --exclude='./backups' \
  --exclude='./node_modules' \
  --exclude='./.env.production*' \
  --exclude='./test-results' \
  . 2>/dev/null || true

echo "==> Sync release into $PROD (code only)"
rsync -a --delete \
  --exclude='.env.production*' \
  --exclude='.env' \
  --exclude='.env.staging' \
  --exclude='docker/mailserver' \
  --exclude='backups' \
  --exclude='node_modules' \
  --exclude='test-results' \
  "$RELEASES/$STAMP/" "$PROD/"

echo "==> Run deploy steps"
bash "$PROD/scripts/vps/remote-deploy-steps.sh"

echo "$STAMP" > "$RELEASES/CURRENT"
echo "==> Prune old releases/snapshots (keep $KEEP)"
ls -1dt "$RELEASES"/2* 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -rf
ls -1t "$SNAPSHOTS"/code-*.tgz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "C2K_DEPLOY_OK release=$STAMP"
