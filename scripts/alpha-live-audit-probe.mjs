#!/usr/bin/env node
/**
 * Live alpha audit helper — route/API probes + multi-account checks.
 * Safe for production: read-mostly, creates only ALPHA QA TEST prefixed content when --create is passed.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.env.AUDIT_BASE ?? 'https://kink.social'
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '.qa-audit-assets')
mkdirSync(OUT_DIR, { recursive: true })

const PASSWORD = 'AlphaQA!Test2026Secure'
const ACCOUNTS = {
  member1: { username: 'AlphaQATestMember01', email: 'alphaqa.test.member01@proton.me' },
  member2: { username: 'AlphaQATestMember02', email: 'alphaqa.test.member02@proton.me' },
}

const PUBLIC_ROUTES = [
  '/', '/events', '/groups', '/conventions', '/people', '/explore', '/education',
  '/vendors', '/presenters', '/places', '/orgs', '/about', '/support', '/privacy',
  '/terms', '/guidelines', '/policies', '/login', '/messaging', '/home', '/media',
  '/connections', '/notifications', '/settings', '/profile', '/onboarding',
  '/dungeons', '/organizer', '/moderation',
]

const findings = []
const passes = []
const matrix = {}

function note(surface, status, msg) {
  matrix[surface] = { status, notes: msg }
}

function bug({ title, severity, route, steps, expected, actual, layer = 'unknown' }) {
  findings.push({ title, severity, route, steps, expected, actual, layer })
}

async function login(username) {
  const jar = new Map()
  const res = await fetch(`${BASE}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: PASSWORD }),
  })
  const setCookie = res.headers.getSetCookie?.() ?? []
  for (const c of setCookie) {
    const [pair] = c.split(';')
    const [k, v] = pair.split('=')
    jar.set(k.trim(), v)
  }
  const body = await res.json().catch(() => ({}))
  const cookieHeader = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  return { ok: res.ok && body.authenticated, cookieHeader, body }
}

async function authedGet(path, cookieHeader) {
  const res = await fetch(`${BASE}${path}`, { headers: cookieHeader ? { Cookie: cookieHeader } : {} })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* */ }
  return { status: res.status, json, text: text.slice(0, 500) }
}

async function probeRoutes() {
  for (const route of PUBLIC_ROUTES) {
    try {
      const res = await fetch(`${BASE}${route}`, { redirect: 'manual' })
      const ok = res.status >= 200 && res.status < 400
      if (ok) passes.push(`Route shell ${route} → ${res.status}`)
      else bug({
        title: `Route ${route} returned ${res.status}`,
        severity: res.status >= 500 ? 'P1' : 'P2',
        route,
        steps: [`GET ${route}`],
        expected: '200/304/redirect',
        actual: String(res.status),
        layer: 'frontend',
      })
      matrix[route] = { status: ok ? 'passed' : 'failed', notes: `HTTP ${res.status}` }
    } catch (e) {
      matrix[route] = { status: 'failed', notes: e.message }
      bug({
        title: `Route ${route} fetch error`,
        severity: 'P1',
        route,
        steps: [`GET ${route}`],
        expected: '200',
        actual: e.message,
        layer: 'frontend',
      })
    }
  }
}

async function probeHealth() {
  const ready = await fetch(`${BASE}/api/health/ready`).then(r => r.json()).catch(() => null)
  if (ready?.ok) passes.push('Health ready: db/redis/s3 ok')
  else bug({
    title: 'Health ready check failed',
    severity: 'P0',
    route: '/api/health/ready',
    steps: ['GET /api/health/ready'],
    expected: 'ok:true with deps',
    actual: JSON.stringify(ready),
    layer: 'backend',
  })

  const policy = await fetch(`${BASE}/api/auth/registration-policy`).then(r => r.json())
  passes.push(`Registration open=${policy.registrationOpen}, inviteRequired=${policy.inviteRequired}`)
}

async function probeAuth() {
  const bad = await fetch(`${BASE}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'nonexistent_user_xyz', password: 'wrongpass1' }),
  })
  const badBody = await bad.json()
  if (bad.status === 401 && badBody.error?.includes('Invalid')) {
    passes.push('Invalid login returns generic 401')
  } else {
    bug({
      title: 'Invalid login response unexpected',
      severity: 'P2',
      route: '/api/auth/session',
      steps: ['POST bad credentials'],
      expected: '401 Invalid credentials',
      actual: `${bad.status} ${JSON.stringify(badBody)}`,
      layer: 'auth',
    })
  }

  for (const [key, acct] of Object.entries(ACCOUNTS)) {
    const s = await login(acct.username)
    if (s.ok) passes.push(`Login ${key} (${acct.username}) OK`)
    else bug({
      title: `Login failed for ${acct.username}`,
      severity: 'P0',
      route: '/api/auth/session',
      steps: [`Login as ${acct.username}`],
      expected: 'authenticated',
      actual: JSON.stringify(s.body),
      layer: 'auth',
    })
  }
}

async function probeProfilesAndPrivacy() {
  const m1 = await login(ACCOUNTS.member1.username)
  const m2 = await login(ACCOUNTS.member2.username)
  if (!m1.ok || !m2.ok) return

  const me1 = await authedGet('/api/v1/profile/me', m1.cookieHeader)
  if (me1.status === 200) passes.push('GET /api/v1/profile/me for member1')
  else bug({
    title: 'Profile me endpoint failed',
    severity: 'P1',
    route: '/api/v1/profile/me',
    steps: ['Login member1', 'GET profile/me'],
    expected: '200',
    actual: String(me1.status),
    layer: 'backend',
  })

  const pub = await authedGet(`/api/v1/users/${ACCOUNTS.member1.username}`, m2.cookieHeader)
  if (pub.status === 200) {
    passes.push('Stranger can view public profile of member1')
    const str = JSON.stringify(pub.json)
    if (str.includes('@proton.me') || str.includes('alphaqa.test.member01')) {
      bug({
        title: 'Email may leak in public profile API',
        severity: 'P0',
        route: `/api/v1/users/${ACCOUNTS.member1.username}`,
        steps: ['Member2 views Member1 profile API'],
        expected: 'No email in response',
        actual: 'Email-like string found',
        layer: 'privacy',
      })
    }
  }

  const unauth = await authedGet(`/api/v1/users/${ACCOUNTS.member1.username}`, '')
  if (unauth.status === 200) passes.push('Guest can view public profile API')
}

async function probeDirectories() {
  const endpoints = [
    '/api/v1/events?limit=5',
    '/api/v1/groups?limit=5',
    '/api/v1/conventions?limit=5',
    '/api/v1/profiles?limit=5',
    '/api/v1/vendors?limit=5',
    '/api/v1/presenters?limit=5',
    '/api/v1/organizations?limit=5',
    '/api/v1/community-places?limit=5',
    '/api/v1/education-articles?limit=5',
  ]
  const m1 = await login(ACCOUNTS.member1.username)
  for (const ep of endpoints) {
    const r = await authedGet(ep, m1.cookieHeader)
    const label = ep.split('?')[0]
    if (r.status === 200) passes.push(`Directory ${label} OK`)
    else matrix[label] = { status: 'partial', notes: `HTTP ${r.status}` }
  }
}

async function probeIdor() {
  const m1 = await login(ACCOUNTS.member1.username)
  const settings = await authedGet('/api/settings/me', m1.cookieHeader)
  if (settings.status === 200) passes.push('Settings/me accessible to owner')

  const m2 = await login(ACCOUNTS.member2.username)
  // Attempt to read member1 settings without auth should fail
  const noAuth = await authedGet('/api/settings/me', '')
  if (noAuth.status === 401 || noAuth.status === 403) passes.push('Settings/me blocked for guest')
  else bug({
    title: 'Settings/me may be accessible without auth',
    severity: 'P0',
    route: '/api/settings/me',
    steps: ['GET without cookie'],
    expected: '401/403',
    actual: String(noAuth.status),
    layer: 'auth',
  })
}

async function main() {
  console.log(`Alpha audit probes — ${BASE}\n`)
  await probeHealth()
  await probeRoutes()
  await probeAuth()
  await probeProfilesAndPrivacy()
  await probeDirectories()
  await probeIdor()

  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    accountsUsed: ACCOUNTS,
    passCount: passes.length,
    findingCount: findings.length,
    passes,
    findings,
    matrix,
  }
  const outPath = join(OUT_DIR, 'api-probe-report.json')
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`Passes: ${passes.length}, Findings: ${findings.length}`)
  console.log(`Wrote ${outPath}`)
  for (const f of findings) console.log(`[${f.severity}] ${f.title}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
