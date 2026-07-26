import { test, expect, devices } from '@playwright/test'

const demoPassword = process.env.E2E_DEMO_PASSWORD ?? 'demo'
const convSlug = 'preview-c2k-weekend'
const orgSlug = 'demo-east-collective'
const doorPath = `/organizer/orgs/${orgSlug}/conventions/${convSlug}/door`

test.use({ ...devices['iPhone 13'] })

test.describe('door check-in', () => {
  test('mobile door mode loads and checks in seeded registrant', async ({ page, request }) => {
    const ready = await request.get('/api/health/ready')
    expect(ready.ok()).toBeTruthy()
    const health = (await ready.json()) as { database?: string }
    test.skip(health.database !== 'ok', 'Skipping: DB not available (run docker compose + npm run db:prepare)')

    const login = await page.request.post('/api/auth/session', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ username: 'RopeDreamer', password: demoPassword }),
    })
    test.skip(!login.ok(), 'Skipping: demo login failed (seed DB + RopeDreamer)')

    const bootstrap = await page.request.get(
      `/api/v1/conventions/${convSlug}/organizer/bootstrap`,
    )
    test.skip(!bootstrap.ok(), 'Skipping: organizer bootstrap unavailable for preview convention')

    await page.goto(doorPath)
    await expect(page.getByTestId('door-search')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByPlaceholder('Scan or paste QR payload…')).toBeVisible()
    await expect(page.getByPlaceholder('Type to search…')).toBeVisible()

    const search = page.getByTestId('door-search')
    await search.fill('Rope Dreamer')
    await expect(page.getByRole('button', { name: 'Rope Dreamer' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Rope Dreamer' }).click()

    const checkInBtn = page.getByTestId('door-check-in-submit')
    if (await checkInBtn.isVisible()) {
      await checkInBtn.click()
      await expect(page.getByText(/Checked in: Rope Dreamer/i)).toBeVisible({ timeout: 15_000 })
    } else {
      await expect(page.getByText('Already on-site')).toBeVisible()
    }
  })
})
