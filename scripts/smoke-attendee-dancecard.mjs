/**
 * Attendee dancecard API smoke for preview-c2k-weekend (RopeDreamer session).
 *   node scripts/smoke-attendee-dancecard.mjs
 */
const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:5173'
const API = process.env.API_BASE ?? BASE
const CONV = process.env.SMOKE_CONV ?? 'preview-c2k-weekend'
const USER = process.env.SMOKE_USER ?? 'RopeDreamer'
const PASS = process.env.E2E_DEMO_PASSWORD ?? process.env.DEMO_LOGIN_PASSWORD ?? 'demo'

const results = []

function pass(name, detail = '') {
  results.push({ ok: true, name, detail })
  console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name, detail = '') {
  results.push({ ok: false, name, detail })
  console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const login = await fetch(`${API}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  })
  if (!login.ok) {
    fail('login', `${login.status}`)
    summarize()
    process.exit(1)
  }
  const cookie = login.headers.get('set-cookie') ?? ''
  const hdr = { cookie, credentials: 'include' }

  const base = `${API}/api/v1/conventions/${encodeURIComponent(CONV)}`

  const access = await fetch(`${base}/access`, { headers: hdr })
  if (!access.ok) {
    fail('GET convention/access', String(access.status))
  } else {
    const j = await access.json()
    if (j.hasPaidAccess || j.canView) pass('GET convention/access', `hasPaidAccess=${Boolean(j.hasPaidAccess)}`)
    else fail('GET convention/access', 'missing access — run db:ensure-preview-attendee-parity')
  }

  const open = await fetch(`${base}/volunteer-shifts/open`, { headers: hdr })
  if (!open.ok) fail('GET volunteer-shifts/open', String(open.status))
  else {
    const j = await open.json()
    const n = (j.shifts ?? []).length
    if (n > 0) pass('GET volunteer-shifts/open', `${n} shift(s)`)
    else fail('GET volunteer-shifts/open', 'no open shifts — run parity seed')
  }

  const policies = await fetch(`${base}/policies/published`, { headers: hdr })
  if (!policies.ok) fail('GET policies/published', String(policies.status))
  else {
    const j = await policies.json()
    pass('GET policies/published', `${(j.policies ?? []).length} policy(ies)`)
  }

  const cal = await fetch(`${base}/dancecard/calendar`, { headers: hdr })
  if (!cal.ok) fail('GET dancecard/calendar', String(cal.status))
  else pass('GET dancecard/calendar')

  const swaps = await fetch(`${base}/shift-swaps/mine`, { headers: hdr })
  if (!swaps.ok) fail('GET shift-swaps/mine', String(swaps.status))
  else pass('GET shift-swaps/mine')

  const eligible = await fetch(`${base}/shift-swaps/eligible-shifts`, { headers: hdr })
  if (!eligible.ok) fail('GET shift-swaps/eligible-shifts', String(eligible.status))
  else {
    const j = await eligible.json()
    pass('GET shift-swaps/eligible-shifts', `mine=${(j.myShifts ?? []).length} open=${(j.openShifts ?? []).length}`)
  }

  const groups = await fetch(`${base}/attendee-groups`, { headers: hdr })
  if (!groups.ok) fail('GET attendee-groups', String(groups.status))
  else {
    const j = await groups.json()
    const tent = (j.groups ?? []).find((g) => g.name === 'Tent City')
    if (tent) pass('GET attendee-groups', 'Tent City present')
    else fail('GET attendee-groups', 'Tent City missing')
  }

  summarize()
  process.exit(results.some((r) => !r.ok) ? 1 : 0)
}

function summarize() {
  const ok = results.filter((r) => r.ok).length
  console.log(`\n${ok}/${results.length} passed`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
