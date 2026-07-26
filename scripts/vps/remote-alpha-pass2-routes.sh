#!/usr/bin/env bash
set -euo pipefail
curl -s -c /tmp/cj.txt -X POST https://kink.social/api/auth/session \
  -H 'Content-Type: application/json' \
  -d '{"username":"alpha_social","password":"AlphaSocial!23"}' >/dev/null
curl -s -o /tmp/x.json -w "connections=%{http_code}\n" -b /tmp/cj.txt "https://kink.social/api/v1/connections"
head -c 250 /tmp/x.json; echo
curl -s -o /tmp/y.json -w "feed_following=%{http_code}\n" -b /tmp/cj.txt "https://kink.social/api/v1/feed/following?limit=3"
head -c 250 /tmp/y.json; echo
curl -s -o /tmp/me.json -w "me_feed_posts=%{http_code}\n" -b /tmp/cj.txt "https://kink.social/api/v1/me/feed-posts?limit=3"
head -c 250 /tmp/me.json; echo
