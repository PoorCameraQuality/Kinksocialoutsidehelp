import { test, expect } from '@playwright/test'
import { setupAuthenticatedPage, gotoSettled, demoProfilePath } from './helpers/page-setup'
import { expectNoHorizontalOverflow } from './helpers/assertions'

test.describe('Pass 4 · profile surfaces desktop', () => {
  test.beforeEach(async ({ page, request }) => {
    await setupAuthenticatedPage(page, request)
  })

  test('demo profile loads hero and section cards', async ({ page }) => {
    await gotoSettled(page, demoProfilePath())
    await expect(page.locator('.c2k-profile-hero').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('profile page has no runtime error surface', async ({ page }) => {
    await gotoSettled(page, demoProfilePath())
    await expect(page.locator('body')).not.toContainText(/Unhandled Runtime Error/i)
  })
})

test.describe('Pass 4 · profile mobile 390', () => {
  test.beforeEach(async ({ page, request }) => {
    await setupAuthenticatedPage(page, request)
    await page.setViewportSize({ width: 390, height: 844 })
  })

  test('mobile profile has no horizontal overflow', async ({ page }) => {
    await gotoSettled(page, demoProfilePath())
    await expectNoHorizontalOverflow(page)
  })
})
