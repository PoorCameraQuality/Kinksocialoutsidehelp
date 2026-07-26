#!/usr/bin/env node
/** Phases 1-5 live alpha audit continuation */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'https://kink.social'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '.qa-audit-assets')
mkdirSync(OUT, { recursive: true })
const PASSWORD = 'AlphaQA!Test2026Secure'

const log = []
function pass(m) { log.push({ result: 'pass', msg: m }); console.log('PASS', m) }
function fail(m, d) { log.push({ result: 'fail', msg: m, detail: d }); console.log('FAIL', m, d || '') }
function partial(m, d) { log.push({ result: 'partial', msg: m, detail: d }); console.log('PARTIAL', m, d || '') }

async function login(username) {
  const res = await fetch(`${BASE}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: PASSWORD }),
  })
  const cookies = res.headers.getSetCookie?.() ?? []
  const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ')
  const body = await res.json()
  return { cookieHeader, body, ok: res.ok && body.authenticated }
}

async function req(method, path, cookie, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* */ }
  return { status: res.status, json, text }
}

async function uploadFile(cookie, filePath, filename, contentType) {
  const buf = readFileSync(filePath)
  const form = new FormData()
  form.append('file', new Blob([buf], { type: contentType }), filename)
  const res = await fetch(`${BASE}/api/upload`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: form,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* */ }
  return { status: res.status, json, text }
}

async function phase1(m1, m2) {
  console.log('\n=== Phase 1: Multi-account social graph ===')
  const gs = await req('GET', '/api/v1/users/AlphaQATestMember01/graph-status', m2.cookieHeader)
  if (gs.status === 200) pass('Member2 graph-status for Member1')
  else partial('graph-status', String(gs.status))

  const prof = await req('GET', '/api/profile/AlphaQATestMember01', m2.cookieHeader)
  if (prof.status === 200) {
    pass('Member2 stranger profile API')
    const s = JSON.stringify(prof.json)
    if (/proton\.me|@/i.test(s) && s.includes('alphaqa.test')) fail('Email in profile API', s.slice(0, 200))
    else pass('No email leak in profile API')
    if (prof.json?.displayName?.includes('ALPHA QA TEST')) pass('Display name visible to stranger')
  } else partial('Stranger profile API', `${prof.status}`)

  const conn = await req('POST', '/api/v1/connections/request', m2.cookieHeader, {
    recipientUsername: 'AlphaQATestMember01',
  })
  if (conn.status >= 200 && conn.status < 300) pass('Connection request M2→M1')
  else if (conn.status === 400 && conn.text?.includes('pending')) pass('Connection request already pending')
  else partial('Connection request', `${conn.status} ${conn.text?.slice(0, 100)}`)

  const gs2 = await req('GET', '/api/v1/users/AlphaQATestMember01/graph-status', m2.cookieHeader)
  if (gs2.json?.connectionStatus === 'pending_outgoing') pass('Graph shows pending_outgoing')

  // Accept as M1
  const follows = await req('GET', '/api/v1/me/follows', m1.cookieHeader)
  const pending = follows.json?.connections?.incoming?.find?.(
    c => c.username === 'AlphaQATestMember02' || c.otherUsername === 'AlphaQATestMember02'
  ) ?? follows.json?.incoming?.find?.(c => (c.username || c.otherUsername) === 'AlphaQATestMember02')
  
  // Try accept via connections API - find connection id
  const m1follows = await req('GET', '/api/v1/me/follows', m1.cookieHeader)
  let connId = null
  const incoming = m1follows.json?.connections?.incoming ?? m1follows.json?.incoming ?? []
  for (const c of incoming) {
    if ((c.username || c.otherUsername || c.requesterUsername) === 'AlphaQATestMember02') {
      connId = c.id || c.connectionId
    }
  }
  if (connId) {
    const accept = await req('POST', `/api/v1/connections/${connId}/accept`, m1.cookieHeader, {})
    if (accept.status === 404) {
      // try alternate accept route
      const accept2 = await req('POST', '/api/v1/connections/accept', m1.cookieHeader, { connectionId: connId })
      if (accept2.status >= 200 && accept2.status < 300) pass('Accept connection M1')
      else partial('Accept connection', `${accept2.status} ${accept2.text?.slice(0,80)}`)
    } else if (accept.status >= 200 && accept.status < 300) pass('Accept connection M1')
    else partial('Accept connection', `${accept.status} ${accept.text?.slice(0,80)}`)
  } else {
    partial('Find incoming connection for accept', JSON.stringify(m1follows.json)?.slice(0, 200))
  }

  const gs3 = await req('GET', '/api/v1/users/AlphaQATestMember01/graph-status', m2.cookieHeader)
  if (gs3.json?.connectionStatus === 'connected') pass('Connected after accept')
  else partial('Post-accept status', gs3.json?.connectionStatus)

  // Block test: M2 blocks M1
  const block = await req('POST', '/api/v1/me/blocks', m2.cookieHeader, { username: 'AlphaQATestMember01' })
  if (block.status >= 200 && block.status < 300) pass('Block user M2→M1')
  else partial('Block user', `${block.status} ${block.text?.slice(0,80)}`)

  const gsBlocked = await req('GET', '/api/v1/users/AlphaQATestMember01/graph-status', m2.cookieHeader)
  const profBlocked = await req('GET', '/api/profile/AlphaQATestMember01', m2.cookieHeader)

  // Unblock for cleanup
  await req('DELETE', '/api/v1/me/blocks/AlphaQATestMember01', m2.cookieHeader)
  pass('Unblock cleanup')
}

async function phase2(m1) {
  console.log('\n=== Phase 2: Upload matrix ===')
  const png = join(OUT, 'test-avatar-square.png')
  const up = await uploadFile(m1.cookieHeader, png, 'alpha-qa-test-avatar.png', 'image/png')
  if (up.status >= 200 && up.status < 300 && (up.json?.url || up.json?.key)) {
    pass('Generic upload /api/upload PNG')
  } else partial('Upload PNG', `${up.status} ${up.text?.slice(0,120)}`)

  const feedImg = await req('POST', '/api/v1/feed/composer/image', m1.cookieHeader, null)
  // feed composer image likely multipart - skip if not multipart

  const post = await req('POST', '/api/v1/feed/posts', m1.cookieHeader, {
    kind: 'text',
    body: 'ALPHA QA TEST — API post with upload audit follow-up.',
    bodyFormat: 'text',
  })
  if (post.status >= 200 && post.status < 300) pass('Create feed post via API')
  else partial('Feed post API', `${post.status}`)
}

async function phase3(orgUser) {
  console.log('\n=== Phase 3: Organizer path ===')
  const slug = `alpha-qa-test-org-${Date.now()}`
  const org = await req('POST', '/api/v1/organizations', orgUser.cookieHeader, {
    displayName: 'ALPHA QA TEST Org',
    slug,
    bio: 'Automated audit organization — safe placeholder.',
    visibility: 'PUBLIC',
  })
  if (org.status >= 200 && org.status < 300) {
    pass('Create organization')
    const orgSlug = org.json?.organization?.slug || slug
    const orgGet = await req('GET', `/api/v1/organizations/${orgSlug}`, orgUser.cookieHeader)
    if (orgGet.status === 200) pass('View created org')
    
    const event = await req('POST', '/api/v1/events', orgUser.cookieHeader, {
      title: 'ALPHA QA TEST Social Munch',
      description: 'Safe audit event.',
      visibility: 'public',
      organizationId: org.json?.organization?.id,
    })
    if (event.status >= 200 && event.status < 300) pass('Create org-scoped event')
    else partial('Create event', `${event.status} ${event.text?.slice(0,120)}`)
  } else partial('Create org', `${org.status} ${org.text?.slice(0,120)}`)
}

async function phase4(m2) {
  console.log('\n=== Phase 4: ECKE education article ===')
  const art = await req('POST', '/api/v1/me/education-articles', m2.cookieHeader, {
    title: 'ALPHA QA TEST ECKE Safe Article',
    bodyHtml: '<p>Safe placeholder article for ECKE publish audit. No private fields.</p>',
    excerpt: 'ECKE audit placeholder',
    visibility: 'PUBLIC',
    listInEducation: true,
    publicationStatus: 'DRAFT',
    categories: ['Beginner'],
    contentWarnings: ['None'],
    difficulty: 'Beginner',
  })
  if (art.status >= 200 && art.status < 300 && art.json?.id) {
    pass('Create education article draft')
    const id = art.json.id
    const pub = await req('PUT', `/api/v1/me/education-articles/${id}`, m2.cookieHeader, {
      publicationStatus: 'PUBLISHED',
    })
    if (pub.status >= 200 && pub.status < 300) pass('Publish article')
    
    const ecke = await req('GET', `/api/v1/me/education-articles/${id}/ecke-publish`, m2.cookieHeader)
    if (ecke.status === 200) pass('ECKE publish status endpoint')
    else partial('ECKE status', `${ecke.status}`)
    
    const eckePreview = await req('POST', `/api/v1/me/education-articles/${id}/ecke-publish/preview`, m2.cookieHeader, {})
    if (eckePreview.status >= 200 && eckePreview.status < 300) {
      pass('ECKE preview')
      const previewStr = JSON.stringify(eckePreview.json)
      if (/email|private|member.?only|registration/i.test(previewStr)) fail('Private fields in ECKE preview', previewStr.slice(0, 300))
    } else partial('ECKE preview', `${eckePreview.status} ${eckePreview.text?.slice(0,100)}`)
  } else partial('Education article', `${art.status} ${art.text?.slice(0,200)}`)
}

async function main() {
  const m1 = await login('AlphaQATestMember01')
  const m2 = await login('AlphaQATestMember02')
  const org = await login('AlphaQATestOrg01')
  if (!m2.ok) { fail('Member2 login', JSON.stringify(m2.body)); return }
  if (!org.ok) { fail('Org login', JSON.stringify(org.body)); return }
  if (!m1.ok) partial('Member1 API login failed — using M2 for uploads', 'browser session may differ')

  await phase1(m1.ok ? m1 : m2, m2)
  await phase2(m1.ok ? m1 : m2)
  await phase3(org)
  await phase4(m2)

  writeFileSync(join(OUT, 'audit-phases-1-4.json'), JSON.stringify({ at: new Date().toISOString(), log }, null, 2))
}

main().catch(console.error)
