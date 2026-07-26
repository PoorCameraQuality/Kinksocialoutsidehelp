#!/usr/bin/env node
/**
 * Alpha Hardening Pass 1 — HTTP smoke against staging/prod (no DB required).
 * Mod matrix + mail/health + upload endpoint guards.
 *
 * Usage:
 *   node scripts/smoke-alpha-hardening-prod.mjs
 *   SMOKE_BASE=https://kink.social node scripts/smoke-alpha-hardening-prod.mjs
 *   SMOKE_BASE=http://127.0.0.1:5173 REQUIRE_BRAX_ADMIN_SMOKE=1 BRAX_ADMIN_PASSWORD=... node scripts/smoke-alpha-hardening-prod.mjs
 */
const BASE = (process.env.SMOKE_BASE ?? 'https://kink.social').replace(/\/$/, '')
const REQUIRE_BRAX = process.env.REQUIRE_BRAX_ADMIN_SMOKE === '1'
const BRAX_USER = process.env.SMOKE_ADMIN_USER ?? 'Brax'
const BRAX_PW = process.env.BRAX_ADMIN_PASSWORD ?? process.env.E2E_SITE_ADMIN_PASSWORD ?? ''
const DEMO_USER = process.env.SMOKE_DEMO_USER ?? 'RopeDreamer'
const DEMO_PW = process.env.DEMO_LOGIN_PASSWORD ?? 'demo'

const checks = []

function record(id, ok, detail = '') {
  checks.push({ id, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ` — ${detail}` : ''}`)
}

function skip(id, detail = '') {
  console.log(`SKIP ${id}${detail ? ` — ${detail}` : ''}`)
}

async function jsonFetch(path, { cookie, method = 'GET', body } = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
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
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${BASE}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)))
      continue
    }
    if (!res.ok) return null
    const cookie = res.headers.getSetCookie?.()?.[0] ?? res.headers.get('set-cookie')
    if (!cookie) return null
    return cookie.split(';')[0]
  }
  return null
}

async function main() {
  console.log(`Alpha hardening prod smoke — ${BASE}\n`)

  const health = await jsonFetch('/api/health')
  record('health', health.ok, `status=${health.status}`)

  const ready = await jsonFetch('/api/health/ready')
  const readyOk =
    ready.ok &&
    ready.data.ok !== false &&
    ready.data.database === 'ok' &&
    ready.data.redis === 'ok'
  record('health/ready', readyOk, JSON.stringify(ready.data).slice(0, 120))

  const mail = await jsonFetch('/api/health/mail')
  const mailOk = mail.ok && (mail.data.transport === 'smtp' || mail.data.transport === 'resend')
  record('health/mail', mailOk, mail.data.transport ?? mail.status)

  const regPolicy = await jsonFetch('/api/auth/registration-policy')
  record('registration-policy', regPolicy.ok, regPolicy.data.registrationOpen != null ? 'ok' : '')

  const guestMod = await jsonFetch('/api/v1/moderation/me')
  record('guest moderation/me blocked', guestMod.status === 401 || guestMod.status === 403, `status=${guestMod.status}`)

  const guestMediaCreate = await jsonFetch('/api/v1/media/assets', {
    method: 'POST',
    body: {
      ownerType: 'profile',
      ownerId: '00000000-0000-4000-8000-000000000001',
      sourceSurface: 'profile_photo',
      storageKey: 'quarantine/evil/photo.jpg',
    },
  })
  record(
    'guest media/assets create blocked',
    guestMediaCreate.status === 401,
    `status=${guestMediaCreate.status}`,
  )

  const demoCookie = await login(DEMO_USER, DEMO_PW)
  if (demoCookie) {
    record('login demo user', true, DEMO_USER)
    const demoModMe = await jsonFetch('/api/v1/moderation/me', { cookie: demoCookie })
    const demoIsMod = demoModMe.ok && demoModMe.data.moderator === true
    if (demoIsMod) {
      record('demo user moderation/me', true, `role=${demoModMe.data.role ?? 'MODERATOR'}`)
      const demoDash = await jsonFetch('/api/v1/moderation/dashboard', { cookie: demoCookie })
      record('platform moderator dashboard access', demoDash.ok, `status=${demoDash.status}`)
    } else {
      record('demo user not platform moderator', true, 'moderator=false')
      const demoDash = await jsonFetch('/api/v1/moderation/dashboard', { cookie: demoCookie })
      record('non-mod mod dashboard blocked', demoDash.status === 403, `status=${demoDash.status}`)
    }
    const demoAdmin = await jsonFetch('/api/v1/admin/dmca/cases', { cookie: demoCookie })
    record('non-legal-admin DMCA API blocked', demoAdmin.status === 403, `status=${demoAdmin.status}`)
  } else {
    skip('login demo user', 'set DEMO_LOGIN_PASSWORD or retry — mod matrix skipped')
  }

  if (REQUIRE_BRAX || BRAX_PW) {
    const adminCookie = await login(BRAX_USER, BRAX_PW || 'Airship!2')
    if (adminCookie) {
      record('login site admin', true, BRAX_USER)
      const modMe = await jsonFetch('/api/v1/moderation/me', { cookie: adminCookie })
      const isMod = modMe.ok && (modMe.data.moderator === true || modMe.data.siteAdmin === true)
      record('admin moderation/me', isMod, modMe.data.role ?? modMe.data.siteAdmin)
    } else if (REQUIRE_BRAX) {
      record('login site admin', false, 'bad credentials')
    } else {
      skip('login site admin', 'optional — set REQUIRE_BRAX_ADMIN_SMOKE=1 + BRAX_ADMIN_PASSWORD')
    }
  } else {
    skip('login site admin', 'optional — set REQUIRE_BRAX_ADMIN_SMOKE=1 + BRAX_ADMIN_PASSWORD')
  }

  const support = await fetch(`${BASE}/support`)
  record('support page', support.status === 200, `status=${support.status}`)

  const failed = checks.filter((c) => !c.ok)
  console.log(`\nSummary: ${checks.length - failed.length}/${checks.length} passed`)
  if (failed.length) {
    for (const f of failed) console.log(`  ✗ ${f.id}${f.detail ? `: ${f.detail}` : ''}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
