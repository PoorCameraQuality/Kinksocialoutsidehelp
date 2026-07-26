#!/usr/bin/env bash
set -euo pipefail
cd /opt/c2k
set -a && source .env.production && set +a
docker run --rm --network c2k_default nicolaka/netshoot swaks \
  --to "${C2K_PLATFORM_ADMIN_EMAILS%%,*}" \
  --from "${C2K_SMTP_MAILBOX}" \
  --server mailserver --port 587 \
  --auth-user "${SMTP_USER}" --auth-password "${SMTP_PASS}" \
  --header "Subject: C2K SMTP smoke test" \
  --body "If you received this, outbound SMTP from kink.social is working."
