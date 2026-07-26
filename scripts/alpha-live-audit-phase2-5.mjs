/**
 * Live alpha audit phases 2–5 (API + upload matrix). Read-only on non-test content.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'https://kink.social'
const PASSWORD = 'AlphaQA!Test2026Secure'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PNG = path.join(__dirname, '..', '.qa-audit-assets', 'test-avatar-square.png')
const report = { ts: new Date().toISOString(), phases: {} }

async function login(u) {
  const res = await fetch(`${BASE}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: PASSWORD }),
  })
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
  return { cookie, body: await res.json(), ok: res.ok }
}

async function req(method, p, cookie, body) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* */
  }
  return { status: res.status, json, text }
}

async function upload(cookie, purpose) {
  const buf = fs.readFileSync(PNG)
  const form = new FormData()
  form.append('purpose', purpose)
  form.append('file', new Blob([buf], { type: 'image/png' }), 'alpha-qa-test.png')
  const res = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: { Cookie: cookie }, body: form })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* */
  }
  return { status: res.status, json, text }
}

const m1 = await login('AlphaQATestMember01')
const m2 = await login('AlphaQATestMember02')
const org = await login('AlphaQATestOrg01')
report.logins = {
  m1: m1.body.authenticated ?? false,
  m2: m2.body.authenticated ?? false,
  org: org.body.authenticated ?? false,
}

// --- Phase 1 cont: connection + messaging ---
report.phases.connections = {}
let conns = await req('GET', '/api/v1/connections', m2.cookie)
const existing = conns.json?.items?.find((c) => c.otherPartyUsername === 'AlphaQATestMember01')
if (!existing || existing.status !== 'PENDING') {
  const reqConn = await req('POST', '/api/v1/connections/request', m2.cookie, {
    recipientUsername: 'AlphaQATestMember01',
  })
  report.phases.connections.request = reqConn
  conns = await req('GET', '/api/v1/connections', m2.cookie)
}

if (m1.ok) {
  const m1conns = await req('GET', '/api/v1/connections', m1.cookie)
  const pending = m1conns.json?.items?.find(
    (c) => c.otherPartyUsername === 'AlphaQATestMember02' && c.status === 'PENDING' && !c.isOutgoing,
  )
  if (pending) {
    report.phases.connections.accept = await req(
      'POST',
      `/api/v1/connections/${pending.id}/accept`,
      m1.cookie,
      {},
    )
  } else {
    report.phases.connections.accept = { skip: 'no pending for M1' }
  }
} else {
  report.phases.connections.accept = { skip: 'M1 API login failed' }
}

report.phases.connections.graphStatus = (
  await req('GET', '/api/v1/users/AlphaQATestMember01/graph-status', m2.cookie)
).json

report.phases.connections.publicProfile = await req('GET', '/api/profile/AlphaQATestMember01', m2.cookie)
report.phases.connections.dm = await req('POST', '/api/v1/conversations', m2.cookie, {
  participantUsername: 'AlphaQATestMember01',
})

// --- Phase 2: upload matrix ---
report.phases.uploads = {}
for (const purpose of ['profile_photo', 'feed_image', 'group_branding', 'event_cover', 'education_hero']) {
  report.phases.uploads[purpose] = await upload(m2.cookie, purpose)
}

// --- Phase 3: organizer ---
report.phases.organizer = {}
const orgs = await req('GET', '/api/v1/me/organizations', org.cookie)
report.phases.organizer.myOrgs = orgs.json
const orgId = orgs.json?.organizations?.[0]?.id ?? orgs.json?.items?.[0]?.id

if (orgId) {
  report.phases.organizer.orgEvent = await req('POST', '/api/v1/events', org.cookie, {
    title: 'ALPHA QA TEST Org Event',
    orgId,
    startsAt: new Date(Date.now() + 14 * 86400000).toISOString(),
    description: 'Safe audit org-scoped event',
    category: 'social',
    eventFormat: 'in-person',
    location: 'Philadelphia, PA',
  })
}

report.phases.organizer.conventionsList = await req('GET', '/api/v1/conventions', org.cookie)

// --- Phase 4: ECKE ---
report.phases.ecke = {}
const artId = '887d6cde-7699-4148-bf30-41ae39dea83f'
report.phases.ecke.put = await req('PUT', `/api/v1/me/education-articles/${artId}`, m2.cookie, {
  publicationStatus: 'PUBLISHED',
  listInEducation: true,
  eckePublish: true,
  categories: ['Beginner'],
  contentWarnings: ['None'],
  difficulty: 'Beginner',
})
report.phases.ecke.statusGet = await req('GET', `/api/v1/me/education-articles/${artId}/ecke-publish`, m2.cookie)
report.phases.ecke.publishPost = await req(
  'POST',
  `/api/v1/me/education-articles/${artId}/ecke-publish`,
  m2.cookie,
  {},
)
if (report.phases.ecke.publishPost.status < 400) {
  const preview = report.phases.ecke.publishPost.json?.preview ?? report.phases.ecke.publishPost.json
  report.phases.ecke.previewKeys = preview ? Object.keys(preview) : null
  report.phases.ecke.hasEmailInPreview = JSON.stringify(preview ?? {}).includes('@')
  report.phases.ecke.unpublish = await req(
    'DELETE',
    `/api/v1/me/education-articles/${artId}/ecke-publish`,
    m2.cookie,
  )
}

const out = path.join(__dirname, '..', '.qa-audit-assets', 'audit-phases-2-5.json')
fs.writeFileSync(out, JSON.stringify(report, null, 2))
console.log('Wrote', out)
console.log(JSON.stringify(report, null, 2))
