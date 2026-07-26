import { test, expect } from '@playwright/test'
import { loginPage, isDbReady } from './helpers/auth'
import { organizerConventionPath, doorPath } from './helpers/fixtures'
import { attachConsoleGuard } from './helpers/assertions'

test.describe('convention command bridge navigation', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await isDbReady(request)), 'DB not ready')
  })

  test('dashboard and program tabs navigate', async ({ page }) => {
    const ok = await loginPage(page)
    test.skip(!ok, 'demo login unavailable')
    attachConsoleGuard(page)
    await page.goto(`${organizerConventionPath()}?tab=dashboard`)
    await expect(page.getByText(/dashboard|overview|convention/i).first()).toBeVisible({
      timeout: 20_000,
    })
    await page.goto(`${organizerConventionPath()}?tab=program`)
    await expect(page.getByText(/program|schedule|session/i).first()).toBeVisible({ timeout: 20_000 })
  })

  test('door mode link route loads', async ({ page }) => {
    const ok = await loginPage(page)
    test.skip(!ok, 'demo login unavailable')
    attachConsoleGuard(page)
    await page.goto(doorPath())
    await expect(page.getByTestId('door-search')).toBeVisible({ timeout: 20_000 })
  })
})
