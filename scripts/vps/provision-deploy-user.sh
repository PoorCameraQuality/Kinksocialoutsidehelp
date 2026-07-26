#!/bin/sh
# One-time provisioning of the unprivileged CI deploy user (run once as root).
#   sh provision-deploy-user.sh "<ssh-ed25519 AAAA... comment>"
#
# - Creates user `deploy` (no password login, SSH key only)
# - Installs /usr/local/bin/c2k-deploy and /usr/local/bin/c2k-rollback root-owned
#   from /opt/c2k-staging/scripts/vps (uploaded copies)
# - sudoers: deploy may run ONLY those two commands, NOPASSWD
set -eu

PUBKEY="${1:?usage: provision-deploy-user.sh '<ssh public key line>'}"

if ! id deploy >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash deploy
fi
passwd -l deploy >/dev/null 2>&1 || true

install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
printf '%s\n' "$PUBKEY" > /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

install -m 755 -o root -g root /opt/c2k-staging/scripts/vps/c2k-deploy.sh /usr/local/bin/c2k-deploy
install -m 755 -o root -g root /opt/c2k-staging/scripts/vps/c2k-rollback.sh /usr/local/bin/c2k-rollback

cat > /etc/sudoers.d/c2k-deploy <<'EOF'
deploy ALL=(root) NOPASSWD: /usr/local/bin/c2k-deploy, /usr/local/bin/c2k-rollback
EOF
chmod 440 /etc/sudoers.d/c2k-deploy
visudo -cf /etc/sudoers.d/c2k-deploy

echo "PROVISION_DEPLOY_USER_OK"
