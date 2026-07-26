import { test, expect } from '@playwright/test'
import { loginPage } from './helpers/auth'
import { attachConsoleGuard } from './helpers/assertions'

test.describe('event create flow', () => {
  test.beforeEach(async ({ page }) => {
    const ok = await loginPage(page)
    test.skip(!ok, 'demo login unavailable')
    attachConsoleGuard(page)
  })

  test('create event modal opens from query param', async ({ page }) => {
    await page.goto('/events?create=event')
    await expect(page.getByRole('dialog', { name: /create event/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('create-event-next')).toBeVisible()
  })

  test('create flow shows validation on empty continue', async ({ page }) => {
    await page.goto('/events?create=event')
    await expect(page.getByTestId('create-event-next')).toBeVisible({ timeout: 15_000 })
    await page.getByTestId('create-event-next').click()
    await expect(page.getByRole('alert')).toBeVisible()
  })
})
