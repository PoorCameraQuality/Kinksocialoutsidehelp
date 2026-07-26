import { test, expect } from '@playwright/test'
import { loginPage, isDbReady } from './helpers/auth'
import { organizerConventionPath } from './helpers/fixtures'
import { attachConsoleGuard } from './helpers/assertions'

test.describe('people signups', () => {
  test('signups sub-tab loads', async ({ page, request }) => {
    test.skip(!(await isDbReady(request)), 'DB not ready')
    const ok = await loginPage(page)
    test.skip(!ok, 'demo login unavailable')
    attachConsoleGuard(page)
    await page.goto(`${organizerConventionPath()}?tab=people&peopleTab=signups`)
    await expect(page.getByText(/signup|registrant|check-in/i).first()).toBeVisible({ timeout: 20_000 })
  })
})
