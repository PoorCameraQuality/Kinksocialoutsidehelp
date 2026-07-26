#!/usr/bin/env node
/**
 * Scope email double opt-in smoke — subscribe → Mailpit confirm → active subscriber.
 * Requires: docker/mailpit, API on :3001, C2K_SCOPE_EMAIL_DOUBLE_OPTIN=true on API,
 * org with community.emailListEnabled (default demo-east-collective).
 */
const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:5173'
const API = process.env.API_BASE ?? 'http://127.0.0.1:3001'
const MAILPIT = process.env.MAILPIT_API ?? 'http://127.0.0.1:8025'
const ORG_SLUG = process.env.SMOKE_ORG_SLUG ?? process.env.PILOT_ORG_SLUG ?? 'demo-east-collective'
const DEMO_PASSWORD = process.env.DEMO_LOGIN_PASSWORD ?? 'demo'
const BRAX_PASSWORD = process.env.BRAX_ADMIN_PASSWORD ?? 'Airship!2'

const stamp = Date.now()
const email = `scope-optin-${stamp}@mailpit.local`

const results = []

function log(id, ok, detail) {
  results.push({ id, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} — ${detail}`)
}

async function login(username, password = DEMO_PASSWORD) {
  const res = await fetch(`${BASE}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error(`login ${username}: ${res.status}`)
  const cookie = res.headers.getSetCookie?.()?.[0] ?? res.headers.get('set-cookie')
  if (!cookie) throw new Error('no session cookie')
  return cookie.split(';')[0]
}

function extractConfirmToken(body) {
  const match =
    body.match(/\/email\/confirm\?token=([a-f0-9]+)/i) ??
    body.match(/token=([a-f0-9]{32,})/i)
  return match?.[1] ?? null
}

async function pollMailpitConfirmToken(targetEmail, { timeoutMs = 30_000, intervalMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const listRes = await fetch(`${MAILPIT}/api/v1/messages`)
    if (!listRes.ok) throw new Error(`mailpit list ${listRes.status}`)
    const list = await listRes.json()
    const messages = list?.messages ?? list?.Messages ?? []
    for (const msg of messages) {
      const id = msg.ID ?? msg.id
      if (!id) continue
      const detailRes = await fetch(`${MAILPIT}/api/v1/message/${id}`)
      if (!detailRes.ok) continue
      const detail = await detailRes.json()
      const to = (detail.To ?? detail.to ?? [])
        .map((t) => (typeof t === 'string' ? t : t?.Address ?? t?.address ?? ''))
        .join(' ')
        .toLowerCase()
      if (!to.includes(targetEmail.toLowerCase())) continue
      const subject = detail.Subject ?? detail.subject ?? ''
      if (!/confirm/i.test(subject)) continue
      const body = [detail.Text ?? detail.text ?? '', detail.HTML ?? detail.html ?? ''].join('\n')
      const token = extractConfirmToken(body)
      if (token) return token
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return null
}

async function main() {
  console.log(`Scope email double opt-in — org ${ORG_SLUG}\n`)

  try {
    const mp = await fetch(`${MAILPIT}/api/v1/messages`)
    log('mailpit/reachable', mp.ok, mp.ok ? 'ok' : `status ${mp.status}`)
    if (!mp.ok) process.exit(1)
  } catch (e) {
    log('mailpit/reachable', false, e.message)
    process.exit(1)
  }

  const ready = await fetch(`${API}/api/health/ready`)
  log('health/ready', ready.ok, String(ready.status))
  if (!ready.ok) process.exit(1)

  const metaRes = await fetch(`${BASE}/api/v1/organizations/${encodeURIComponent(ORG_SLUG)}/email-list-meta`)
  if (!metaRes.ok) {
    log('email-list-meta', false, `${metaRes.status} ${await metaRes.text()}`)
    process.exit(1)
  }
  let meta = await metaRes.json()
  if (!meta.enabled) {
    const braxCookie = await login('Brax', BRAX_PASSWORD)
    const patchRes = await fetch(`${BASE}/api/v1/organizations/${encodeURIComponent(ORG_SLUG)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Cookie: braxCookie,
      },
      body: JSON.stringify({ community: { emailListEnabled: true } }),
    })
    log(
      'email-list/enable',
      patchRes.ok,
      patchRes.ok ? `enabled on ${ORG_SLUG}` : `${patchRes.status} ${await patchRes.text()}`,
    )
    if (!patchRes.ok) process.exit(1)
    const metaAgain = await fetch(
      `${BASE}/api/v1/organizations/${encodeURIComponent(ORG_SLUG)}/email-list-meta`,
    )
    meta = metaAgain.ok ? await metaAgain.json() : meta
  }
  log('email-list-meta/enabled', meta.enabled === true, `enabled=${meta.enabled}`)
  log('email-list-meta/doubleOptIn', meta.doubleOptIn === true, `doubleOptIn=${meta.doubleOptIn}`)
  if (!meta.enabled || !meta.doubleOptIn) {
    console.error(
      `\nOrg "${ORG_SLUG}" needs emailListEnabled and API env C2K_SCOPE_EMAIL_DOUBLE_OPTIN=true`,
    )
    process.exit(1)
  }

  const subscribeRes = await fetch(
    `${BASE}/api/v1/organizations/${encodeURIComponent(ORG_SLUG)}/email-subscribe`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        email,
        displayName: 'Scope opt-in smoke',
        consent: true,
      }),
    },
  )
  const subscribeBody = await subscribeRes.json().catch(() => ({}))
  const subscribeOk =
    subscribeRes.ok && subscribeBody.ok === true && subscribeBody.pending === true
  log(
    'email-subscribe',
    subscribeOk,
    `${subscribeRes.status} pending=${subscribeBody.pending} created=${subscribeBody.created}`,
  )
  if (!subscribeOk) process.exit(1)

  let token
  try {
    token = await pollMailpitConfirmToken(email)
  } catch (e) {
    log('mailpit/poll', false, e.message)
    process.exit(1)
  }
  log('mailpit/confirm-token', !!token, token ? 'extracted' : 'not found in Mailpit')
  if (!token) process.exit(1)

  const confirmRes = await fetch(
    `${BASE}/api/v1/email-list/confirm?token=${encodeURIComponent(token)}`,
    { headers: { Accept: 'application/json' } },
  )
  const confirmBody = await confirmRes.json().catch(() => ({}))
  log(
    'email-list/confirm',
    confirmRes.ok && confirmBody.ok === true,
    `${confirmRes.status} ${confirmBody.error ?? confirmBody.scopeName ?? 'ok'}`,
  )
  if (!confirmRes.ok) process.exit(1)

  const ownerCookie = await login('RopeDreamer')
  const subsRes = await fetch(
    `${BASE}/api/v1/organizations/${encodeURIComponent(ORG_SLUG)}/email-subscribers`,
    { headers: { Accept: 'application/json', Cookie: ownerCookie } },
  )
  if (!subsRes.ok) {
    log('email-subscribers', false, `${subsRes.status} ${await subsRes.text()}`)
    process.exit(1)
  }
  const subs = await subsRes.json()
  const active = (subs.items ?? []).find(
    (s) => s.email?.toLowerCase() === email.toLowerCase() && s.status === 'active',
  )
  log('subscriber/active', !!active, active ? email : 'not in active list')

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
