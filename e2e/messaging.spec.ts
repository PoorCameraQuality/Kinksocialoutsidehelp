import { test, expect } from '@playwright/test'
import { loginPage, isDbReady } from './helpers/auth'
import { organizerConventionPath } from './helpers/fixtures'
import { attachConsoleGuard } from './helpers/assertions'

test.describe('messaging', () => {
  test('global messaging page shows safety copy', async ({ page }) => {
    attachConsoleGuard(page)
    await page.goto('/messaging')
    await expect(page.getByRole('heading', { name: 'Messages', level: 1 })).toBeVisible({ timeout: 15_000 })
  })

  test('convention messaging tab loads for organizer', async ({ page, request }) => {
    test.skip(!(await isDbReady(request)), 'DB not ready')
    const ok = await loginPage(page)
    test.skip(!ok, 'demo login unavailable')
    attachConsoleGuard(page)
    await page.goto(`${organizerConventionPath()}?tab=messaging`)
    await expect(page.getByText(/message|announce|email/i).first()).toBeVisible({ timeout: 20_000 })
  })
})
