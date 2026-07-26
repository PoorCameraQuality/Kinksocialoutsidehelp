#!/usr/bin/env node
/**
 * Full Convention Command Bridge audit — probes every GET path the UI calls
 * under `/api/v1/conventions/:key/…` and verifies RBAC boundaries.
 */
const BASE = process.env.SMOKE_BASE ?? 'http://localhost:5173'
const CONV = process.env.SMOKE_CONV ?? 'preview-c2k-weekend'
const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD ?? process.env.DEMO_LOGIN_PASSWORD ?? 'demo'
const BRAX_PASSWORD = process.env.BRAX_ADMIN_PASSWORD ?? 'Airship!2'

async function login(username, password = DEMO_PASSWORD) {
  const res = await fetch(`${BASE}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error(`Login ${username} failed: ${res.status}`)
  const cookie = res.headers.getSetCookie?.()?.[0] ?? res.headers.get('set-cookie')
  if (!cookie) throw new Error(`No session cookie for ${username}`)
  return cookie.split(';')[0]
}

async function probe(cookie, url, label) {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', Cookie: cookie },
    })
    const text = await res.text()
    let snippet = text.slice(0, 80).replace(/\s+/g, ' ')
    if (/<!doctype html/i.test(text)) snippet = '(HTML page — likely 404 route)'
    return { label, url, status: res.status, snippet }
  } catch (e) {
    return { label, url, status: 'ERR', snippet: e.message }
  }
}

async function api(cookie, path, init = {}) {
  const res = await fetch(`${BASE}/api/v1/conventions/${CONV}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Cookie: cookie,
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* ignore */
  }
  return { status: res.status, json, text: text.slice(0, 120) }
}

async function grantUser(ownerCookie, targetUserId, flags) {
  return api(ownerCookie, `/command-team/${targetUserId}`, {
    method: 'PUT',
    body: JSON.stringify(flags),
  })
}

/** GET paths used by organizer panels via organizerDancecardFetch (v1 base). */
const V1_GET_PATHS = [
  '/organizer/bootstrap',
  '/organizer/command-access',
  '/organizer/print-data',
  '/event',
  '/locations',
  '/program-slots',
  '/program-conflicts',
  '/staff-shifts',
  '/dm-requirements',
  '/tracks',
  '/tags',
  '/readiness',
  '/readiness/summary',
  '/maps',
  '/imports',
  '/registrants?limit=5&offset=0',
  '/message-templates',
  '/message-campaigns',
  '/exports/sessions',
  '/exports/conflict-report',
  '/exports/event-pack',
  '/api-keys',
  '/webhooks',
  '/embed-tokens',
  '/event-entitlements',
  '/shift-swaps',
  '/vetting-applications',
  '/safety-incidents',
  '/command-team',
  '/people',
  '/registration-categories',
  '/registration-form',
  '/policy-documents',
  '/policy-acceptances/stats',
  '/policy-acceptances/export?format=csv',
  '/session-feedback',
  '/trusted-roles',
  '/participation-settings',
  '/participation-offers',
  '/calendar-feeds',
  '/iso',
  '/iso/comments',
  '/attendee-groups',
  '/exhibitors',
  '/meal-periods',
  '/meal-signups',
  '/volunteer-compliance',
  '/google-sheets/connection',
  '/badges/print-data',
  '/ops/live',
  '/registrant-inbound-secret',
  '/door/roster',
  '/registrants/export',
  '/registrants/lookup?q=demo',
]

/** Legacy dancecard API — should stay unimplemented (web migrated to v1). */
const LEGACY_PATHS = [
  '/registrants/export',
  '/door/roster',
  '/exports/event-pack',
  '/events',
]

function bucket(status) {
  if (status === 'ERR') return 'ERROR'
  if (status === 200) return 'OK'
  if (status === 403) return 'FORBIDDEN'
  if (status === 401) return 'UNAUTH'
  if (status === 404) return 'MISSING'
  if (status === 503) return 'OTHER'
  if (status >= 500) return 'SERVER'
  return 'OTHER'
}

async function runRbacMatrix(ownerCookie, leatherCookie, leatherId) {
  console.log('\n=== RBAC MATRIX (LeatherCraftDemo) ===')
  const failures = []

  async function check(label, cond, detail = '') {
    const mark = cond ? '✓' : '✗'
    console.log(`  ${mark} ${label}${detail ? ` — ${detail}` : ''}`)
    if (!cond) failures.push(label)
  }

  await grantUser(ownerCookie, leatherId, {
    canRegistration: true,
    canStaffOps: false,
    canScheduler: false,
    note: 'Audit registration-only',
  })
  let r = await api(leatherCookie, '/ops/live')
  await check('registration-only GET /ops/live → 200', r.status === 200, String(r.status))
  r = await api(leatherCookie, '/door/roster')
  await check('registration-only GET /door/roster → 200', r.status === 200, String(r.status))
  r = await api(leatherCookie, '/people')
  await check('registration-only GET /people → 403', r.status === 403, String(r.status))
  r = await api(leatherCookie, '/program-slots')
  await check('registration-only GET /program-slots → 403', r.status === 403, String(r.status))

  await grantUser(ownerCookie, leatherId, {
    canRegistration: false,
    canStaffOps: false,
    canScheduler: true,
    note: 'Audit scheduler-only',
  })
  r = await api(leatherCookie, '/program-slots')
  await check('scheduler-only GET /program-slots → 200', r.status === 200, String(r.status))
  r = await api(leatherCookie, '/registrants?limit=1&offset=0')
  await check('scheduler-only GET /registrants → 403', r.status === 403, String(r.status))

  await grantUser(ownerCookie, leatherId, {
    canRegistration: false,
    canStaffOps: true,
    canScheduler: false,
    note: 'Audit staff-only',
  })
  r = await api(leatherCookie, '/people')
  await check('staff-only GET /people → 200', r.status === 200, String(r.status))
  r = await api(leatherCookie, '/volunteer-compliance')
  await check('staff-only GET /volunteer-compliance → 200', r.status === 200, String(r.status))
  r = await api(leatherCookie, '/registration-form')
  await check('staff-only GET /registration-form → 403', r.status === 403, String(r.status))

  await grantUser(ownerCookie, leatherId, {
    canRegistration: true,
    canStaffOps: true,
    canScheduler: true,
    note: 'Audit restore full grants',
  })

  return failures
}

async function main() {
  console.log(`Command Bridge audit\nBase: ${BASE}\nConvention: ${CONV}\n`)

  let cookie
  try {
    cookie = await login('RopeDreamer')
  } catch (e) {
    console.error('Cannot login — is dev server running?', e.message)
    process.exit(1)
  }

  const results = []

  for (const path of V1_GET_PATHS) {
    const url = `${BASE}/api/v1/conventions/${CONV}${path}`
    results.push(await probe(cookie, url, `v1 GET ${path}`))
  }

  console.log('\n=== LEGACY API (informational — expect 404) ===')
  for (const path of LEGACY_PATHS) {
    const url = `${BASE}/api/organizer/dancecard/${CONV}${path}`
    const r = await probe(cookie, url, `legacy GET ${path}`)
    console.log(`  ${r.status === 404 ? '○' : '?'} ${r.label} → ${r.status}`)
  }

  results.push(
    await probe(
      cookie,
      `${BASE}/api/v1/conventions/${CONV}/ecke-publish`,
      'ecke-publish GET',
    ),
  )

  const groups = { OK: [], MISSING: [], SERVER: [], FORBIDDEN: [], ERROR: [], OTHER: [] }
  for (const r of results) {
    const b = bucket(r.status)
    ;(groups[b] ?? groups.OTHER).push(r)
  }

  console.log('\n=== WORKING (200) ===')
  for (const r of groups.OK) console.log(`  ✓ ${r.label}`)

  console.log(`\n=== MISSING / NOT IMPLEMENTED (${groups.MISSING.length}) ===`)
  for (const r of groups.MISSING) console.log(`  ✗ ${r.label} → ${r.status} ${r.snippet}`)

  console.log(`\n=== SERVER ERRORS (${groups.SERVER.length}) ===`)
  for (const r of groups.SERVER) console.log(`  ✗ ${r.label} → ${r.status} ${r.snippet}`)

  console.log(`\n=== OTHER (${groups.OTHER.length + groups.FORBIDDEN.length + groups.ERROR.length}) ===`)
  for (const r of [...groups.FORBIDDEN, ...groups.OTHER, ...groups.ERROR]) {
    console.log(`  ? ${r.label} → ${r.status} ${r.snippet}`)
  }

  let rbacFailures = []
  try {
    const ownerCookie = await login('Brax', BRAX_PASSWORD)
    const leatherCookie = await login('LeatherCraftDemo')
    const picker = await api(ownerCookie, '/organizer/user-picker?q=LeatherCraftDemo')
    const leatherId = picker.json?.users?.find((u) => u.username === 'LeatherCraftDemo')?.userId
    if (leatherId) {
      rbacFailures = await runRbacMatrix(ownerCookie, leatherCookie, leatherId)
    } else {
      console.log('\n=== RBAC MATRIX — skipped (LeatherCraftDemo not in user-picker) ===')
    }
  } catch (e) {
    console.log(`\n=== RBAC MATRIX — skipped (${e.message}) ===`)
  }

  console.log('\n=== SUMMARY ===')
  console.log(`Total v1 probes: ${results.length}`)
  console.log(`OK: ${groups.OK.length} | 404: ${groups.MISSING.length} | 5xx: ${groups.SERVER.length} | other: ${groups.OTHER.length + groups.FORBIDDEN.length + groups.ERROR.length}`)
  if (rbacFailures.length) console.log(`RBAC failures: ${rbacFailures.length}`)

  const broken = [...groups.MISSING, ...groups.SERVER, ...groups.ERROR, ...rbacFailures.map((l) => ({ label: l }))]
  if (broken.length) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
