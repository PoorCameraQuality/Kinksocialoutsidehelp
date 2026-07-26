#!/usr/bin/env node
/**
 * Smoke: convention pin emits convention_pin activity visible in following feed + counts.
 * Requires: docker compose up, migrate, npm run dev, seeded DB.
 */
const API = process.env.API_BASE ?? 'http://127.0.0.1:3001'
const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:5173'
const CONV = process.env.SMOKE_CONV ?? 'preview-c2k-weekend'

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

async function main() {
  const cookie = await login('RopeDreamer')

  const pinRes = await fetch(`${API}/api/v1/conventions/${CONV}/pin`, {
    method: 'POST',
    headers: { Cookie: cookie, Accept: 'application/json' },
  })
  if (!pinRes.ok) {
    console.error('POST pin failed', pinRes.status, await pinRes.text())
    process.exitCode = 1
    return
  }

  await new Promise((r) => setTimeout(r, 600))

  const countsRes = await fetch(`${API}/api/v1/feed/following/counts`, {
    headers: { Cookie: cookie, Accept: 'application/json' },
  })
  if (!countsRes.ok) {
    console.error('GET counts failed', countsRes.status)
    process.exitCode = 1
    return
  }
  const counts = await countsRes.json()
  if (typeof counts.all !== 'number' || counts.all < 0) {
    console.error('invalid counts shape', counts)
    process.exitCode = 1
    return
  }

  const feedRes = await fetch(`${API}/api/v1/feed/following?limit=20&filter=events`, {
    headers: { Cookie: cookie, Accept: 'application/json' },
  })
  if (!feedRes.ok) {
    console.error('GET following filter=events failed', feedRes.status)
    process.exitCode = 1
    return
  }
  const feedJson = await feedRes.json()
  const hasPin = (feedJson.items ?? []).some((it) => it.verb === 'convention_pin')
  if (!hasPin) {
    console.error('convention_pin not in events filter feed', feedJson.items?.length)
    process.exitCode = 1
    return
  }

  console.log('OK smoke-feed-following-filters — pin activity + counts + events filter')
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
