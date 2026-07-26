#!/usr/bin/env node
/**
 * Multi-tier moderation smoke — requires dev stack + seeded users.
 * Brax (site admin) + RopeDreamer (org mod) recommended; set SMOKE_MOD_USERNAME for mod checks.
 */
const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:5173'
const DEMO_PW = process.env.DEMO_LOGIN_PASSWORD ?? 'demo'

function passwordFor(username) {
  if (username === 'Brax') return process.env.BRAX_ADMIN_PASSWORD ?? 'Airship!2'
  return DEMO_PW
}

async function login(username) {
  const res = await fetch(`${BASE}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: passwordFor(username) }),
  })
  if (!res.ok) throw new Error(`login ${username} ${res.status}`)
  const cookie = res.headers.getSetCookie?.()?.[0] ?? res.headers.get('set-cookie')
  if (!cookie) throw new Error('no cookie')
  return cookie.split(';')[0]
}

async function jsonFetch(path, { cookie, method = 'GET', body } = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      Cookie: cookie,
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

async function main() {
  console.log(`Moderation smoke — ${BASE}\n`)
  const reporter = await login('RopeDreamer')
  const modUser = process.env.SMOKE_MOD_USERNAME ?? 'Brax'
  const modCookie = await login(modUser)

  const me = await jsonFetch('/api/v1/moderation/me', { cookie: modCookie })
  if (!me.ok) {
    console.log(`FAIL moderation/me — ${me.status} ${me.text}`)
    process.exit(1)
  }
  if (!me.data.moderator) {
    console.log(`SKIP platform mod checks — ${modUser} is not a platform moderator`)
  } else {
    console.log(`PASS moderation/me — moderator=${me.data.moderator} siteAdmin=${Boolean(me.data.siteAdmin)}`)
  }

  const post = await jsonFetch('/api/v1/reports', {
    cookie: reporter,
    method: 'POST',
    body: {
      targetType: 'profile',
      targetId: '00000000-0000-4000-8000-000000000099',
      category: 'spam',
      body: 'smoke-moderation intake',
    },
  })
  if (!post.ok) {
    console.log(`FAIL post-report — ${post.status} ${post.text}`)
    process.exit(1)
  }
  console.log(`PASS post-report — ${post.data.id}`)

  if (me.data.moderator) {
    const reports = await jsonFetch('/api/v1/moderation/reports?status=OPEN', { cookie: modCookie })
    if (!reports.ok) {
      console.log(`FAIL moderation/reports — ${reports.status}`)
      process.exit(1)
    }
    console.log(`PASS moderation/reports — ${(reports.data.items ?? []).length} open`)

    const actions = await jsonFetch('/api/v1/moderation/actions?status=pending', { cookie: modCookie })
    if (!actions.ok) {
      console.log(`FAIL moderation/actions — ${actions.status}`)
      process.exit(1)
    }
    console.log(`PASS moderation/actions — ${(actions.data.items ?? []).length} pending`)

    const audit = await jsonFetch('/api/v1/moderation/audit?limit=5', { cookie: modCookie })
    if (!audit.ok) {
      console.log(`FAIL moderation/audit — ${audit.status}`)
      process.exit(1)
    }
    console.log(`PASS moderation/audit — ${(audit.data.items ?? []).length} rows`)
  }

  const orgSlug = process.env.SMOKE_ORG_SLUG ?? 'demo-east-collective'
  const orgReports = await jsonFetch(
    `/api/v1/organizations/${encodeURIComponent(orgSlug)}/reports?status=OPEN`,
    { cookie: reporter }
  )
  if (orgReports.status === 403 || orgReports.status === 404) {
    console.log(`SKIP org reports — ${orgReports.status} (set SMOKE_ORG_SLUG or org mod role)`)
  } else if (!orgReports.ok) {
    console.log(`FAIL org reports — ${orgReports.status} ${orgReports.text}`)
    process.exit(1)
  } else {
    console.log(`PASS org reports — ${(orgReports.data.items ?? []).length} open`)
  }

  console.log('\nModeration smoke OK')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
