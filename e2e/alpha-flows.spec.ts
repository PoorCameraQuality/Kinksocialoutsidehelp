import { test, expect } from '@playwright/test'
import { loginPage, loginPageAs, isDbReady } from './helpers/auth'
import { attachConsoleGuard, expectNoHorizontalOverflow, waitForPageSettled } from './helpers/assertions'
import { SEED, doorPath, organizerConventionPath } from './helpers/fixtures'
import { VIEWPORTS } from './helpers/viewports'

test.describe('alpha flows · UI-1', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await isDbReady(request)), 'DB not ready. Run docker compose + npm run db:prepare')
  })

  test('onboarding wizard loads for signed-in members', async ({ page }) => {
    const ok = await loginPage(page)
    test.skip(!ok, 'demo login unavailable')
    attachConsoleGuard(page)
    await page.goto('/onboarding')
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: /welcome to kink\.social/i })).toBeVisible({
      timeout: 15_000,
    })
    await page.goto('/profile/complete')
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 })
  })

  test('legacy profile edit onboarding param redirects to wizard', async ({ page }) => {
    const ok = await loginPage(page)
    test.skip(!ok, 'demo login unavailable')
    attachConsoleGuard(page)
    await page.goto('/profile/edit?onboarding=1')
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 })
  })

  test('onboarding safety step shows encryption notice', async ({ page }) => {
    const ok = await loginPage(page)
    test.skip(!ok, 'demo login unavailable')
    attachConsoleGuard(page)
    await page.goto('/onboarding')
    const continueBtn = page.getByRole('button', { name: /^continue$/i })
    if (await continueBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await continueBtn.click()
    }
    await expect(page.getByText(/not end-to-end encrypted/i).first()).toBeVisible({ timeout: 15_000 })
  })

  test('incomplete profile nudge on home', async ({ page }) => {
    const ok = await loginPage(page)
    test.skip(!ok, 'demo login unavailable')
    attachConsoleGuard(page)
    await page.goto('/home')
    await waitForPageSettled(page)
    await expect(page.getByText(/finish your profile|complete profile/i).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('signed-in home shows main nav with Conventions', async ({ page }) => {
    attachConsoleGuard(page)
    const ok = await loginPage(page)
    test.skip(!ok, 'demo login unavailable')
    await page.goto('/home')
    await expect(
      page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', {
        name: 'Conventions',
        exact: true,
      }),
    ).toBeVisible({ timeout: 20_000 })
  })

  test('door denied when logged out', async ({ page }) => {
    attachConsoleGuard(page)
    await page.goto(doorPath())
    await expect(page.getByText(/sign in required|log in|sign in|unauthorized/i).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('organizer moderation panel has no TODO strings', async ({ page }) => {
    const ok = await loginPage(page)
    test.skip(!ok, 'demo login unavailable')
    attachConsoleGuard(page)
    await page.goto(`/organizer/orgs/${SEED.orgSlug}?tab=moderation`)
    await waitForPageSettled(page)
    await expect(page.locator('body')).not.toContainText(/\bTODO\b/i)
  })

  test('door staff can load door mode', async ({ page }) => {
    const ok = await loginPageAs(page, 'doorStaff')
    test.skip(!ok, 'door staff login unavailable')
    attachConsoleGuard(page)
    await page.goto(doorPath())
    await expect(page.getByTestId('door-search')).toBeVisible({ timeout: 25_000 })
  })
})

test.describe('alpha flows. Mobile overflow', () => {
  const criticalMobileRoutes = ['/', '/events', '/groups', '/home', '/conventions']

  for (const path of criticalMobileRoutes) {
    test(`no horizontal overflow on ${path}`, async ({ page, request }) => {
      if (path === '/home') {
        const ok = await loginPage(page)
        test.skip(!ok, 'demo login unavailable')
      }
      attachConsoleGuard(page)
      await page.setViewportSize(VIEWPORTS.mobile)
      await page.goto(path)
      await waitForPageSettled(page)
      await expectNoHorizontalOverflow(page)
    })
  }
})
