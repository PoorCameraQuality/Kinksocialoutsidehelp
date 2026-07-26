const BASE = 'https://kink.social'
const PASSWORD = 'AlphaQA!Test2026Secure'

async function login(u) {
  const res = await fetch(`${BASE}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: PASSWORD }),
  })
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
  return { cookie, body: await res.json(), ok: res.ok }
}

async function req(method, path, cookie, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* */ }
  return { status: res.status, json, text }
}

async function upload(cookie, purpose) {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const png = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.qa-audit-assets', 'test-avatar-square.png')
  const buf = fs.readFileSync(png)
  const form = new FormData()
  form.append('purpose', purpose)
  form.append('file', new Blob([buf], { type: 'image/png' }), 'alpha-qa-test.png')
  const res = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: { Cookie: cookie }, body: form })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* */ }
  return { status: res.status, json, text }
}

const m1 = await login('AlphaQATestMember01')
const m2 = await login('AlphaQATestMember02')
console.log('M1 login', m1.body.authenticated ? 'OK' : m1.body)
console.log('M2 login', m2.body.authenticated ? 'OK' : m2.body)

const conns = await req('GET', '/api/v1/connections', m1.cookie)
const pending = conns.json?.items?.find(
  (c) => c.otherPartyUsername === 'AlphaQATestMember02' && c.status === 'PENDING' && !c.isOutgoing,
)
if (pending) {
  const acc = await req('POST', `/api/v1/connections/${pending.id}/accept`, m1.cookie, {})
  console.log('Accept connection', acc.status, acc.text.slice(0, 100))
} else {
  console.log('No pending incoming for M1 from M2', conns.json?.items?.length)
}

const gs = await req('GET', '/api/v1/users/AlphaQATestMember01/graph-status', m2.cookie)
console.log('Graph status', gs.json)

const artId = '887d6cde-7699-4148-bf30-41ae39dea83f'
const pub = await req('PUT', `/api/v1/me/education-articles/${artId}`, m2.cookie, {
  publicationStatus: 'PUBLISHED',
  listInEducation: true,
})
console.log('Publish article', pub.status)

const ecke = await req('GET', `/api/v1/me/education-articles/${artId}/ecke-publish`, m2.cookie)
console.log('ECKE status GET', ecke.status, JSON.stringify(ecke.json)?.slice(0, 250))

const eckePub = await req('POST', `/api/v1/me/education-articles/${artId}/ecke-publish`, m2.cookie, {})
console.log('ECKE publish POST', eckePub.status, eckePub.text.slice(0, 250))

const ev = await req('POST', '/api/v1/events', m2.cookie, {
  title: 'ALPHA QA TEST Munch',
  startsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  description: 'Safe audit event',
  category: 'social',
  eventFormat: 'in-person',
  location: 'Philadelphia, PA',
})
console.log('Event create', ev.status, ev.text.slice(0, 200))

const post = await req('POST', '/api/v1/feed/posts', m2.cookie, { kind: 'status', body: 'ALPHA QA TEST API post' })
console.log('Feed post', post.status, post.text.slice(0, 120))

for (const purpose of ['profile_avatar', 'feed_image', 'group_banner']) {
  const up = await upload(m2.cookie, purpose)
  console.log(`Upload ${purpose}`, up.status, up.text.slice(0, 120))
}

// DM attempt
const dm = await req('POST', '/api/v1/conversations', m2.cookie, { recipientUsername: 'AlphaQATestMember01' })
console.log('Start DM', dm.status, dm.text.slice(0, 150))
