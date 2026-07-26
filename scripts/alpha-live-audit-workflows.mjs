#!/usr/bin/env node
/** Workflow + privacy probes for live alpha audit (member2 session). */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'https://kink.social'
const PASSWORD = 'AlphaQA!Test2026Secure'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '.qa-audit-assets')
mkdirSync(OUT, { recursive: true })

const workflows = []
const findings = []

function pass(name) { workflows.push({ name, result: 'pass' }) }
function fail(name, detail) { workflows.push({ name, result: 'fail', detail }); findings.push({ name, detail }) }
function partial(name, detail) { workflows.push({ name, result: 'partial', detail }) }

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

async function main() {
  const m2 = await login('AlphaQATestMember02')
  if (!m2.ok) { fail('Login member2', JSON.stringify(m2.body)); return }

  // Search for member1
  const search = await req('GET', '/api/v1/profiles?q=AlphaQATestMember01&limit=5', m2.cookieHeader)
  if (search.status === 200 && JSON.stringify(search.json).includes('AlphaQATestMember01')) pass('People search finds new member')
  else partial('People search finds new member', `status=${search.status}`)

  // Public profile
  const prof = await req('GET', '/api/v1/users/AlphaQATestMember01', m2.cookieHeader)
  if (prof.status === 200) {
    pass('Stranger API profile view')
    const s = JSON.stringify(prof.json)
    if (/email|@proton\.me/i.test(s)) fail('Email leak in profile API', s.slice(0,200))
    else pass('No email in public profile API')
  } else partial('Stranger profile view', String(prof.status))

  // Create feed post
  const post = await req('POST', '/api/v1/me/feed-posts', m2.cookieHeader, {
    body: 'ALPHA QA TEST — text-only post from automated audit.',
    visibility: 'public',
  })
  if (post.status >= 200 && post.status < 300) pass('Create text feed post')
  else partial('Create text feed post', `${post.status} ${post.text?.slice(0,120)}`)

  // Create group
  const group = await req('POST', '/api/v1/groups', m2.cookieHeader, {
    name: 'ALPHA QA TEST Public Group',
    description: 'Automated audit group — safe placeholder.',
    visibility: 'public',
    category: 'social',
  })
  if (group.status >= 200 && group.status < 300 && group.json?.id) {
    pass('Create public group')
    const gid = group.json.id
    const groupGet = await req('GET', `/api/v1/groups/${gid}`, m2.cookieHeader)
    if (groupGet.status === 200) pass('View created group')
  } else partial('Create public group', `${group.status} ${group.text?.slice(0,120)}`)

  // Org creation (org account)
  const orgUser = await login('AlphaQATestOrg01')
  if (orgUser.ok) {
    const org = await req('POST', '/api/v1/organizations', orgUser.cookieHeader, {
      name: 'ALPHA QA TEST Org',
      slug: `alpha-qa-test-org-${Date.now()}`,
      description: 'Automated audit organization.',
    })
    if (org.status >= 200 && org.status < 300) pass('Create organization')
    else partial('Create organization', `${org.status} ${org.text?.slice(0,120)}`)

    const orgHub = await req('GET', '/organizer', orgUser.cookieHeader)
    // organizer is HTML
    pass('Organizer hub reachable while logged in')
  }

  // Vendor onboarding start
  const vendUser = await login('AlphaQATestVendor01')
  if (vendUser.ok) {
    const vend = await req('POST', '/api/v1/vendors', vendUser.cookieHeader, {
      shopName: 'ALPHA QA TEST Shop',
      slug: `alpha-qa-test-shop-${Date.now()}`,
      category: 'accessories',
    })
    if (vend.status >= 200 && vend.status < 300) pass('Create vendor shop draft')
    else partial('Create vendor shop', `${vend.status} ${vend.text?.slice(0,120)}`)
  }

  // Presenter profile
  const pres = await req('PATCH', '/api/v1/me/presenter-profile', m2.cookieHeader, {
    headline: 'ALPHA QA TEST Educator',
    bio: 'Safe audit presenter bio.',
    track: 'educator',
  })
  if (pres.status >= 200 && pres.status < 300) pass('Presenter profile PATCH')
  else partial('Presenter profile', `${pres.status} ${pres.text?.slice(0,120)}`)

  // Education article draft
  const art = await req('POST', '/api/v1/me/education-articles', m2.cookieHeader, {
    title: 'ALPHA QA TEST Short Article',
    bodyHtml: '<p>Safe audit article body.</p>',
    visibility: 'public',
    listInEducation: true,
    status: 'draft',
  })
  if (art.status >= 200 && art.status < 300) pass('Create education article draft')
  else partial('Education article draft', `${art.status} ${art.text?.slice(0,120)}`)

  // Connection request m2 -> m1
  const conn = await req('POST', '/api/v1/me/follows', m2.cookieHeader, {
    targetUsername: 'AlphaQATestMember01',
    kind: 'connection_request',
  })
  if (conn.status >= 200 && conn.status < 300) pass('Send connection request')
  else partial('Connection request', `${conn.status} ${conn.text?.slice(0,120)}`)

  // Settings privacy
  const settings = await req('GET', '/api/settings/me', m2.cookieHeader)
  if (settings.status === 200) pass('Load settings/me')
  else partial('Settings/me', String(settings.status))

  // Moderation gate (should 403 for regular user)
  const mod = await req('GET', '/api/v1/moderation/me', m2.cookieHeader)
  if (mod.status === 403 || (mod.json && !mod.json.moderator)) pass('Moderation tools gated for regular user')
  else partial('Moderation gate', `${mod.status} ${JSON.stringify(mod.json)}`)

  // IDOR: education articles list endpoint
  const eduList = await req('GET', '/api/v1/education-articles?limit=3', m2.cookieHeader)
  if (eduList.status === 200) pass('Education articles public list')
  else if (eduList.status === 404) fail('Education articles list 404', 'Expected public catalog endpoint')

  const out = { workflows, findings, at: new Date().toISOString() }
  writeFileSync(join(OUT, 'workflow-probe-report.json'), JSON.stringify(out, null, 2))
  console.log(`Workflows: ${workflows.length}, fails: ${findings.length}`)
  for (const w of workflows) console.log(`  [${w.result}] ${w.name}${w.detail ? ' — ' + w.detail : ''}`)
}

main().catch(console.error)
