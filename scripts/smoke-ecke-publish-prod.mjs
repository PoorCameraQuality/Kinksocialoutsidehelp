#!/usr/bin/env node
/**
 * Post-deploy ECKE publish smoke (prod).
 * - kink.social health + ECKE bridge
 * - EastCoast listing index pages
 * - Authenticated preview checks for key source kinds (no publish by default)
 *
 * Usage:
 *   node scripts/smoke-ecke-publish-prod.mjs
 *   SMOKE_PUBLISH=1 node scripts/smoke-ecke-publish-prod.mjs  # includes group publish loop
 */
const C2K = (process.env.C2K_BASE_URL || 'https://kink.social').replace(/\/$/, '')
const ECKE = (process.env.ECKE_PUBLIC_URL || 'https://eastcoastkinkevents.com').replace(/\/$/, '')
const USER = process.env.SMOKE_USER || 'alpha_mod'
const PASS = process.env.SMOKE_PASS || 'AlphaSocial!23'

const checks = []

function record(id, ok, detail = '') {
  checks.push({ id, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ` — ${detail}` : ''}`)
}

function skip(id, detail = '') {
  console.log(`SKIP ${id}${detail ? ` — ${detail}` : ''}`)
}

function jarFrom(setCookie) {
  if (!setCookie) return ''
  const parts = Array.isArray(setCookie) ? setCookie : [setCookie]
  return parts.map((c) => c.split(';')[0]).join('; ')
}

async function c2k(path, opts = {}) {
  const r = await fetch(`${C2K}${path}`, {
    ...opts,
    headers: {
      Accept: 'application/json',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.cookie ? { Cookie: opts.cookie } : {}),
      ...opts.headers,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const text = await r.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text.slice(0, 200) }
  }
  return { status: r.status, json, headers: r.headers }
}

async function eckePage(path) {
  const r = await fetch(`${ECKE}${path}`, { redirect: 'follow' })
  const html = await r.text()
  return { status: r.status, html }
}

async function login() {
  const res = await c2k('/api/auth/session', {
    method: 'POST',
    body: { username: USER, password: PASS },
  })
  if (res.status !== 200 && res.status !== 201) return null
  return jarFrom(res.headers.getSetCookie?.() ?? res.headers.get('set-cookie'))
}

async function previewKind(cookie, sourceKind, sourceId) {
  const r = await c2k(
    `/api/v1/ecke-publish/preview?sourceKind=${encodeURIComponent(sourceKind)}&sourceId=${encodeURIComponent(sourceId)}`,
    { cookie },
  )
  if (r.status !== 200) return { ok: false, detail: `HTTP ${r.status}` }
  const p = r.json
  const hasOmitted = Array.isArray(p.wouldNotPublish) && p.wouldNotPublish.length > 0
  return {
    ok: true,
    detail: `eligible=${p.eligible} status=${p.status} omitted=${hasOmitted ? 'yes' : 'no'}`,
  }
}

async function main() {
  console.log(`ECKE publish prod smoke\nC2K: ${C2K}\nECKE: ${ECKE}\n`)

  const ready = await c2k('/api/health/ready')
  record('c2k health/ready', ready.status === 200 && ready.json?.ok, JSON.stringify(ready.json))

  const eckeHealth = await c2k('/api/health/ecke')
  record(
    'c2k health/ecke bridge',
    eckeHealth.status === 200 && eckeHealth.json?.listingWebhookConfigured,
    JSON.stringify(eckeHealth.json),
  )

  for (const path of [
    '/groups',
    '/organizations',
    '/conventions',
    '/presenters',
    '/venues',
  ]) {
    const page = await eckePage(path)
    record(`ecke page ${path}`, page.status === 200, `HTTP ${page.status}`)
  }

  const cookie = await login()
  record('c2k login', Boolean(cookie), USER)
  if (!cookie) {
    console.log('\nSummary (no auth):', checks.filter((c) => c.ok).length, '/', checks.length)
    process.exit(1)
  }

  const groupId = process.env.SMOKE_GROUP_ID || '4362af5e-eb8d-40e2-9cc6-700d883604eb'
  const orgId = process.env.SMOKE_ORG_ID || 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const kinds = [
    ['group_listing', groupId],
    ['organization_listing', orgId],
    ['vendor_profile', process.env.SMOKE_VENDOR_ID],
    ['presenter_profile', process.env.SMOKE_PRESENTER_USER_ID],
    ['venue_profile', process.env.SMOKE_VENUE_PLACE_ID],
    ['convention_listing', process.env.SMOKE_CONVENTION_ID],
    ['convention_event_anchor', process.env.SMOKE_CONVENTION_ID],
    ['dancecard_event', process.env.SMOKE_CONVENTION_ID],
  ]

  for (const [kind, id] of kinds) {
    if (!id) {
      skip(`preview ${kind}`, 'no SMOKE_*_ID')
      continue
    }
    const r = await previewKind(cookie, kind, id)
    record(`preview ${kind}`, r.ok, r.detail)
  }

  // Presenter/venue registry entries exist
  const reg = await c2k('/api/v1/ecke-publish/registry', { cookie })
  const kindsInReg = new Set((reg.json?.entries || []).map((e) => e.sourceKind))
  record('registry presenter_profile', kindsInReg.has('presenter_profile'))
  record('registry venue_profile', kindsInReg.has('venue_profile'))
  record('registry convention_event_anchor', kindsInReg.has('convention_event_anchor'))

  if (process.env.SMOKE_PUBLISH === '1') {
    console.log('\n--- Running group publish loop (SMOKE_PUBLISH=1) ---')
    const { spawnSync } = await import('node:child_process')
    const r = spawnSync(process.execPath, ['scripts/smoke-ecke-group-listing-ui.mjs'], {
      stdio: 'inherit',
      env: process.env,
    })
    record('group listing full loop', r.status === 0, `exit ${r.status}`)
  }

  const failed = checks.filter((c) => !c.ok)
  console.log(`\nSummary: ${checks.length - failed.length}/${checks.length} passed`)
  if (failed.length) {
    console.log('Failed:', failed.map((f) => f.id).join(', '))
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
