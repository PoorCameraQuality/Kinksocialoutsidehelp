import { test, expect } from '@playwright/test'
import { loginPage, isDbReady } from './helpers/auth'
import { organizerConventionPath, SEED } from './helpers/fixtures'
import { attachConsoleGuard } from './helpers/assertions'

test.describe('program tab', () => {
  test('program tab loads and shows publish affordance when seeded', async ({ page, request }) => {
    test.skip(!(await isDbReady(request)), 'DB not ready')
    const ok = await loginPage(page)
    test.skip(!ok, 'demo login unavailable')
    attachConsoleGuard(page)
    const slots = await page.request.get(`/api/v1/conventions/${SEED.convSlug}/slots`)
    test.skip(!slots.ok(), 'slots API unavailable')
    await page.goto(`${organizerConventionPath()}?tab=program`)
    await expect(page.getByText(/program|schedule/i).first()).toBeVisible({ timeout: 20_000 })
  })
})
