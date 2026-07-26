#!/usr/bin/env bash
set -euo pipefail
# Privacy: only-me post hidden from non-author
curl -s -c /tmp/priv.txt -X POST https://kink.social/api/auth/session \
  -H 'Content-Type: application/json' \
  -d '{"username":"alpha_private","password":"AlphaSocial!23"}' >/dev/null
curl -s -c /tmp/newb.txt -X POST https://kink.social/api/auth/session \
  -H 'Content-Type: application/json' \
  -d '{"username":"alpha_newbie","password":"AlphaSocial!23"}' >/dev/null

PRIV=$(curl -s -b /tmp/priv.txt "https://kink.social/api/v1/me/feed-posts?limit=50")
NEWB=$(curl -s -b /tmp/newb.txt "https://kink.social/api/v1/users/alpha_private/feed-posts?limit=50")

node -e "
const priv=JSON.parse(process.argv[1]);
const newb=JSON.parse(process.argv[2]);
const onlyMe=(priv.items||[]).filter(p=>String(p.body||'').includes('only-me')||String(p.visibility||'').includes('ONLY'));
const leaked=(newb.items||[]).filter(p=>String(p.body||'').includes('only-me'));
console.log('private_author_only_me_posts', onlyMe.length);
console.log('newbie_sees_private_only_me', leaked.length);
" "$PRIV" "$NEWB"

curl -s -o /tmp/profiles.json -w "profiles_search=%{http_code}\n" -b /tmp/priv.txt "https://kink.social/api/v1/profiles?q=alpha_hidden&limit=10"
head -c 200 /tmp/profiles.json; echo

curl -s -o /tmp.mod.json -w "mod_cases=%{http_code}\n" -b /tmp/priv.txt "https://kink.social/api/v1/moderation/cases?limit=3"
head -c 200 /tmp/mod.json; echo
