#!/usr/bin/env node
/** Smoke test convention command bridge API permissions. */
const BASE = process.env.SMOKE_BASE ?? 'http://localhost:5173'
const CONV = process.env.SMOKE_CONV ?? 'preview-c2k-weekend'
const DEMO_PASSWORD = process.env.DEMO_LOGIN_PASSWORD ?? 'demo'
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

function ok(label, cond, detail = '') {
  const mark = cond ? 'PASS' : 'FAIL'
  console.log(`${mark} ${label}${detail ? ` — ${detail}` : ''}`)
  return cond
}

async function main() {
  console.log(`Smoke: ${BASE} convention ${CONV}\n`)

  const ownerCookie = await login('Brax', BRAX_PASSWORD)
  const leatherCookie = await login('LeatherCraftDemo')

  const ownerAccess = await api(ownerCookie, '/organizer/command-access')
  ok('Owner command-access 200', ownerAccess.status === 200)
  ok('Owner isFullAdmin', ownerAccess.json?.permissions?.isFullAdmin === true)

  const ownerEvent = await api(ownerCookie, '/event')
  ok('Owner GET /event 200', ownerEvent.status === 200)

  const ownerPrint = await api(ownerCookie, '/organizer/print-data')
  ok('Owner GET /organizer/print-data 200', ownerPrint.status === 200)
  ok(
    'Print-data has slots',
    Array.isArray(ownerPrint.json?.slots) && ownerPrint.json.slots.length > 0,
    `${ownerPrint.json?.slots?.length ?? 0} slots`,
  )

  const ownerEcke = await fetch(`${BASE}/api/v1/conventions/${CONV}/ecke-publish`, {
    headers: { Accept: 'application/json', Cookie: ownerCookie },
  })
  ok('Owner ECKE publish GET 200', ownerEcke.status === 200)

  const ownerReadiness = await api(ownerCookie, '/readiness/summary')
  ok('Owner readiness/summary 200', ownerReadiness.status === 200)

  // Resolve LeatherCraftDemo user id via user-picker (owner)
  const picker = await api(ownerCookie, '/organizer/user-picker?q=LeatherCraftDemo')
  const leatherId = picker.json?.users?.find((u) => u.username === 'LeatherCraftDemo')?.userId
  if (!leatherId) {
    console.log('FAIL Could not resolve LeatherCraftDemo userId from user-picker')
    process.exit(1)
  }

  const grantReg = await grantUser(ownerCookie, leatherId, {
    canRegistration: true,
    canStaffOps: false,
    canScheduler: false,
    note: 'Smoke test registration-only',
  })
  ok('Owner PUT command-team (registration-only)', grantReg.status === 200, String(grantReg.status))

  const leatherAccess = await api(leatherCookie, '/organizer/command-access')
  ok('Leather command-access 200', leatherAccess.status === 200)
  const lp = leatherAccess.json?.permissions ?? {}
  ok('Leather registration only', lp.registration === true && lp.scheduler !== true && lp.isFullAdmin !== true)

  const leatherEvent = await api(leatherCookie, '/event')
  ok('Leather GET /event 403', leatherEvent.status === 403)

  const leatherProgram = await api(leatherCookie, '/program-slots')
  ok('Leather GET /program-slots 403', leatherProgram.status === 403)

  const leatherPrint = await api(leatherCookie, '/organizer/print-data')
  ok('Leather GET /organizer/print-data 403 (registration-only)', leatherPrint.status === 403)

  const leatherReadiness = await api(leatherCookie, '/readiness/summary')
  ok('Leather readiness/summary 403', leatherReadiness.status === 403)

  const ownerCategories = await api(ownerCookie, '/registration-categories')
  const pilotCategoryId =
    ownerCategories.json?.categories?.[0]?.id ?? ownerCategories.json?.items?.[0]?.id ?? null
  const registrantBody = pilotCategoryId ?
    { userId: leatherId, categoryId: pilotCategoryId }
  : { userId: leatherId }
  const leatherRegPost = await api(leatherCookie, '/registrants', {
    method: 'POST',
    body: JSON.stringify(registrantBody),
  })
  ok(
    'Leather POST /registrants 201/200/400 (not 403/500)',
    leatherRegPost.status !== 403 && leatherRegPost.status !== 500,
    String(leatherRegPost.status),
  )

  const grantSched = await grantUser(ownerCookie, leatherId, {
    canRegistration: false,
    canStaffOps: false,
    canScheduler: true,
    note: 'Smoke test scheduler-only',
  })
  ok('Owner PUT command-team (scheduler-only)', grantSched.status === 200, String(grantSched.status))

  const leatherSchedAccess = await api(leatherCookie, '/organizer/command-access')
  const sp = leatherSchedAccess.json?.permissions ?? {}
  ok('Leather scheduler only', sp.scheduler === true && sp.registration !== true)

  const leatherSchedProgram = await api(leatherCookie, '/program-slots')
  ok('Leather scheduler GET /program-slots 200', leatherSchedProgram.status === 200)

  const leatherSchedPrint = await api(leatherCookie, '/organizer/print-data')
  ok('Leather scheduler GET /organizer/print-data 200', leatherSchedPrint.status === 200)

  const leatherSchedRegPost = await api(leatherCookie, '/registrants', {
    method: 'POST',
    body: JSON.stringify(registrantBody),
  })
  ok('Leather scheduler POST /registrants 403', leatherSchedRegPost.status === 403)

  const leatherEcke = await fetch(`${BASE}/api/v1/conventions/${CONV}/ecke-publish`, {
    headers: { Accept: 'application/json', Cookie: leatherCookie },
  })
  ok('Leather ECKE publish GET 403', leatherEcke.status === 403)

  // Anonymous print gate
  const anonAccess = await fetch(`${BASE}/api/v1/conventions/${CONV}/organizer/command-access`)
  ok('Anonymous command-access 401/403', anonAccess.status === 401 || anonAccess.status === 403, String(anonAccess.status))

  console.log('\nDone.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
