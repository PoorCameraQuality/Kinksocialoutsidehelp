#!/usr/bin/env node
/**
 * Greenfield registration smoke — LOC-REG-GREEN / alpha §16
 * Requires: docker compose, npm run dev, seeded preview convention with public categories
 */
const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:5173'
const CONV = process.env.SMOKE_CONV ?? 'preview-c2k-weekend'
const stamp = Date.now()
const username = `pilot${stamp}`.slice(0, 20)
const email = `pilot${stamp}@mailpit.local`
const password = process.env.DEMO_LOGIN_PASSWORD ?? 'demopass99'

let ok = true
function pass(id, detail) {
  console.log(`PASS ${id} — ${detail}`)
}
function fail(id, detail) {
  ok = false
  console.log(`FAIL ${id} — ${detail}`)
}

async function main() {
  console.log(`Greenfield registration — ${BASE} convention ${CONV}\n`)

  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      email,
      password,
      ageAffirmed: true,
      termsAccepted: true,
    }),
  })
  if (!reg.ok) {
    fail('register', `${reg.status} ${await reg.text()}`)
    process.exit(1)
  }
  const cookie = reg.headers.getSetCookie?.()?.[0] ?? reg.headers.get('set-cookie')
  if (!cookie) {
    fail('register-cookie', 'no session cookie')
    process.exit(1)
  }
  const session = cookie.split(';')[0]
  pass('register', username)

  const infoRes = await fetch(`${BASE}/api/v1/public/conventions/${encodeURIComponent(CONV)}/register-info`, {
    headers: { Accept: 'application/json', Cookie: session },
  })
  if (!infoRes.ok) {
    fail('register-info', `${infoRes.status}`)
    process.exit(1)
  }
  const info = await infoRes.json()
  const category = (info.categories ?? []).find((c) => !c.requiresAccessCode && !c.grantsStaffAccess)
  if (!category?.id) {
    fail('category', 'no public attendee category without access code')
    process.exit(1)
  }
  pass('register-info', category.name ?? category.id)

  const submit = await fetch(
    `${BASE}/api/v1/public/conventions/${encodeURIComponent(CONV)}/registrations`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Cookie: session,
      },
      body: JSON.stringify({
        categoryId: category.id,
        displayName: `Pilot ${username}`,
      }),
    },
  )
  if (!submit.ok) {
    fail('registration', `${submit.status} ${await submit.text()}`)
    process.exit(1)
  }
  const body = await submit.json()
  if (!body.registrant?.personId && !body.registrant?.userId) {
    fail('user_id', JSON.stringify(body).slice(0, 200))
    process.exit(1)
  }
  pass('registration', `registrant ok (${body.registrant.personId ?? body.registrant.userId}) for ${username}`)

  const part = await fetch(`${BASE}/api/v1/conventions/${encodeURIComponent(CONV)}/me/participation`, {
    headers: { Accept: 'application/json', Cookie: session },
  })
  if (!part.ok) {
    fail('participation', `${part.status}`)
  } else {
    pass('participation', 'me/participation 200')
  }

  console.log(ok ? '\nGreenfield registration smoke OK' : '\nSome checks failed')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
