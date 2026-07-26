#!/usr/bin/env node
/**
 * Smoke: POST /feed/posts creates feed_activities row (inline or after worker).
 * Requires: docker compose up, migrate, npm run dev, seeded DB.
 */
const API = process.env.API_BASE ?? 'http://127.0.0.1:3001'
const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:5173'

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
  const body = `feed-activity-smoke ${Date.now()}`
  const postRes = await fetch(`${API}/api/v1/feed/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({ kind: 'status', body, bodyFormat: 'text' }),
  })
  if (!postRes.ok) {
    console.error('POST /feed/posts failed', postRes.status, await postRes.text())
    process.exitCode = 1
    return
  }
  const postJson = await postRes.json()
  const postId = postJson?.post?.id
  if (!postId) {
    console.error('missing post id')
    process.exitCode = 1
    return
  }

  await new Promise((r) => setTimeout(r, 500))

  const feedRes = await fetch(`${API}/api/v1/feed/following?limit=5`, {
    headers: { Cookie: cookie, Accept: 'application/json' },
  })
  if (!feedRes.ok) {
    console.error('GET /feed/following failed', feedRes.status)
    process.exitCode = 1
    return
  }
  const feedJson = await feedRes.json()
  const items = feedJson?.items ?? []
  const hasPost = items.some(
    (it) =>
      (it.kind === 'post' && it.post?.id === postId) ||
      (it.kind === 'activity' && it.object?.id === postId),
  )
  if (!hasPost) {
    console.error('new post not visible in following feed', items.length)
    process.exitCode = 1
    return
  }
  console.log('OK smoke-feed-activities-write — post visible in following feed')
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
