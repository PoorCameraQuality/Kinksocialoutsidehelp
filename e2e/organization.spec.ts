import { test, expect } from '@playwright/test'
import { loginPage, isDbReady } from './helpers/auth'
import { SEED } from './helpers/fixtures'
import { attachConsoleGuard } from './helpers/assertions'

test.describe('organization workflows', () => {
  test('org hub calendar tab loads when seeded', async ({ page, request }) => {
    test.skip(!(await isDbReady(request)), 'DB not ready')
    const ok = await loginPage(page)
    test.skip(!ok, 'demo login unavailable')
    attachConsoleGuard(page)
    await page.goto(`/orgs/${SEED.orgSlug}`)
    await page.getByRole('tab', { name: 'Calendar' }).click()
    await expect(page.getByText(/Program|event/i).first()).toBeVisible({ timeout: 15_000 })
  })

  test('organizer console loads for demo org', async ({ page, request }) => {
    test.skip(!(await isDbReady(request)), 'DB not ready')
    const ok = await loginPage(page)
    test.skip(!ok, 'demo login unavailable')
    attachConsoleGuard(page)
    await page.goto(`/organizer/orgs/${SEED.orgSlug}`)
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 20_000 })
  })
})
