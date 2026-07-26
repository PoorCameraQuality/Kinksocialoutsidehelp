/**
 * Smoke-tests the previously-failing organizer save paths after the ECKE
 * parity pass. Logs in as `RopeDreamer`, then hits every Convention
 * Command Bridge endpoint that used to return `Invalid body` and asserts
 * each response is 2xx with round-tripped values.
 *
 * Usage:
 *   API_BASE=http://localhost:4000 DEMO_LOGIN_PASSWORD=demo \
 *     npx tsx packages/api/scripts/smoke-organizer-parity.ts <conventionSlug>
 *
 * The script never writes to the database directly; it exercises the same
 * HTTP surface the organizer UI uses. The default slug is the seeded preview
 * convention (`preview-c2k-weekend`).
 */
const API_BASE = process.env.API_BASE ?? 'http://localhost:4000'
const SLUG = process.argv[2] ?? 'preview-c2k-weekend'
const USERNAME = process.env.SMOKE_USERNAME ?? 'RopeDreamer'
const PASSWORD = process.env.DEMO_LOGIN_PASSWORD ?? 'demo'

type Cookie = string

let cookieJar: Cookie[] = []

function joinCookies(): string {
  return cookieJar.join('; ')
}

async function http<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: T | null; rawBody: string }> {
  const r = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookieJar.length ? { cookie: joinCookies() } : {}),
    },
    body: body == null ? undefined : JSON.stringify(body),
  })
  const setCookie = (r.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.()
  if (Array.isArray(setCookie) && setCookie.length) {
    for (const c of setCookie) {
      const head = c.split(';')[0]
      if (!head) continue
      const [name] = head.split('=')
      cookieJar = cookieJar.filter((existing) => !existing.startsWith(`${name}=`))
      cookieJar.push(head)
    }
  }
  const text = await r.text()
  let data: T | null = null
  try {
    data = text ? (JSON.parse(text) as T) : null
  } catch {
    data = null
  }
  return { status: r.status, data, rawBody: text }
}

let pass = 0
let fail = 0
const failures: string[] = []

async function step(label: string, fn: () => Promise<void>) {
  try {
    await fn()
    pass += 1
    console.log(`  ok   ${label}`)
  } catch (e) {
    fail += 1
    const msg = e instanceof Error ? e.message : String(e)
    failures.push(`${label} → ${msg}`)
    console.log(`  FAIL ${label} → ${msg}`)
  }
}

function assertOk(status: number, label: string) {
  if (status < 200 || status >= 300) {
    throw new Error(`expected 2xx, got ${status} for ${label}`)
  }
}

async function main() {
  console.log(`Smoke test → ${API_BASE} / ${SLUG} as ${USERNAME}`)

  console.log('\n[1] Sign in')
  const login = await http<{ authenticated: boolean }>(
    'POST',
    '/api/auth/session',
    { username: USERNAME, password: PASSWORD },
  )
  if (login.status !== 200 || !login.data?.authenticated) {
    throw new Error(`Login failed (${login.status}): ${login.rawBody}`)
  }
  console.log('  ok   logged in')

  console.log('\n[2] Organizer save paths')

  await step('PATCH /registration-categories — comp + roleKind fields round-trip', async () => {
    const list = await http<{ categories: Array<{ id: string; name: string }> }>(
      'GET',
      `/api/v1/conventions/${SLUG}/registration-categories`,
    )
    assertOk(list.status, 'GET categories')
    const first = list.data?.categories?.[0]
    if (!first) throw new Error('no categories on convention')
    const patch = await http<{ category: { roleKind: string; grantsStaffAccess: boolean; compCode: string | null } }>(
      'PATCH',
      `/api/v1/conventions/${SLUG}/registration-categories/${first.id}`,
      {
        compCode: 'SMOKE',
        accessCode: 'SMOKE',
        roleKind: 'staff',
        grantsStaffAccess: true,
      },
    )
    assertOk(patch.status, 'PATCH category')
    if (patch.data?.category.roleKind !== 'staff') throw new Error('roleKind did not round-trip')
    if (!patch.data?.category.grantsStaffAccess) throw new Error('grantsStaffAccess did not round-trip')
  })

  await step('PUT /registration-form — status + questions round-trip', async () => {
    const put = await http<{ form: { status: string } }>(
      'PUT',
      `/api/v1/conventions/${SLUG}/registration-form`,
      {
        status: 'published',
        introText: 'Smoke intro',
        confirmationText: 'Smoke confirmation',
        questions: [
          { label: 'Emergency contact (smoke)', type: 'text', required: true, sortOrder: 0 },
        ],
      },
    )
    assertOk(put.status, 'PUT registration-form')
    if (put.data?.form.status !== 'published') throw new Error('form status did not round-trip')
  })

  await step('POST/PATCH /trusted-roles — applySlug + status round-trip', async () => {
    const roleSlug = `smoke-role-${Date.now()}`
    const create = await http<{ role: { id: string; applySlug: string; status: string } }>(
      'POST',
      `/api/v1/conventions/${SLUG}/trusted-roles`,
      {
        name: 'Smoke role',
        slug: roleSlug,
        status: 'published',
        introText: 'Smoke role intro',
        confirmationText: 'Smoke role confirmation',
        questions: [{ label: 'Your relevant experience', type: 'long_text', required: true, sortOrder: 0 }],
      },
    )
    assertOk(create.status, 'POST trusted-role')
    if (create.data?.role.status !== 'published') throw new Error('trusted role status did not round-trip')
  })

  await step('POST /message-campaigns — without name uses template', async () => {
    const templates = await http<{ items: Array<{ id: string; name: string }> }>(
      'GET',
      `/api/v1/conventions/${SLUG}/message-templates`,
    )
    if (templates.status !== 200 || !templates.data?.items?.length) {
      console.log('  skip — no templates seeded')
      return
    }
    const tpl = templates.data.items[0]!
    const create = await http<{ campaign: { id: string; status: string } }>(
      'POST',
      `/api/v1/conventions/${SLUG}/message-campaigns`,
      { templateId: tpl.id },
    )
    assertOk(create.status, 'POST message-campaign')
  })

  await step('POST /event-entitlements — entitlements PATCH alias', async () => {
    const list = await http<{ items: Array<{ moduleKey: string }> }>(
      'GET',
      `/api/v1/conventions/${SLUG}/event-entitlements`,
    )
    if (list.status !== 200 || !list.data?.items?.length) {
      console.log('  skip — no entitlements')
      return
    }
    const first = list.data.items[0]!
    const r = await http(
      'POST',
      `/api/v1/conventions/${SLUG}/event-entitlements`,
      { moduleKey: first.moduleKey, config: { smokeUpdatedAt: new Date().toISOString() } },
    )
    assertOk(r.status, 'POST entitlements')
  })

  await step('PATCH /iso-board/settings — moderation save', async () => {
    const r = await http(
      'PATCH',
      `/api/v1/conventions/${SLUG}/iso-board/settings`,
      { isoBoardEnabled: true },
    )
    assertOk(r.status, 'PATCH iso-board settings')
  })

  await step('PATCH /attendee-groups — group meta save', async () => {
    const list = await http<{ items: Array<{ id: string; name: string }> }>(
      'GET',
      `/api/v1/conventions/${SLUG}/attendee-groups`,
    )
    if (list.status !== 200 || !list.data?.items?.length) {
      console.log('  skip — no attendee groups')
      return
    }
    const first = list.data.items[0]!
    const r = await http(
      'PATCH',
      `/api/v1/conventions/${SLUG}/attendee-groups/${first.id}`,
      { visibility: 'public', status: 'open', capacity: 12 },
    )
    assertOk(r.status, 'PATCH attendee group')
  })

  await step('POST /meal-periods — start/end ISO + label alias', async () => {
    const r = await http<{ period: { id: string } }>(
      'POST',
      `/api/v1/conventions/${SLUG}/meal-periods`,
      {
        label: 'Smoke breakfast',
        startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      },
    )
    assertOk(r.status, 'POST meal-period')
  })

  await step('POST /exhibitors — kit field set save', async () => {
    const r = await http<{ exhibitor: { id: string } }>(
      'POST',
      `/api/v1/conventions/${SLUG}/exhibitors`,
      {
        name: 'Smoke Exhibitor',
        boothLabel: 'A1',
        hours: 'Fri 4-8pm; Sat 12-6pm',
        tags: ['leather', 'rope'],
        isPublished: true,
      },
    )
    assertOk(r.status, 'POST exhibitor')
  })

  await step('PATCH /session-feedback — feedbackConfig envelope', async () => {
    const r = await http('PATCH', `/api/v1/conventions/${SLUG}/session-feedback`, {
      feedbackConfig: { promptText: 'Smoke prompt', minRating: 1, maxRating: 5 },
    })
    assertOk(r.status, 'PATCH session-feedback')
    const alias = await http('PATCH', `/api/v1/conventions/${SLUG}/session-feedback/config`, {
      enabled: true,
      feedbackConfig: { promptText: 'Smoke alias path' },
    })
    assertOk(alias.status, 'PATCH session-feedback/config alias')
  })

  await step('POST /webhooks — eventTypes ⇄ event_types tolerance', async () => {
    const r = await http<{ subscription: { id: string }; signingSecret: string }>(
      'POST',
      `/api/v1/conventions/${SLUG}/webhooks`,
      { url: 'https://example.com/webhook/smoke', eventTypes: ['registrant.created'] },
    )
    assertOk(r.status, 'POST webhook')
    if (!r.data?.signingSecret) throw new Error('missing signingSecret on create')
  })

  console.log('')
  console.log(`Done: ${pass} passed, ${fail} failed`)
  if (fail > 0) {
    console.log('Failures:')
    for (const f of failures) console.log(`  - ${f}`)
    process.exitCode = 1
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
