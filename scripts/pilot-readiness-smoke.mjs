#!/usr/bin/env node
/**
 * Local pilot path + mail smoke for docs/PILOT_READINESS.md
 * Requires: docker compose up, npm run dev, db:seed
 */
const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:5173'
const API = process.env.API_BASE ?? 'http://127.0.0.1:3001'
const CONV = process.env.SMOKE_CONV ?? 'preview-c2k-weekend'
const ORG_SLUG = process.env.PILOT_ORG_SLUG ?? 'demo-east-collective'

const results = []

function log(id, ok, detail) {
  results.push({ id, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} — ${detail}`)
}

async function login(username) {
  const res = await fetch(`${BASE}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: process.env.DEMO_LOGIN_PASSWORD ?? 'demo' }),
  })
  if (!res.ok) throw new Error(`login ${username}: ${res.status}`)
  const cookie = res.headers.getSetCookie?.()?.[0] ?? res.headers.get('set-cookie')
  if (!cookie) throw new Error('no session cookie')
  return cookie.split(';')[0]
}

async function get(path, cookie) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
  })
  return { status: res.status, json: res.ok ? await res.json().catch(() => null) : null }
}

async function post(path, cookie, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* ignore */
  }
  return { status: res.status, json, text: text.slice(0, 200) }
}

async function main() {
  console.log(`Pilot smoke — base ${BASE}\n`)

  const ready = await fetch(`${API}/api/health/ready`)
  log('health/ready', ready.ok, String(ready.status))

  const owner = await login('RopeDreamer')
  const emailStatus = await get('/api/v1/me/email/status', owner)
  log('email/status', emailStatus.status === 200, JSON.stringify(emailStatus.json))

  const testSend = await post('/api/v1/me/email/test-send', owner, { template: 'event_rsvp_confirm' })
  log('email/test-send', testSend.status === 200 && testSend.json?.ok === true, `${testSend.status} ${testSend.json?.error ?? 'ok'}`)

  let mailpitCount = null
  try {
    const mp = await fetch('http://127.0.0.1:8025/api/v1/messages')
    if (mp.ok) {
      const data = await mp.json()
      mailpitCount = data?.total ?? data?.messages?.length ?? 0
      log('mailpit/messages', mailpitCount > 0, `total=${mailpitCount}`)
    } else {
      log('mailpit/messages', false, `mailpit API ${mp.status}`)
    }
  } catch (e) {
    log('mailpit/messages', false, e.message)
  }

  const bootstrap = await get(`/api/v1/conventions/${CONV}/organizer/bootstrap`, owner)
  log('organizer/bootstrap', bootstrap.status === 200, String(bootstrap.status))

  const people = await get(`/api/v1/conventions/${CONV}/people`, owner)
  log('people/hub', people.status === 200, String(people.status))

  const regInfo = await get(`/api/v1/public/conventions/${CONV}/register-info`, null)
  log('public/register-info', regInfo.status === 200, String(regInfo.status))

  const hub = await get(`/api/v1/conventions/${CONV}/hub-channels`, owner)
  log('hub-channels', hub.status === 200, String(hub.status))

  const participation = await get(`/api/v1/conventions/${CONV}/me/participation`, owner)
  log('me/participation', participation.status === 200, String(participation.status))

  const orgPage = await get(`/api/v1/organizations/${ORG_SLUG}`, owner)
  log('org/detail', orgPage.status === 200, String(orgPage.status))

  const following = await get('/api/v1/feed/following?limit=5', owner)
  log(
    'feed/following',
    following.status === 200 && Array.isArray(following.json?.items),
    `${following.status} items=${following.json?.items?.length ?? 'n/a'}`,
  )

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
