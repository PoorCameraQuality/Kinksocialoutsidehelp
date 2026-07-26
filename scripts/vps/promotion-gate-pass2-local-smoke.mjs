/** Local promotion gate pass 2 smoke (no secrets logged). */
const BASE = 'https://kink.social'
const PASS = process.env.ALPHA_SOCIAL_SEED_PASSWORD || 'AlphaSocial!23'
const STAFF_USER = process.env.STAFF_SMOKE_USER || ''
const STAFF_PASS = process.env.STAFF_SMOKE_PASSWORD || ''

async function login(user, jar = {}) {
  const res = await fetch(`${BASE}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader(jar) },
    body: JSON.stringify({ username: user, password: PASS }),
  })
  storeCookies(res, jar)
  return res.status
}

function cookieHeader(jar) {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

function storeCookies(res, jar) {
  const raw = res.headers.getSetCookie?.() ?? []
  for (const line of raw) {
    const part = line.split(';')[0]
    const eq = part.indexOf('=')
    if (eq > 0) jar[part.slice(0, eq)] = part.slice(eq + 1)
  }
}

async function get(path, jar) {
  const res = await fetch(`${BASE}${path}`, { headers: { Cookie: cookieHeader(jar) } })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* ignore */
  }
  return { status: res.status, json, text }
}

async function main() {
  const social = {}
  const hidden = {}
  const newbie = {}

  console.log('login_alpha_social', await login('alpha_social', social))
  console.log('login_alpha_hidden_member', await login('alpha_hidden_member', hidden))
  console.log('login_alpha_newbie', await login('alpha_newbie', newbie))

  const mediaId = 'f3732a5d-a8f6-45ae-8bcd-c82101ecfedf'
  const anonProxy = await get(`/api/v1/media/assets/${mediaId}/content`, {})
  console.log('anon_media_proxy_http', anonProxy.status)
  const authProxy = await get(`/api/v1/media/assets/${mediaId}/content`, social)
  console.log('auth_media_proxy_http', authProxy.status)

  const photos = await get('/api/profile/me/photos', social)
  const p = photos.json?.photos?.[0]
  if (p) {
    console.log('profile_photo_url', p.url)
    console.log('profile_photo_visibility', p.visibility)
    console.log('profile_photo_is_proxy', /^\/api\/v1\/media\/assets\//.test(p.url))
  }

  // Legacy MinIO path from Pass 1 upload (alpha_social user) — may still be world-readable if URL known
  const legacyUrl = `${BASE}/c2k-uploads/media/`
  // probe pattern: fetch profile for user id from API
  const prof = await get('/api/profile/me', social)
  const userId = prof.json?.userId || prof.json?.profile?.userId
  if (userId) {
    const direct = `${BASE}/c2k-uploads/media/${userId}/${mediaId}.png`
    const directRes = await fetch(direct)
    console.log('legacy_direct_url_anon_http', directRes.status)
    console.log('legacy_direct_url_probed', direct.replace(BASE, ''))
  }

  // feed upload
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  const form = new FormData()
  form.append('file', new Blob([png], { type: 'image/png' }), 'pg2-test.png')
  form.append('purpose', 'feed_image')
  const uploadRes = await fetch(`${BASE}/api/upload`, {
    method: 'POST',
    headers: { Cookie: cookieHeader(social) },
    body: form,
  })
  const uploadJson = await uploadRes.json().catch(() => ({}))
  console.log('feed_image_upload_http', uploadRes.status)
  console.log('feed_image_upload_code', uploadJson.code || uploadJson.error || 'ok')
  console.log('feed_upload_has_key', Boolean(uploadJson.storageKey || uploadJson.key || uploadJson.quarantineKey))

  // private group
  const myGroups = await get('/api/v1/me/groups', hidden)
  const groups = myGroups.json?.groups ?? myGroups.json?.items ?? myGroups.json ?? []
  const priv = groups.find((g) => (g.slug || '').includes('alpha-social-private-circle'))
  console.log('hidden_member_has_private_group', Boolean(priv))
  if (priv) {
    const slug = priv.slug || priv.id
    const memForum = await get(`/api/v1/groups/${slug}/forum/threads?limit=3`, hidden)
    const nonForum = await get(`/api/v1/groups/${slug}/forum/threads?limit=3`, newbie)
    const anonGroup = await get(`/api/v1/groups/${slug}`, {})
    console.log('private_group_slug', slug)
    console.log('member_forum_http', memForum.status)
    console.log('nonmember_forum_http', nonForum.status)
    console.log('anon_group_http', anonGroup.status)
  }

  // staff
  if (STAFF_USER && STAFF_PASS) {
    const staff = {}
    const staffLogin = await fetch(`${BASE}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: STAFF_USER, password: STAFF_PASS }),
    })
    storeCookies(staffLogin, staff)
    console.log('staff_login_http', staffLogin.status)
    const modCases = await get('/api/v1/moderation/cases?limit=3', staff)
    const nonMod = await get('/api/v1/moderation/cases?limit=3', social)
    console.log('staff_mod_cases_http', modCases.status)
    console.log('nonstaff_mod_cases_http', nonMod.status)
    const modPage = await fetch(`${BASE}/moderation`, { headers: { Cookie: cookieHeader(staff) } })
    console.log('staff_moderation_page_http', modPage.status)
  } else {
    console.log('staff_smoke', 'BLOCKED_missing_credentials')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
