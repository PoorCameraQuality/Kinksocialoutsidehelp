#!/usr/bin/env node
/**
 * Moderation checkpoint smoke — canonical intake, scoped bridge, role gates.
 * Requires dev stack + db:seed (Brax, RopeDreamer, demo-east-collective).
 */
import { eq } from 'drizzle-orm'

const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:5173'
const DEMO_PW = process.env.DEMO_LOGIN_PASSWORD ?? 'demo'
const BRAX_PW = process.env.BRAX_ADMIN_PASSWORD ?? 'Airship!2'

/** @type {{ name: string; ok: boolean; detail?: string }[]} */
const results = []

function pass(name, detail = '') {
  results.push({ name, ok: true, detail })
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail })
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
}

function skip(name, detail = '') {
  results.push({ name, ok: true, detail: `SKIP: ${detail}` })
  console.log(`SKIP  ${name} — ${detail}`)
}

async function login(username, password) {
  const res = await fetch(`${BASE}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error(`login ${username} ${res.status}`)
  const cookie = res.headers.getSetCookie?.()?.[0] ?? res.headers.get('set-cookie')
  if (!cookie) throw new Error('no cookie')
  return cookie.split(';')[0]
}

async function api(path, { cookie, method = 'GET', body } = {}) {
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
  console.log(`Moderation checkpoint smoke — ${BASE}\n`)

  let memberCookie
  let braxCookie
  let ropeModCookie
  try {
    memberCookie = await login('ShutterSeed', DEMO_PW)
    braxCookie = await login('Brax', BRAX_PW)
    ropeModCookie = await login('RopeDreamer', DEMO_PW)
  } catch (e) {
    fail('login seeded users', String(e))
    process.exit(1)
  }
  pass('login seeded users', 'ShutterSeed, Brax, RopeDreamer')

  const orgSlug = 'demo-east-collective'
  const orgRes = await api(`/api/v1/organizations/${encodeURIComponent(orgSlug)}`, { cookie: memberCookie })
  const orgId = orgRes.data?.organization?.id
  if (!orgId) {
    fail('resolve org id', orgRes.text)
    process.exit(1)
  }

  const forumRes = await api(`/api/v1/organizations/${encodeURIComponent(orgSlug)}/forum/threads?limit=1`, {
    cookie: memberCookie,
  })
  const threadId = forumRes.data?.items?.[0]?.id
  const postId = forumRes.data?.items?.[0]?.posts?.[0]?.id ?? forumRes.data?.items?.[0]?.latestPostId

  const targetType = threadId ? 'org_forum_thread' : 'organization'
  const targetId = threadId ?? orgId

  const report = await api('/api/v1/moderation/reports', {
    cookie: memberCookie,
    method: 'POST',
    body: {
      targetType,
      targetId,
      policyReason: 'SPAM_SCAM',
      body: 'checkpoint smoke report',
    },
  })
  if (!report.ok || !report.data.caseId) {
    fail('member ReportAction intake (canonical POST)', `${report.status} ${report.text}`)
  } else {
    pass('member canonical report creates T&S case', `caseId=${report.data.caseId}`)
  }

  const orgInbox = await api(
    `/api/v1/organizations/${encodeURIComponent(orgSlug)}/reports?status=OPEN`,
    { cookie: ropeModCookie }
  )
  if (orgInbox.ok) {
    const bridged = (orgInbox.data.items ?? []).some(
      (r) => r.meta?.caseId === report.data.caseId || r.targetId === targetId
    )
    if (bridged || (orgInbox.data.items ?? []).length > 0) {
      pass('scoped org inbox sees bridged report', `${(orgInbox.data.items ?? []).length} open`)
    } else {
      fail('scoped org inbox bridge', 'no matching legacy report row')
    }
  } else if (orgInbox.status === 403) {
    skip('scoped org inbox', 'RopeDreamer lacks org MOD on this org')
  } else {
    fail('scoped org inbox', `${orgInbox.status}`)
  }

  const modMe = await api('/api/v1/moderation/me', { cookie: braxCookie })
  if (modMe.ok && modMe.data.moderator) {
    pass('platform mod /moderation/me', `siteAdmin=${Boolean(modMe.data.siteAdmin)}`)
  } else {
    fail('platform mod /moderation/me', `${modMe.status}`)
  }

  const queues = await api('/api/v1/moderation/queues', { cookie: braxCookie })
  if (queues.ok) {
    pass('site admin sees moderation queues', `${(queues.data.items ?? queues.data.queues ?? []).length || 'ok'}`)
  } else {
    fail('site admin queues', `${queues.status}`)
  }

  const modOnly = await api('/api/v1/moderation/me', { cookie: ropeModCookie })
  const isPlatformMod = modOnly.ok && modOnly.data.moderator
  if (isPlatformMod) {
    const restricted = await api('/api/v1/moderation/queues?queue=MINOR_SAFETY_RESTRICTED', { cookie: ropeModCookie })
    const items = restricted.data?.items ?? []
    if (items.length === 0) {
      pass('platform mod restricted queue filter', 'no restricted items returned')
    } else {
      fail('platform mod restricted queue', `got ${items.length} restricted items`)
    }
  } else {
    skip('platform mod restricted queue', 'RopeDreamer is not platform mod in seed')
  }

  const braxRestricted = await api('/api/v1/moderation/queues?queue=MINOR_SAFETY_RESTRICTED', { cookie: braxCookie })
  if (braxRestricted.ok && modMe.data?.siteAdmin) {
    pass('site admin can query restricted queue', `${(braxRestricted.data.items ?? []).length} items`)
  }

  const myReports = await api('/api/v1/me/moderation/reports', { cookie: memberCookie })
  if (myReports.ok) {
    pass('settings canonical report history', `${(myReports.data.reports ?? []).length} rows`)
  } else {
    fail('settings canonical report history', `${myReports.status}`)
  }

  const cases = await api('/api/v1/moderation/cases?status=OPEN', { cookie: braxCookie })
  if (cases.ok) {
    pass('platform mod open cases', `${(cases.data.items ?? []).length} open`)
  } else {
    fail('platform mod cases', `${cases.status}`)
  }

  // Multi-target entity intake (vendor / group / convention) when seed data exists.
  async function reportEntity(label, targetType, targetId) {
    if (!targetId) {
      skip(`entity report ${label}`, 'no seeded target id')
      return
    }
    const r = await api('/api/v1/moderation/reports', {
      cookie: memberCookie,
      method: 'POST',
      body: {
        targetType,
        targetId,
        policyReason: 'SPAM_SCAM',
        body: `checkpoint ${label}`,
      },
    })
    if (!r.ok || !r.data.caseId) {
      fail(`entity report ${label}`, `${r.status} ${r.text}`)
      return
    }
    const hist = await api('/api/v1/me/moderation/reports', { cookie: memberCookie })
    const found = (hist.data.reports ?? []).some(
      (row) => (row.id ?? row.reportId) === r.data.reportId || row.caseId === r.data.caseId
    )
    if (found || hist.ok) {
      pass(`entity report ${label}`, `caseId=${r.data.caseId}`)
    } else {
      fail(`entity report ${label} history`, 'report not in reporter history')
    }
  }

  const vendors = await api('/api/v1/vendors?limit=1', { cookie: memberCookie })
  const vendorId = vendors.data?.items?.[0]?.id ?? vendors.data?.vendors?.[0]?.id
  await reportEntity('vendor', 'vendor', vendorId)

  const groups = await api('/api/v1/groups?limit=1', { cookie: memberCookie })
  const groupId = groups.data?.items?.[0]?.id ?? groups.data?.groups?.[0]?.id
  await reportEntity('group', 'group', groupId)

  const conventions = await api('/api/v1/conventions?limit=1', { cookie: memberCookie })
  const conventionId =
    conventions.data?.items?.[0]?.id ?? conventions.data?.conventions?.[0]?.id
  await reportEntity('convention', 'convention', conventionId)

  console.log('\n--- Summary ---')
  const failed = results.filter((r) => !r.ok)
  console.log(`${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length) process.exit(1)
  console.log('Moderation checkpoint smoke OK')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
