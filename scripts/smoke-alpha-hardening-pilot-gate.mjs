#!/usr/bin/env node
/**
 * Alpha Hardening Pass 1 — Phase 6 pilot-org infrastructure smoke (prod).
 * Verifies organizer surfaces exist; does not substitute for real external pilot walkthrough.
 *
 * Usage:
 *   node scripts/smoke-alpha-hardening-pilot-gate.mjs
 */
const BASE = (process.env.SMOKE_BASE ?? 'https://kink.social').replace(/\/$/, '')
const DEMO_USER = process.env.SMOKE_DEMO_USER ?? 'RopeDreamer'
const DEMO_PW = process.env.DEMO_LOGIN_PASSWORD ?? 'demo'
const PILOT_ORG = process.env.PILOT_ORG_SLUG ?? 'demo-east-collective'
const PREVIEW_CONV = process.env.PILOT_PREVIEW_CONV ?? 'preview-c2k-weekend'

const checks = []

function record(id, ok, detail = '') {
  checks.push({ id, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ` — ${detail}` : ''}`)
}

function skip(id, detail = '') {
  console.log(`SKIP ${id}${detail ? ` — ${detail}` : ''}`)
}

async function jsonFetch(path, { cookie } = {}) {
  const r = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  })
  const text = await r.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    /* ignore */
  }
  return { ok: r.ok, status: r.status, data, text }
}

async function login(username, password) {
  const res = await fetch(`${BASE}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) return null
  const cookie = res.headers.getSetCookie?.()?.[0] ?? res.headers.get('set-cookie')
  if (!cookie) return null
  return cookie.split(';')[0]
}

async function main() {
  console.log(`Alpha hardening pilot gate — ${BASE}\n`)

  for (const path of ['/events', '/groups', '/organizations', '/conventions']) {
    const r = await fetch(`${BASE}${path}`)
    record(`route ${path}`, r.status === 200, `status=${r.status}`)
  }

  const org = await jsonFetch(`/api/v1/organizations/${encodeURIComponent(PILOT_ORG)}`)
  record(`org ${PILOT_ORG} public`, org.ok, org.ok ? org.data.name ?? 'ok' : `status=${org.status}`)

  const conv = await jsonFetch(`/api/v1/conventions/${encodeURIComponent(PREVIEW_CONV)}`)
  record(`convention ${PREVIEW_CONV}`, conv.ok, conv.ok ? conv.data.title ?? 'ok' : `status=${conv.status}`)

  const regPage = await fetch(`${BASE}/conventions/${PREVIEW_CONV}/register`)
  record('convention register page', regPage.status === 200, `status=${regPage.status}`)

  const cookie = await login(DEMO_USER, DEMO_PW)
  if (cookie) {
    const orgs = await jsonFetch('/api/v1/me/organizations', { cookie })
    record('organizer org list API', orgs.ok || orgs.status === 404, `status=${orgs.status}`)
    const door = await fetch(`${BASE}/conventions/${PREVIEW_CONV}/door`, {
      headers: { Cookie: cookie },
    })
    record('door route shell', door.status === 200, `status=${door.status}`)
  } else {
    skip('organizer APIs', 'demo login failed')
  }

  console.log('\nProduct gate (manual): first real external org — see docs/PILOT_READINESS.md § First real pilot org')
  const failed = checks.filter((c) => !c.ok)
  console.log(`\nSummary: ${checks.length - failed.length}/${checks.length} passed`)
  if (failed.length) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
