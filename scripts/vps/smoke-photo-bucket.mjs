/**
 * End-to-end photo bucket + upload pipeline smoke (production or SITE_URL).
 * Usage: node scripts/vps/smoke-photo-bucket.mjs
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

const jar = new Map()

console.log('==> health/ready')
const ready = await fetch(`${SITE}/api/health/ready`).then((r) => r.json())
console.log(JSON.stringify(ready))
if (!ready.ok || ready.s3 !== 'ok') {
  console.error('FAIL: S3 not healthy')
  process.exit(1)
}

console.log('==> login')
const login = await fetch(`${SITE}/api/auth/session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: USER, password: PASS }),
})
for (const [k, v] of parseCookies(login.headers.getSetCookie?.() ?? [])) jar.set(k, v)
if (login.status !== 200) {
  console.error('FAIL: login', login.status)
  process.exit(1)
}

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

console.log('==> POST /api/upload')
const fd = new FormData()
fd.append('file', new Blob([png], { type: 'image/png' }), 'bucket-smoke.png')
fd.append('purpose', 'profile_photo')
const uploadR = await fetch(`${SITE}/api/upload`, {
  method: 'POST',
  headers: { Cookie: cookieHeader(jar) },
  body: fd,
})
const uploadJ = await uploadR.json().catch(() => ({}))
console.log('upload', uploadR.status, uploadJ.error ?? uploadJ.quarantineKey?.slice(0, 48) ?? uploadJ.code)
if (!uploadR.ok) {
  console.error('FAIL: upload', JSON.stringify(uploadJ, null, 2))
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
    originalFilename: 'bucket-smoke.png',
    sortOrder: 0,
  }),
})
const attachJ = await attachR.json().catch(() => ({}))
console.log('attach', attachR.status, attachJ.error ?? attachJ.photo?.uploadStatus)
if (!attachR.ok) {
  console.error('FAIL: attach', JSON.stringify(attachJ, null, 2))
  process.exit(1)
}

const photoUrl = attachJ.photo?.url
if (!photoUrl?.startsWith('http')) {
  console.error('FAIL: no public photo URL', photoUrl)
  process.exit(1)
}

console.log('==> HEAD public object', photoUrl.slice(0, 80))
const head = await fetch(photoUrl, { method: 'HEAD' })
console.log('public', head.status, head.headers.get('content-type'))
if (!head.ok) {
  console.error('FAIL: public URL not readable')
  process.exit(1)
}

console.log('PASS: photo bucket pipeline OK')
