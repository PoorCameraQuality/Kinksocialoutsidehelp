#!/usr/bin/env node
/**
 * Organizer tab endpoint walk — LOC-ORG-WALK
 * Hits bootstrap GET paths for preview-c2k-weekend (requires npm run dev + DB).
 */
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:3001'
const WEB = process.env.SMOKE_BASE ?? 'http://127.0.0.1:5173'
const CONV = process.env.SMOKE_CONV ?? 'preview-c2k-weekend'

const TAB_PATHS = [
  ['dashboard', `/api/v1/conventions/${CONV}/organizer/bootstrap`],
  ['program', `/api/v1/conventions/${CONV}/program-slots`],
  ['venues', `/api/v1/conventions/${CONV}/locations`],
  ['people', `/api/v1/conventions/${CONV}/registrants`],
  ['messaging', `/api/v1/conventions/${CONV}/message-templates`],
  ['settings', `/api/v1/conventions/${CONV}/registration-categories`],
  ['door', `/api/v1/conventions/${CONV}/door/roster`],
]

async function login() {
  const res = await fetch(`${WEB}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'RopeDreamer', password: process.env.DEMO_LOGIN_PASSWORD ?? 'demo' }),
  })
  if (!res.ok) throw new Error(`login ${res.status}`)
  const cookie = res.headers.getSetCookie?.()?.[0] ?? res.headers.get('set-cookie')
  return cookie?.split(';')[0] ?? ''
}

async function main() {
  console.log(`Organizer tab walk — ${CONV}\n`)
  const cookie = await login()
  let fail = 0
  for (const [tab, path] of TAB_PATHS) {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Accept: 'application/json', Cookie: cookie },
    })
    const ok = res.status >= 200 && res.status < 400
    console.log(`${ok ? 'PASS' : 'FAIL'} ${tab} — ${res.status} ${path}`)
    if (!ok) fail++
  }
  process.exit(fail ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
