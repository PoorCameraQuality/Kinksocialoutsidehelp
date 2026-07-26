#!/usr/bin/env node
/**
 * Alpha Hardening Pass 1 — Phase 5 prod SMTP transport smoke (no inbox required).
 *
 * Usage:
 *   node scripts/smoke-alpha-hardening-smtp-prod.mjs
 *   SMOKE_BASE=https://kink.social node scripts/smoke-alpha-hardening-smtp-prod.mjs
 */
const BASE = (process.env.SMOKE_BASE ?? 'https://kink.social').replace(/\/$/, '')
const DEMO_USER = process.env.SMOKE_DEMO_USER ?? 'RopeDreamer'
const DEMO_PW = process.env.DEMO_LOGIN_PASSWORD ?? 'demo'

const checks = []

function record(id, ok, detail = '') {
  checks.push({ id, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${detail ? ` — ${detail}` : ''}`)
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
  console.log(`Alpha hardening SMTP prod smoke — ${BASE}\n`)

  const mail = await jsonFetch('/api/health/mail')
  const transportOk = mail.ok && (mail.data.transport === 'smtp' || mail.data.transport === 'resend')
  record('health/mail transport', transportOk, mail.data.transport ?? mail.status)

  const guestStatus = await jsonFetch('/api/v1/me/email/status')
  record('email/status requires auth', guestStatus.status === 401, `status=${guestStatus.status}`)

  const cookie = await login(DEMO_USER, DEMO_PW)
  if (!cookie) {
    record('login demo user', false, 'needed for email/status')
    process.exit(1)
  }
  record('login demo user', true, DEMO_USER)

  const status = await jsonFetch('/api/v1/me/email/status', { cookie })
  if (status.ok) {
    record('email/status reachable', true, JSON.stringify(status.data).slice(0, 160))
    record('transport not disabled', status.data.transport !== 'disabled', status.data.transport)
  } else {
    record('email/status reachable', false, `status=${status.status}`)
  }

  const reset = await jsonFetch('/api/auth/password-reset/request', {
    method: 'POST',
    body: { identifier: 'smoke-reset@example.test' },
  })
  record(
    'password-reset request endpoint',
    reset.ok && reset.data.ok === true,
    reset.data.message ? 'generic ok' : `status=${reset.status}`,
  )

  const unsub = await fetch(`${BASE}/email/unsubscribe?scope=smoke-test`)
  record('unsubscribe route exists', unsub.status === 200 || unsub.status === 400, `status=${unsub.status}`)

  const failed = checks.filter((c) => !c.ok)
  console.log(`\nSummary: ${checks.length - failed.length}/${checks.length} passed`)
  console.log('\nManual (PROD_SMTP_K8S_CHECKLIST D.2–D.5): inbox delivery, org join mail, digests')
  if (failed.length) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
