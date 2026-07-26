import { test, expect } from '@playwright/test'
import { clearMailpit, pollMailpitConfirmToken } from './helpers/mailpit'

test.describe.configure({ mode: 'serial' })

test.describe('mail', () => {
  test.beforeAll(async ({ request }) => {
    await clearMailpit(request)
  })

  test('email confirm page shows missing token message', async ({ page }) => {
    await page.goto('/email/confirm')
    await expect(page.getByRole('heading', { name: 'Confirm email' })).toBeVisible()
    await expect(page.getByText('Missing confirmation token.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to home' })).toBeVisible()
  })

  test('email confirm page handles invalid token when DB is on', async ({ page, request }) => {
    const ready = await request.get('/api/health/ready')
    expect(ready.ok()).toBeTruthy()
    const health = (await ready.json()) as { database?: string }
    test.skip(
      health.database !== 'ok',
      'Skipping: DB not available (run docker compose + npm run db:prepare)',
    )

    await page.goto('/email/confirm?token=000000000000000000000000000000000000000000000000')
    await expect(page.getByRole('heading', { name: 'Confirm email' })).toBeVisible()
    await expect(page.getByText(/Invalid|expired|Could not confirm/i)).toBeVisible({ timeout: 15_000 })
  })

  test('email confirm page succeeds with valid token when scope list is configured', async ({
    page,
    request,
  }) => {
    const ready = await request.get('/api/health/ready')
    expect(ready.ok()).toBeTruthy()
    const health = (await ready.json()) as { database?: string }
    test.skip(health.database !== 'ok', 'Skipping: DB not available')

    const orgSlug = process.env.SMOKE_ORG_SLUG ?? 'demo-east-collective'
    const meta = await request.get(`/api/v1/organizations/${orgSlug}/email-list-meta`)
    test.skip(!meta.ok(), 'Skipping: org email-list-meta unavailable')
    const metaBody = (await meta.json()) as { enabled?: boolean; doubleOptIn?: boolean }
    test.skip(
      !metaBody.enabled || !metaBody.doubleOptIn,
      'Skipping: org email list or double opt-in not enabled',
    )

    await clearMailpit(request)

    const email = `e2e-optin-${Date.now()}@mailpit.local`
    const sub = await request.post(`/api/v1/organizations/${orgSlug}/email-subscribe`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ email, displayName: 'E2E opt-in', consent: true }),
    })
    const subBody = (await sub.json()) as { ok?: boolean; pending?: boolean }
    test.skip(!sub.ok() || !subBody.pending, 'Skipping: email-subscribe failed or not pending')

    const token = await pollMailpitConfirmToken(request, email)
    test.skip(!token, 'Skipping: confirm email not found in Mailpit')

    await page.goto(`/email/confirm?token=${encodeURIComponent(token)}`)
    await expect(page.getByRole('heading', { name: 'Confirm email' })).toBeVisible()
    await expect(page.getByText(/subscribed|confirmed/i)).toBeVisible({ timeout: 20_000 })
  })
})
