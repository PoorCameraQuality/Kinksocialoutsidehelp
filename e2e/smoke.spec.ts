import { test, expect } from '@playwright/test'
import { waitForPageSettled } from './helpers/assertions'

const demoPassword = process.env.E2E_DEMO_PASSWORD ?? 'demo'

test.describe('smoke', () => {
  test('api GET /api/health liveness', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { ok?: boolean }
    expect(body.ok).toBe(true)
  })

  test('api GET /api/health/live', async ({ request }) => {
    const res = await request.get('/api/health/live')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { ok?: boolean }
    expect(body.ok).toBe(true)
  })

  test('api GET /api/health/storage', async ({ request }) => {
    const res = await request.get('/api/health/storage')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { ok?: boolean; s3?: string }
    expect(body.ok).toBeDefined()
    expect(['ok', 'error', 'skipped']).toContain(body.s3)
  })

  test('api GET /api/health/ecke', async ({ request }) => {
    const res = await request.get('/api/health/ecke')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { ok?: boolean; enabled?: boolean; mode?: string }
    expect(body.ok).toBeDefined()
    expect(body.mode).toBeTruthy()
  })

  test('api GET /api/health/worker', async ({ request }) => {
    const res = await request.get('/api/health/worker')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { ok?: boolean; worker?: string }
    expect(body.ok).toBeDefined()
    expect(['ok', 'stale', 'missing', 'skipped']).toContain(body.worker)
  })

  test('web GET /health.json', async ({ request }) => {
    const res = await request.get('/health.json')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { ok?: boolean; service?: string }
    expect(body.ok).toBe(true)
    expect(body.service).toBe('web')
  })

  test('api GET /api/health/error-test is hidden by default', async ({ request }) => {
    const res = await request.get('/api/health/error-test')
    expect(res.status()).toBe(404)
  })

  test('api GET /api/health/ready', async ({ request }) => {
    const res = await request.get('/api/health/ready')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { ok?: boolean; ready?: boolean; database?: string }
    expect(body.ok).toBe(true)
    expect(body.ready).toBe(true)
    if (process.env.CI_REQUIRE_DB === 'true') {
      expect(body.database).toBe('ok')
    } else {
      expect(['ok', 'skipped']).toContain(body.database)
    }
  })

  test('api GET /api/auth/me after demo session', async ({ request }) => {
    const login = await request.post('/api/auth/session', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ username: 'RopeDreamer', password: demoPassword }),
    })
    test.skip(
      !login.ok(),
      'Skipping: POST /api/auth/session failed (seed DB + RopeDreamer, or set E2E_DEMO_PASSWORD)'
    )
    const me = await request.get('/api/auth/me')
    expect(me.ok()).toBeTruthy()
    const body = (await me.json()) as {
      viewer?: { authenticated?: boolean; username?: string | null; sub?: string | null }
    }
    expect(body.viewer?.authenticated).toBe(true)
    expect(body.viewer?.username).toBeTruthy()
    expect(body.viewer?.sub).toBeTruthy()
  })

  test('landing shows auth screen', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Kink Social home' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Join free' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Log in' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Join free' })).toBeVisible()
  })

  test('home feed shows Home feed scope tabs', async ({ page }) => {
    const login = await page.request.post('/api/auth/session', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ username: 'RopeDreamer', password: demoPassword }),
    })
    test.skip(
      !login.ok(),
      'Skipping: POST /api/auth/session failed (seed DB + RopeDreamer, or set E2E_DEMO_PASSWORD)',
    )
    await page.goto('/home?mode=discover&tab=Local')
    const homeScope = page.getByRole('tablist', { name: 'Home feed scope' })
    await expect(homeScope).toBeVisible()
    await expect(homeScope.getByRole('tab', { name: 'Near you' })).toBeVisible()
    await expect(page.getByRole('tablist', { name: 'Community activity scope' })).toHaveCount(0)
  })

  test('home shows following and near you when signed in', async ({ page }) => {
    const login = await page.request.post('/api/auth/session', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ username: 'RopeDreamer', password: demoPassword }),
    })
    test.skip(
      !login.ok(),
      'Skipping: POST /api/auth/session failed (seed DB + RopeDreamer, or set E2E_DEMO_PASSWORD)',
    )
    await page.goto('/home')
    const homeScope = page.getByRole('tablist', { name: 'Home feed scope' })
    await expect(homeScope).toBeVisible()
    await expect(homeScope.getByRole('tab', { name: 'Following' })).toBeVisible()
    await expect(homeScope.getByRole('tab', { name: 'Near you' })).toBeVisible()
  })

  test('following feed lists followed author posts and excludes own posts', async ({ page }) => {
    const authorLogin = await page.request.post('/api/auth/session', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ username: 'RopeDreamer', password: demoPassword }),
    })
    test.skip(!authorLogin.ok(), 'Skipping: demo login failed (seed DB + RopeDreamer)')

    const body = `e2e-following-feed ${Date.now()}`
    const postRes = await page.request.post('/api/v1/feed/posts', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ kind: 'status', body, bodyFormat: 'text' }),
    })
    test.skip(!postRes.ok(), 'Skipping: POST /feed/posts failed')
    const postJson = (await postRes.json()) as { post?: { id?: string } }
    test.skip(!postJson.post?.id, 'Skipping: no post id returned')

    // Author must not see their own post on Following (FetLife-style).
    const authorFeedRes = await page.request.get('/api/v1/feed/following?limit=10')
    expect(authorFeedRes.ok()).toBeTruthy()
    const authorFeed = (await authorFeedRes.json()) as {
      items?: Array<{ kind?: string; post?: { id?: string; body?: string }; object?: { id?: string } }>
    }
    const ownFound = (authorFeed.items ?? []).some(
      (it) =>
        (it.kind === 'post' && it.post?.body === body) ||
        (it.kind === 'activity' && it.object?.id === postJson.post?.id),
    )
    expect(ownFound).toBe(false)

    await page.request.post('/api/auth/logout').catch(() => undefined)
    const braxPassword =
      process.env.E2E_SITE_ADMIN_PASSWORD ?? process.env.BRAX_ADMIN_PASSWORD ?? 'Airship!2'
    const followerLogin = await page.request.post('/api/auth/session', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ username: 'Brax', password: braxPassword }),
    })
    test.skip(!followerLogin.ok(), 'Skipping: Brax login failed')

    const followRes = await page.request.post('/api/v1/users/RopeDreamer/follow')
    // Already-following is still ok: route returns 200 with { ok: true }
    test.skip(!followRes.ok(), 'Skipping: could not follow RopeDreamer')

    const followerFeedRes = await page.request.get('/api/v1/feed/following?limit=20')
    expect(followerFeedRes.ok()).toBeTruthy()
    const followerFeed = (await followerFeedRes.json()) as {
      items?: Array<{ kind?: string; post?: { id?: string; body?: string }; object?: { id?: string } }>
    }
    const found = (followerFeed.items ?? []).some(
      (it) =>
        (it.kind === 'post' && it.post?.body === body) ||
        (it.kind === 'activity' && it.object?.id === postJson.post?.id),
    )
    expect(found).toBe(true)

    await page.goto('/home?mode=following')
    const homeScope = page.getByRole('tablist', { name: 'Home feed scope' })
    await expect(homeScope.getByRole('tab', { name: 'Following', selected: true })).toBeVisible()
    await expect(page.getByRole('tablist', { name: 'Following feed filters' })).toBeVisible({ timeout: 15_000 })
  })

  test('notifications page loads', async ({ page }) => {
    await page.goto('/notifications')
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible()
  })

  test('messaging page loads', async ({ page }) => {
    await page.goto('/messaging')
    await expect(page.getByRole('heading', { name: 'Messages', level: 1 })).toBeVisible({ timeout: 15_000 })
  })

  test('organizations list page loads', async ({ page }) => {
    await page.goto('/orgs')
    await waitForPageSettled(page)
    await expect(page.getByRole('heading', { name: 'Organizations', level: 1 })).toBeVisible({
      timeout: 20_000,
    })
  })

  test('conventions program page handles missing slug', async ({ page }) => {
    await page.goto('/conventions/nonexistent-slug-xyz')
    await expect(page.getByText(/No convention matches|Network error/i)).toBeVisible({ timeout: 15_000 })
  })

  test('demo login reaches connections when API DB is seeded', async ({ page }) => {
    const res = await page.request.post('/api/auth/session', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ username: 'RopeDreamer', password: demoPassword }),
    })
    test.skip(
      !res.ok(),
      'Skipping: POST /api/auth/session failed (start Docker Postgres + run npm run db:prepare, or set E2E_DEMO_PASSWORD)'
    )
    await page.goto('/connections')
    await expect(page.getByRole('heading', { name: 'Connections' })).toBeVisible()
  })

  test('vendor onboarding wizard loads when signed in', async ({ page }) => {
    const res = await page.request.post('/api/auth/session', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ username: 'RopeDreamer', password: demoPassword }),
    })
    test.skip(!res.ok(), 'Skipping: demo login failed')
    await page.goto('/vendors/onboarding')
    await expect(page.getByRole('heading', { name: /Set up your vendor shop|Shop basics|Connect your inventory/i })).toBeVisible()
  })

  test('seeded anchored convention shows schedule and slot titles', async ({ page, request }) => {
    const slotsRes = await request.get('/api/v1/conventions/seed-demo-con-program/slots')
    test.skip(
      !slotsRes.ok(),
      'Skipping: no seeded convention (run npm run db:prepare or db:seed with USE_DATABASE=true)'
    )
    await page.goto('/conventions/seed-demo-con-program')
    await expect(page.getByRole('tab', { name: 'Schedule' })).toBeVisible({ timeout: 15_000 })
    const slots = (await slotsRes.json()) as { items?: Array<{ title?: string }> }
    const firstTitle = slots.items?.[0]?.title ?? ''
    test.skip(!firstTitle, 'Skipping: convention has no seeded slots')
    await expect(page.getByText(firstTitle, { exact: false }).first()).toBeVisible({ timeout: 15_000 })
  })

  test('seeded org event shows full schedule link and munch fields', async ({ page, request }) => {
    const orgRes = await request.get('/api/v1/organizations/demo-east-collective/events')
    test.skip(!orgRes.ok(), 'Skipping: org events unavailable (DB off or calendar disabled)')
    const body = (await orgRes.json()) as { items?: Array<{ id: string; hasProgram?: boolean }> }
    const withProgram = body.items?.find((e) => e.hasProgram)
    test.skip(!withProgram, 'Skipping: no org event with program (re-run db:seed)')
    const detail = await request.get(`/api/v1/events/${withProgram.id}`)
    test.skip(!detail.ok(), 'Skipping: event detail unavailable')
    const ev = (await detail.json()) as { event?: { expectedCostText?: string | null } }
    await page.goto(`/events/${withProgram.id}`)
    await expect(page.getByRole('link', { name: /View (full )?schedule/i })).toBeVisible({ timeout: 15_000 })
    const cost = ev.event?.expectedCostText?.trim()
    if (cost) {
      await expect(page.getByText(cost, { exact: false }).first()).toBeVisible({ timeout: 10_000 })
    }
  })

  test('org hub calendar shows Program badge when event has program', async ({ page, request }) => {
    const slotsRes = await request.get('/api/v1/conventions/seed-demo-con-program/slots')
    test.skip(!slotsRes.ok(), 'Skipping: anchored convention seed not present')
    await page.goto('/orgs/demo-east-collective')
    await page.getByRole('tab', { name: 'Calendar' }).click()
    await expect(page.getByText('Program').first()).toBeVisible()
  })

  test('GET /api/v1/events?groupId rejects unknown group', async ({ request }) => {
    const res = await request.get(
      `/api/v1/events?groupId=${encodeURIComponent('00000000-0000-4000-8000-000000000001')}`,
    )
    expect(res.status()).toBe(404)
  })

  test('GET /api/v1/events supports format and category filters', async ({ request }) => {
    const allRes = await request.get('/api/v1/events')
    test.skip(!allRes.ok(), 'Skipping: events list unavailable (DB off)')
    const all = (await allRes.json()) as { items?: Array<{ eventFormat?: string }> }
    test.skip(!Array.isArray(all.items) || all.items.length === 0, 'Skipping: no seeded events')

    const virtualRes = await request.get('/api/v1/events?format=virtual')
    expect(virtualRes.ok()).toBeTruthy()
    const virtual = (await virtualRes.json()) as { items?: Array<{ eventFormat?: string }> }
    expect((virtual.items ?? []).every((e) => e.eventFormat === 'virtual')).toBe(true)

    const socialRes = await request.get('/api/v1/events?category=Social&category=Munch')
    expect(socialRes.ok()).toBeTruthy()
    const social = (await socialRes.json()) as { items?: Array<{ category?: string | null }> }
    for (const row of social.items ?? []) {
      const cat = (row.category ?? '').toLowerCase()
      expect(cat === 'social' || cat === 'munch').toBe(true)
    }
  })

  test('events page category and format filters when DB seeded', async ({ page, request }) => {
    const allRes = await request.get('/api/v1/events')
    test.skip(!allRes.ok(), 'Skipping: events list unavailable (DB off)')
    const all = (await allRes.json()) as { items?: unknown[] }
    test.skip(!Array.isArray(all.items) || all.items.length === 0, 'Skipping: no seeded events')

    await page.goto('/events')
    await waitForPageSettled(page)
    await expect(page.getByRole('heading', { name: 'Events', level: 1 })).toBeVisible({ timeout: 15_000 })

    // Discover page: filters live in a collapsible left-rail panel (radios + checkboxes).
    const filtersToggle = page.getByRole('button', { name: 'Filters' }).first()
    await filtersToggle.click()
    await page.getByRole('radiogroup', { name: 'Event format' }).getByLabel('Virtual').check()
    await expect(page.getByRole('radio', { name: 'Virtual' })).toBeChecked()

    await page.getByRole('checkbox', { name: 'Social' }).check()
    await expect(page.getByRole('checkbox', { name: 'Social' })).toBeChecked()
  })

  test('GET /api/v1/groups/nearby requires location or session', async ({ request }) => {
    const res = await request.get('/api/v1/groups/nearby')
    expect([400, 401]).toContain(res.status())
  })

  test('GET /api/v1/conventions/:slug/me/participation requires auth', async ({ request }) => {
    const res = await request.get('/api/v1/conventions/preview-c2k-weekend/me/participation')
    expect(res.status()).toBe(401)
  })

  test('GET /api/v1/conventions/:slug/me/participation for demo user', async ({ request }) => {
    const login = await request.post('/api/auth/session', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ username: 'RopeDreamer', password: demoPassword }),
    })
    test.skip(!login.ok(), 'Skipping: demo session unavailable')
    const res = await request.get('/api/v1/conventions/preview-c2k-weekend/me/participation')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { participation?: { userId?: string; profile?: { email?: string } } }
    expect(body.participation?.userId).toBeTruthy()
    expect(body.participation?.profile?.email).toBeTruthy()
  })

  test('GET /api/v1/groups/nearby with lat/lng returns items array', async ({ request }) => {
    const res = await request.get('/api/v1/groups/nearby?lat=39.95&lng=-75.16&radius=100')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { items?: unknown[]; origin?: { lat: number; lng: number } }
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.origin?.lat).toBeCloseTo(39.95, 1)
  })

  test('create group appears on /groups when API DB is seeded', async ({ page }) => {
    const login = await page.request.post('/api/auth/session', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ username: 'RopeDreamer', password: demoPassword }),
    })
    test.skip(!login.ok(), 'Skipping: demo login failed (seed DB + RopeDreamer)')

    const probe = await page.request.post('/api/v1/groups', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        name: 'e2e-probe',
        slug: `e2e-probe-${Date.now().toString(36)}`,
        visibility: 'public',
      }),
    })
    test.skip(!probe.ok(), 'Skipping: POST /api/v1/groups failed (DB off)')

    const groupName = `e2e-create-group ${Date.now()}`
    await page.goto('/groups')
    await expect(page.getByRole('heading', { name: 'Groups', level: 1 })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Create Group' }).click()
    await expect(page.getByRole('dialog', { name: 'Create group' })).toBeVisible()
    await page.getByLabel('Name').fill(groupName)
    await page.getByRole('dialog', { name: 'Create group' }).getByRole('button', { name: 'Create group' }).click()
    await expect(page.getByText(groupName, { exact: false }).first()).toBeVisible({ timeout: 15_000 })
  })

  test('GET /api/v1/events/:id includes viewerCanManage for host session', async ({ request }) => {
    const login = await request.post('/api/auth/session', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ username: 'RopeDreamer', password: demoPassword }),
    })
    test.skip(!login.ok(), 'Skipping: demo session unavailable')
    const orgRes = await request.get('/api/v1/organizations/demo-east-collective/events')
    test.skip(!orgRes.ok(), 'Skipping: org events unavailable')
    const body = (await orgRes.json()) as { items?: Array<{ id: string }> }
    const eventId = body.items?.[0]?.id
    test.skip(!eventId, 'Skipping: no org events in seed')
    const detail = await request.get(`/api/v1/events/${eventId}`)
    expect(detail.ok()).toBeTruthy()
    const ev = (await detail.json()) as { event?: { viewerCanManage?: boolean } }
    expect(ev.event?.viewerCanManage).toBe(true)
  })

  test('preview convention dancecard hub shows attendee feature cards', async ({ page }) => {
    const login = await page.request.post('/api/auth/session', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ username: 'RopeDreamer', password: demoPassword }),
    })
    test.skip(!login.ok(), 'Skipping: demo session unavailable')
    await page.goto('/conventions/preview-c2k-weekend?tab=Dancecard')
    await expect(page.getByRole('tab', { name: 'Dancecard' })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('tab', { name: 'Dancecard' }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'Program' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Program' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'My availability' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Attendee groups' })).toBeVisible()
  })

  test('preview dancecard lists open volunteer shifts when seeded', async ({ page }) => {
    const login = await page.request.post('/api/auth/session', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ username: 'RopeDreamer', password: demoPassword }),
    })
    test.skip(!login.ok(), 'Skipping: demo session unavailable')
    const open = await page.request.get('/api/v1/conventions/preview-c2k-weekend/volunteer-shifts/open')
    test.skip(!open.ok(), 'Skipping: volunteer-shifts API unavailable')
    const body = (await open.json()) as { shifts?: unknown[] }
    test.skip(!Array.isArray(body.shifts) || body.shifts.length === 0, 'Skipping: no open shifts in seed')
    await page.goto('/conventions/preview-c2k-weekend?tab=Dancecard')
    await page.getByRole('button', { name: 'My availability' }).click()
    await expect(page.getByRole('heading', { level: 3, name: 'Open volunteer shifts' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('button', { name: 'Claim shift' }).first()).toBeVisible()
  })

  test('PWA manifest is linked from HTML shell', async ({ page }) => {
    await page.goto('/')
    const href = await page.locator('link[rel="manifest"]').getAttribute('href')
    expect(href).toBe('/manifest.json')
    const manifest = await page.request.get('/manifest.json')
    expect(manifest.ok()).toBeTruthy()
    const body = (await manifest.json()) as { name?: string; start_url?: string }
    expect(body.name).toContain('Coast to Coast Kink')
    expect(body.start_url).toBe('/home')
  })

  test('settings privacy section loads when signed in', async ({ page }) => {
    const login = await page.request.post('/api/auth/session', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ username: 'RopeDreamer', password: demoPassword }),
    })
    test.skip(!login.ok(), 'Skipping: demo session unavailable')
    await page.goto('/settings/privacy')
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Following & discovery', level: 2 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Events on your profile', level: 2 })).toBeVisible()
  })

  test('member chrome defaults to midnight-velvet appearance', async ({ page }) => {
    await page.goto('/')
    const chrome = page.locator('.dc-gold-chrome').first()
    await expect(chrome).toBeVisible({ timeout: 15_000 })
    await expect(chrome).toHaveAttribute('data-dc-appearance', 'midnight-velvet')
  })

  test('settings appearance theme persists in localStorage', async ({ page }) => {
    const login = await page.request.post('/api/auth/session', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ username: 'RopeDreamer', password: demoPassword }),
    })
    test.skip(!login.ok(), 'Skipping: demo session unavailable')

    await page.goto('/settings')
    const themeSelect = page.getByLabel('Site appearance theme')
    await expect(themeSelect).toBeVisible({ timeout: 15_000 })

    await themeSelect.selectOption('parchment')
    await page.reload()
    await expect(themeSelect).toHaveValue('parchment')
    await expect(page.locator('.dc-gold-chrome').first()).toHaveAttribute('data-dc-appearance', 'parchment')

    await themeSelect.selectOption('lifted-ink')
    await expect(page.locator('.dc-gold-chrome').first()).toHaveAttribute('data-dc-appearance', 'lifted-ink', {
      timeout: 10_000,
    })
  })

  test('convention hub Schedule tab renders on preview', async ({ page }) => {
    const login = await page.request.post('/api/auth/session', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ username: 'RopeDreamer', password: demoPassword }),
    })
    test.skip(!login.ok(), 'Skipping: demo session unavailable')
    await page.goto('/conventions/preview-c2k-weekend?tab=Schedule')
    await expect(page.getByRole('tab', { name: 'Schedule' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('tab', { name: 'Schedule', selected: true })).toBeVisible()
  })
})
