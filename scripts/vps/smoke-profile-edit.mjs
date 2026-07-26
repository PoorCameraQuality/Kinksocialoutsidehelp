/**
 * Smoke test profile edit APIs on production (or any SITE_URL).
 * Usage: node scripts/vps/smoke-profile-edit.mjs
 */
const SITE = process.env.SITE_URL ?? 'https://kink.social'
const USER = process.env.SMOKE_USER ?? 'Brax'
const PASS = process.env.SMOKE_PASS ?? 'Airshipknight!2'

function parseCookies(setCookie) {
  const jar = new Map()
  const lines = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []
  for (const line of lines) {
    const part = line.split(';')[0]
    const i = part.indexOf('=')
    if (i > 0) jar.set(part.slice(0, i), part.slice(i + 1))
  }
  return jar
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

async function req(path, { method = 'GET', body, jar } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (jar?.size) headers.Cookie = cookieHeader(jar)
  const r = await fetch(`${SITE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  const text = await r.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text.slice(0, 500) }
  }
  const setCookie = r.headers.getSetCookie?.() ?? []
  return { status: r.status, json, setCookie }
}

const jar = new Map()

console.log('==> Login')
const login = await req('/api/auth/session', {
  method: 'POST',
  body: { username: USER, password: PASS },
})
for (const [k, v] of parseCookies(login.setCookie)) jar.set(k, v)
console.log('login', login.status, login.json?.authenticated ?? login.json?.error)

if (login.status !== 200) process.exit(1)

console.log('==> GET /api/profile/me')
const before = await req('/api/profile/me', { jar })
console.log('profile/me', before.status)
const lookingBefore = before.json?.lookingFor ?? before.json?.profile?.lookingFor ?? []
console.log('lookingFor before:', JSON.stringify(lookingBefore))

const testGoal = 'Friendship'
const nextLooking = lookingBefore.includes(testGoal)
  ? lookingBefore.filter((g) => g !== testGoal)
  : [...lookingBefore, testGoal]

console.log('==> PATCH /api/profile/me lookingFor')
const patch = await req('/api/profile/me', {
  method: 'PATCH',
  jar,
  body: { lookingFor: nextLooking },
})
console.log('patch', patch.status, patch.json?.error ?? 'ok')
if (patch.status !== 200) {
  console.log('patch body', JSON.stringify(patch.json, null, 2))
  process.exit(1)
}

console.log('==> GET /api/profile/me (verify)')
const after = await req('/api/profile/me', { jar })
const lookingAfter = after.json?.lookingFor ?? after.json?.profile?.lookingFor ?? []
console.log('lookingFor after:', JSON.stringify(lookingAfter))
const ok = JSON.stringify([...lookingAfter].sort()) === JSON.stringify([...nextLooking].sort())
console.log(ok ? 'PASS: lookingFor persisted' : 'FAIL: lookingFor mismatch')

// Restore original
await req('/api/profile/me', { method: 'PATCH', jar, body: { lookingFor: lookingBefore } })

console.log('==> Photo upload pipeline (minimal 1x1 PNG)')
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const fd = new FormData()
fd.append('file', new Blob([png], { type: 'image/png' }), 'smoke.png')
fd.append('purpose', 'profile_photo')
const uploadR = await fetch(`${SITE}/api/upload`, {
  method: 'POST',
  credentials: 'include',
  headers: { Cookie: cookieHeader(jar) },
  body: fd,
})
const uploadJ = await uploadR.json().catch(() => ({}))
console.log('upload', uploadR.status, uploadJ.error ?? uploadJ.quarantineKey ?? uploadJ.code)
if (!uploadR.ok) {
  console.log('upload detail', JSON.stringify(uploadJ, null, 2))
  process.exit(1)
}

console.log('==> POST /api/profile/me/photos')
const attachR = await fetch(`${SITE}/api/profile/me/photos`, {
  method: 'POST',
  credentials: 'include',
  headers: { Cookie: cookieHeader(jar), 'Content-Type': 'application/json' },
  body: JSON.stringify({
    quarantineKey: uploadJ.quarantineKey ?? uploadJ.key,
    sha256Hash: uploadJ.sha256,
    mimeType: uploadJ.mimeType ?? 'image/png',
    sizeBytes: uploadJ.sizeBytes ?? png.length,
    originalFilename: 'smoke.png',
    sortOrder: 0,
  }),
})
const attachJ = await attachR.json().catch(() => ({}))
console.log('attach', attachR.status, attachJ.error ?? attachJ.code ?? attachJ.photo?.uploadStatus)
if (!attachR.ok) {
  console.log('attach detail', JSON.stringify(attachJ, null, 2))
  process.exit(1)
}
console.log('photo url', attachJ.photo?.url?.slice(0, 80))
console.log('DONE')
