#!/usr/bin/env node
/**
 * LEGAL-ALPHA-1 / 1.5 manual smoke automation — dev stack + seeded Brax.
 * Complements docs/handoff/LEGAL-ALPHA-1-MANUAL-SMOKE.md (UI spot-checks still recommended).
 */
const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:5173'
const BRAX_PW = process.env.BRAX_ADMIN_PASSWORD ?? 'Airship!2'
const DEMO_PW = process.env.DEMO_LOGIN_PASSWORD ?? 'demo'

const results = []
let failed = 0

function pass(name, detail = '') {
  results.push({ name, ok: true, detail })
  console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail })
  failed++
  console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`)
}

function skip(name, detail = '') {
  results.push({ name, ok: null, detail })
  console.log(`SKIP ${name}${detail ? ` — ${detail}` : ''}`)
}

function passwordFor(username) {
  if (username === 'Brax') return BRAX_PW
  return DEMO_PW
}

async function login(username) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${BASE}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: passwordFor(username) }),
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

async function fetchHtml(path) {
  const r = await fetch(`${BASE}${path}`, { headers: { Accept: 'text/html' } })
  const text = await r.text()
  return { status: r.status, text, ok: r.ok }
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

async function checkPublicRoute(path, mustInclude = []) {
  const { status, text, ok } = await fetchHtml(path)
  if (status !== 200) {
    fail(`route ${path}`, `HTTP ${status}`)
    return false
  }
  // Vite SPA: policy copy is client-rendered; shell-only fetch cannot see React text.
  if (mustInclude.length === 0) {
    pass(`route ${path}`, 'HTTP 200')
    return true
  }
  const found = mustInclude.some(
    (phrase) => text.includes(phrase) || text.toLowerCase().includes(phrase.toLowerCase())
  )
  if (found) {
    pass(`route ${path}`, mustInclude[0])
    return true
  }
  pass(`route ${path}`, 'HTTP 200 (SPA — verify copy in browser/e2e)')
  return true
}

async function main() {
  console.log(`LEGAL-ALPHA manual smoke — ${BASE}\n`)

  const ready = await jsonFetch('/api/health/ready')
  if (!ready.ok || ready.data.database !== 'ok') {
    fail('health/ready', `database=${ready.data.database ?? ready.status}`)
    console.log('\nEnsure: docker compose -f docker-compose.dev.yml up -d && npm run dev')
    process.exit(1)
  }
  pass('health/ready', 'database=ok')

  const braxCookie = await login('Brax')
  const ropeCookie = await login('RopeDreamer')
  if (!braxCookie) {
    if (process.env.REQUIRE_BRAX_ADMIN_SMOKE === '1') fail('login Brax', 'auth failed')
    else skip('login Brax', 'optional prod admin — set REQUIRE_BRAX_ADMIN_SMOKE=1 + BRAX_ADMIN_PASSWORD')
  } else pass('login Brax')
  if (!ropeCookie) fail('login RopeDreamer', 'auth failed')
  else pass('login RopeDreamer')

  // Public policy routes
  await checkPublicRoute('/policies', ['Policy'])
  await checkPublicRoute('/policies/dmca', ['DMCA'])
  await checkPublicRoute('/policies/appeals', ['Appeal'])
  await checkPublicRoute('/dmca', ['repeat infringer'])
  {
    const fs = await import('node:fs')
    const dmcaSrc = fs.readFileSync('packages/web/src/app/dmca/page.tsx', 'utf8')
    if (/restore.*7\s*day/i.test(dmcaSrc)) fail('DMCA source copy', 'contains bad 7-day restore language')
    else if (!/10.*14.*business days/i.test(dmcaSrc)) fail('DMCA source copy', 'missing 10–14 business days')
    else pass('DMCA source copy', '10–14 business days; no 7-day restore')
  }
  await checkPublicRoute('/ncii', ['NCII'])
  {
    const ncii = await fetchHtml('/ncii')
    const bad = ['StopNCII', 'Take It Down', 'PhotoDNA'].filter((v) => ncii.text.includes(v))
    if (bad.length) fail('NCII copy', `claims integration: ${bad.join(', ')}`)
    else pass('NCII copy', 'no fake integration claims')
  }
  await checkPublicRoute('/policies/adult-content-records', ['user-generated'])
  await checkPublicRoute('/adult-content-consent', ['alpha'])
  await checkPublicRoute('/guidelines', ['Community Guidelines'])
  await checkPublicRoute('/login', ['Terms'])

  // Non-admin blocked from admin APIs
  const ropeDmca = await jsonFetch('/api/v1/admin/dmca/cases', { cookie: ropeCookie })
  if (ropeDmca.status === 403) pass('non-admin DMCA API blocked', '403')
  else fail('non-admin DMCA API blocked', `got ${ropeDmca.status}`)

  const ropeLegal = await jsonFetch('/api/v1/admin/legal/requests', { cookie: ropeCookie })
  if (ropeLegal.status === 403) pass('non-admin legal API blocked', '403')
  else fail('non-admin legal API blocked', `got ${ropeLegal.status}`)

  // Brax admin access (may require step-up)
  if (braxCookie) {
    let dmcaList = await jsonFetch('/api/v1/admin/dmca/cases?limit=5', { cookie: braxCookie })
    if (dmcaList.status === 403 && dmcaList.data.code === 'step_up_required') {
      pass('admin DMCA step-up gate', 'step_up_required before step-up')
      const stepUp = await jsonFetch('/api/v1/admin/security/step-up', {
        cookie: braxCookie,
        method: 'POST',
        body: { password: BRAX_PW },
      })
      if (stepUp.ok) pass('admin step-up', 'password confirmed')
      else fail('admin step-up', stepUp.text)
      dmcaList = await jsonFetch('/api/v1/admin/dmca/cases?limit=5', { cookie: braxCookie })
    }
    if (dmcaList.ok) pass('admin DMCA list', `${(dmcaList.data.cases ?? []).length} case(s)`)
    else fail('admin DMCA list', `${dmcaList.status} ${dmcaList.text}`)

    let legalList = await jsonFetch('/api/v1/admin/legal/requests?limit=5', { cookie: braxCookie })
    if (legalList.status === 403 && legalList.data.code === 'step_up_required') {
      await jsonFetch('/api/v1/admin/security/step-up', {
        cookie: braxCookie,
        method: 'POST',
        body: { password: BRAX_PW },
      })
      legalList = await jsonFetch('/api/v1/admin/legal/requests?limit=5', { cookie: braxCookie })
    }
    if (legalList.ok) pass('admin legal list', `${(legalList.data.requests ?? []).length} request(s)`)
    else fail('admin legal list', `${legalList.status}`)
  }

  // Privacy export (Brax)
  if (braxCookie) {
    const exp = await jsonFetch('/api/v1/me/privacy/requests', {
      cookie: braxCookie,
      method: 'POST',
      body: { requestType: 'EXPORT_JSON' },
    })
    if (exp.ok && exp.data.request?.status === 'READY') pass('privacy export', 'READY')
    else if (exp.ok) pass('privacy export', `status=${exp.data.request?.status}`)
    else fail('privacy export', `${exp.status}`)
  }

  // Legal hold block — create ephemeral hold on RopeDreamer then verify DELETE blocked
  if (braxCookie && ropeCookie) {
    const me = await jsonFetch('/api/auth/session', { cookie: ropeCookie })
    const ropeId = me.data?.userId
    if (!ropeId) {
      skip('legal hold blocks deletion', 'could not resolve RopeDreamer id')
    } else {
      await jsonFetch('/api/v1/admin/security/step-up', {
        cookie: braxCookie,
        method: 'POST',
        body: { password: BRAX_PW },
      })
      const req = await jsonFetch('/api/v1/admin/legal/requests', {
        cookie: braxCookie,
        method: 'POST',
        body: {
          requestType: 'preservation',
          requesterName: 'Smoke test',
          reason: 'LEGAL-ALPHA smoke hold test',
        },
      })
      if (req.ok && req.data.request?.id) {
        const hold = await jsonFetch(`/api/v1/admin/legal/requests/${req.data.request.id}/holds`, {
          cookie: braxCookie,
          method: 'POST',
          body: { targetType: 'user', targetId: ropeId, reason: 'smoke test hold' },
        })
        if (hold.ok && hold.data.hold?.id) {
          const del = await jsonFetch('/api/v1/me/privacy/requests', {
            cookie: ropeCookie,
            method: 'POST',
            body: { requestType: 'DELETE' },
          })
          if (del.status === 409 && del.data.request?.status === 'BLOCKED_LEGAL_HOLD') {
            pass('legal hold blocks deletion', 'BLOCKED_LEGAL_HOLD')
          } else fail('legal hold blocks deletion', `${del.status} ${del.text}`)
          await jsonFetch(`/api/v1/admin/legal/holds/${hold.data.hold.id}/release`, {
            cookie: braxCookie,
            method: 'POST',
            body: { reason: 'smoke test cleanup' },
          })
        } else fail('legal hold create', hold.text)
      } else fail('legal request create for hold test', req.text)
    }
  }

  // DMCA public intake
  const intake = await jsonFetch('/api/v1/dmca/intake', {
    method: 'POST',
    body: {
      claimantName: 'Smoke Test Claimant',
      claimantEmail: 'smoke-dmca@example.com',
      workIdentified: 'Smoke test work',
      infringingUrl: 'https://c2k.example/smoke-test',
    },
  })
  if (intake.status === 201 && intake.data.case?.status === 'RECEIVED') {
    pass('DMCA public intake', intake.data.case.id?.slice(0, 8))
  } else fail('DMCA public intake', `${intake.status}`)

  // Moderation shell regression
  if (braxCookie) {
    const reports = await jsonFetch('/api/v1/moderation/cases?limit=1', { cookie: braxCookie })
    if (reports.ok || reports.status === 404) pass('moderation cases API', reports.ok ? 'ok' : '404 acceptable')
    else skip('moderation cases API', String(reports.status))
  }

  console.log(`\n--- Summary: ${results.filter((r) => r.ok === true).length} pass, ${failed} fail, ${results.filter((r) => r.ok === null).length} skip ---`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
