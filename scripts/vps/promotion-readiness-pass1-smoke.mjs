/**
 * Public alpha promotion readiness smoke (live kink.social).
 * Set STAFF_SMOKE_USER / STAFF_SMOKE_PASSWORD for staff checks (never commit secrets).
 */
const BASE = process.env.SMOKE_BASE || 'https://kink.social'
const ALPHA_PASS = process.env.ALPHA_SOCIAL_SEED_PASSWORD || 'AlphaSocial!23'
const STAFF_USER = process.env.STAFF_SMOKE_USER || 'Brax'
const STAFF_PASS = process.env.STAFF_SMOKE_PASSWORD || ''

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

async function login(user, pass, jar = {}) {
  const res = await fetch(`${BASE}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader(jar) },
    body: JSON.stringify({ username: user, password: pass }),
  })
  storeCookies(res, jar)
  return res.status
}

async function get(path, jar) {
  const res = await fetch(`${BASE}${path}`, { headers: { Cookie: cookieHeader(jar) } })
  let json = null
  try {
    json = await res.json()
  } catch {
    /* ignore */
  }
  return { status: res.status, json }
}

async function main() {
  const alpha = {}
  const staff = {}

  console.log('login_alpha_social', await login('alpha_social', ALPHA_PASS, alpha))
  console.log('login_staff', STAFF_PASS ? await login(STAFF_USER, STAFF_PASS, staff) : 'skipped_no_staff_pass')

  const modAlpha = await get('/api/v1/moderation/cases?limit=1', alpha)
  console.log('alpha_moderation_cases_http', modAlpha.status)

  if (STAFF_PASS) {
    const modStaff = await get('/api/v1/moderation/cases?limit=1', staff)
    console.log('staff_moderation_cases_http', modStaff.status)
    const reports = await get('/api/v1/moderation/reports?limit=1', staff)
    console.log('staff_moderation_reports_http', reports.status)
  }

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  const form = new FormData()
  form.append('file', new Blob([png], { type: 'image/png' }), 'promotion-readiness-test.png')
  form.append('purpose', 'feed_image')
  const uploadRes = await fetch(`${BASE}/api/upload`, {
    method: 'POST',
    headers: { Cookie: cookieHeader(alpha) },
    body: form,
  })
  const uploadJson = await uploadRes.json().catch(() => ({}))
  console.log('feed_image_upload_http', uploadRes.status)
  console.log('feed_image_has_quarantine', Boolean(uploadJson.quarantineKey || uploadJson.storageKey))
  console.log('feed_image_direct_url_exposed', Boolean(uploadJson.url && !String(uploadJson.url).includes('/api/v1/media/')))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
