#!/usr/bin/env bash
# Public Alpha Promotion Gate Pass 2 — media privacy + upload + private group smoke (no DB writes).
set -euo pipefail

BASE="https://kink.social"
PASS="${ALPHA_SOCIAL_SEED_PASSWORD:-AlphaSocial!23}"
STAFF_USER="${STAFF_SMOKE_USER:-}"
STAFF_PASS="${STAFF_SMOKE_PASSWORD:-}"

echo "==> Promotion Gate Pass 2 media smoke"
echo "timestamp_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# --- login helpers ---
login() {
  local user="$1" jar="$2"
  local code
  code=$(curl -s -c "$jar" -o /tmp/login-body.json -w "%{http_code}" -X POST "$BASE/api/auth/session" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$user\",\"password\":\"$PASS\"}")
  echo "login_${user}_http=${code}"
  test "$code" = "200"
}

JAR_SOCIAL=/tmp/pg2-social.txt
JAR_HIDDEN=/tmp/pg2-hidden.txt
JAR_NEWB=/tmp/pg2-newb.txt
rm -f "$JAR_SOCIAL" "$JAR_HIDDEN" "$JAR_NEWB"

login alpha_social "$JAR_SOCIAL"
login alpha_hidden_member "$JAR_HIDDEN"
login alpha_newbie "$JAR_NEWB"

# --- profile photo DTO should use proxy for LOGGED_IN ---
PHOTOS=$(curl -s -b "$JAR_SOCIAL" "$BASE/api/profile/me/photos")
echo "profile_photos_head=$(echo "$PHOTOS" | head -c 400)"

node -e "
const data = JSON.parse(process.argv[1]);
const photos = data.photos || data.items || [];
const p = photos[0];
if (!p) { console.log('profile_photo_count=0'); process.exit(0); }
console.log('profile_photo_visibility', p.visibility);
console.log('profile_photo_url', p.url);
const isProxy = /^\\/api\\/v1\\/media\\/assets\\/[0-9a-f-]{36}\\/content/.test(p.url || '');
const isDirect = /\\/c2k-uploads\\/media\\//.test(p.url || '');
console.log('profile_photo_url_is_proxy', isProxy);
console.log('profile_photo_url_is_direct_public', isDirect);
if (p.visibility === 'LOGGED_IN' && isDirect) process.exit(2);
if (p.visibility === 'LOGGED_IN' && !isProxy && p.url) process.exit(3);
" "$PHOTOS"

# Extract media asset id from proxy URL or stored photo
MEDIA_ID=$(node -e "
const data = JSON.parse(process.argv[1]);
const p = (data.photos || data.items || [])[0];
if (!p) process.exit(0);
const m = String(p.url||'').match(/\\/api\\/v1\\/media\\/assets\\/([0-9a-f-]{36})\\/content/);
if (m) { console.log(m[1]); return; }
console.log(p.mediaAssetId || '');
" "$PHOTOS")

# Fallback: direct URL from Pass 1 if still stored
DIRECT_URL=$(node -e "
const data = JSON.parse(process.argv[1]);
const p = (data.photos || data.items || [])[0];
if (!p) process.exit(0);
const u = String(p.url||'');
if (u.includes('/c2k-uploads/media/')) console.log(u.startsWith('http') ? u : '$BASE' + u);
" "$PHOTOS")

if [[ -n "$MEDIA_ID" ]]; then
  ANON_PROXY=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/v1/media/assets/$MEDIA_ID/content")
  AUTH_PROXY=$(curl -s -b "$JAR_SOCIAL" -o /dev/null -w "%{http_code}" "$BASE/api/v1/media/assets/$MEDIA_ID/content")
  echo "anon_media_proxy_http=${ANON_PROXY}"
  echo "auth_media_proxy_http=${AUTH_PROXY}"
fi

# If we know a legacy direct URL pattern, probe anon (may still 200 on MinIO — document honestly)
if [[ -n "$DIRECT_URL" ]]; then
  LEGACY_ANON=$(curl -s -o /dev/null -w "%{http_code}" "$DIRECT_URL")
  echo "legacy_direct_url_anon_http=${LEGACY_ANON}"
  echo "legacy_direct_url=${DIRECT_URL}"
fi

# --- feed media upload (safe 1x1 PNG) ---
PNG_B64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
UPLOAD=$(curl -s -b "$JAR_SOCIAL" -X POST "$BASE/api/upload" \
  -H 'Content-Type: application/json' \
  -d "{\"purpose\":\"feed_media\",\"filename\":\"pg2-test.png\",\"contentType\":\"image/png\",\"dataBase64\":\"$PNG_B64\"}")
echo "feed_upload_head=$(echo "$UPLOAD" | head -c 300)"

node -e "
const u = JSON.parse(process.argv[1]);
console.log('feed_upload_ok', Boolean(u.storageKey || u.key || u.quarantineKey));
console.log('feed_upload_storageKey', u.storageKey || u.key || u.quarantineKey || 'none');
" "$UPLOAD" || echo "feed_upload_parse_failed"

# --- private group via /api/v1/me/groups ---
HIDDEN_GROUPS=$(curl -s -b "$JAR_HIDDEN" "$BASE/api/v1/me/groups")
NEWB_GROUPS=$(curl -s -b "$JAR_NEWB" "$BASE/api/v1/me/groups")

node -e "
const hidden = JSON.parse(process.argv[1]);
const newbie = JSON.parse(process.argv[2]);
const list = (x) => (x.groups || x.items || x || []);
const h = list(hidden).find(g => (g.slug||'').includes('alpha-social-private-circle') || (g.name||'').includes('Private Circle'));
const n = list(newbie).find(g => (g.slug||'').includes('alpha-social-private-circle'));
console.log('hidden_member_private_group', Boolean(h));
console.log('newbie_private_group_in_mine', Boolean(n));
if (h) console.log('private_group_slug', h.slug || h.id);
" "$HIDDEN_GROUPS" "$NEWB_GROUPS"

PRIV_SLUG=$(node -e "
const hidden = JSON.parse(process.argv[1]);
const list = (x) => (x.groups || x.items || x || []);
const h = list(hidden).find(g => (g.slug||'').includes('alpha-social-private-circle'));
if (h) console.log(h.slug || h.id);
" "$HIDDEN_GROUPS")

if [[ -n "$PRIV_SLUG" ]]; then
  MEM_THREADS=$(curl -s -b "$JAR_HIDDEN" -o /tmp/pg2-forum-member.json -w "%{http_code}" \
    "$BASE/api/v1/groups/$PRIV_SLUG/forum/threads?limit=5")
  NON_THREADS=$(curl -s -b "$JAR_NEWB" -o /tmp/pg2-forum-non.json -w "%{http_code}" \
    "$BASE/api/v1/groups/$PRIV_SLUG/forum/threads?limit=5")
  ANON_GROUP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/v1/groups/$PRIV_SLUG")
  echo "member_forum_threads_http=${MEM_THREADS}"
  echo "nonmember_forum_threads_http=${NON_THREADS}"
  echo "anon_group_detail_http=${ANON_GROUP}"
  head -c 200 /tmp/pg2-forum-member.json; echo
  head -c 200 /tmp/pg2-forum-non.json; echo
fi

# --- staff moderation (optional) ---
if [[ -n "$STAFF_USER" && -n "$STAFF_PASS" ]]; then
  JAR_STAFF=/tmp/pg2-staff.txt
  STAFF_HTTP=$(curl -s -c "$JAR_STAFF" -o /tmp/staff-login.json -w "%{http_code}" -X POST "$BASE/api/auth/session" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$STAFF_USER\",\"password\":\"$STAFF_PASS\"}")
  echo "staff_login_http=${STAFF_HTTP}"
  MOD_PAGE=$(curl -s -b "$JAR_STAFF" -o /dev/null -w "%{http_code}" "$BASE/moderation")
  MOD_CASES=$(curl -s -b "$JAR_STAFF" -o /tmp/mod-cases.json -w "%{http_code}" "$BASE/api/v1/moderation/cases?limit=3")
  NON_MOD=$(curl -s -b "$JAR_SOCIAL" -o /dev/null -w "%{http_code}" "$BASE/api/v1/moderation/cases?limit=3")
  echo "staff_moderation_page_http=${MOD_PAGE}"
  echo "staff_mod_cases_http=${MOD_CASES}"
  echo "nonstaff_mod_cases_http=${NON_MOD}"
else
  echo "staff_smoke=BLOCKED_missing_STAFF_SMOKE_USER_or_STAFF_SMOKE_PASSWORD"
fi

echo "PROMOTION_GATE_PASS2_MEDIA_COMPLETE"
