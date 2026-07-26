#!/usr/bin/env node
/** Moderation report path smoke — LOC-REPORTS-E2E / alpha §16 (canonical intake). */
const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:5173'

async function login() {
  const res = await fetch(`${BASE}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'RopeDreamer', password: process.env.DEMO_LOGIN_PASSWORD ?? 'demo' }),
  })
  if (!res.ok) throw new Error(`login ${res.status}`)
  const cookie = res.headers.getSetCookie?.()?.[0] ?? res.headers.get('set-cookie')
  if (!cookie) throw new Error('no cookie')
  return cookie.split(';')[0]
}

async function resolveProfileId(cookie, username) {
  const res = await fetch(`${BASE}/api/v1/profiles?q=${encodeURIComponent(username)}&limit=5`, {
    headers: { Accept: 'application/json', Cookie: cookie },
  })
  if (!res.ok) throw new Error(`profiles search ${res.status}`)
  const body = await res.json()
  const row = (body.items ?? []).find((p) => p.username === username)
  if (!row?.userId) throw new Error(`profile not found for ${username}`)
  return row.userId
}

async function main() {
  console.log(`Reports smoke — ${BASE}\n`)
  const cookie = await login()
  const targetId = await resolveProfileId(cookie, 'ShutterSeed')

  const post = await fetch(`${BASE}/api/v1/moderation/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      targetType: 'profile',
      targetId,
      policyReason: 'SPAM_SCAM',
      body: 'pilot-readiness smoke report',
    }),
  })
  if (!post.ok) {
    console.log(`FAIL post-report — ${post.status} ${await post.text()}`)
    process.exit(1)
  }
  const created = await post.json()
  const reportId = created.reportId ?? created.id
  if (!reportId) {
    console.log('FAIL post-report — missing reportId')
    process.exit(1)
  }
  console.log(`PASS post-report — ${reportId} case=${created.caseId ?? '?'}`)

  const list = await fetch(`${BASE}/api/v1/me/moderation/reports`, {
    headers: { Accept: 'application/json', Cookie: cookie },
  })
  if (!list.ok) {
    console.log(`FAIL list-reports — ${list.status}`)
    process.exit(1)
  }
  const rows = await list.json()
  const found = (rows.reports ?? []).some((r) => (r.id ?? r.reportId) === reportId)
  if (!found) {
    console.log('FAIL list-reports — created report not in list')
    process.exit(1)
  }
  console.log('PASS list-reports — report visible to reporter')

  console.log('\nReports smoke OK')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
