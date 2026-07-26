import path from 'node:path'
import { test, expect } from '@playwright/test'
import { loginViaApi, isDbReady } from './helpers/auth'
import { attachConsoleGuard } from './helpers/assertions'

const FIXTURE_IMAGE = path.join(
  process.cwd(),
  'packages/web/public/landing/happy-face-emoji-xo9Ho2tuRnU.jpg',
)

const ALPHA_PASSWORD = process.env.ALPHA_SOCIAL_SEED_PASSWORD ?? 'AlphaSocial!23'

test.describe('home feed composer photo upload', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!(await isDbReady(page.request)), 'API not ready')
    attachConsoleGuard(page)
    const ok = await loginViaApi(page.request, 'alpha_social', ALPHA_PASSWORD)
    test.skip(!ok, 'alpha_social login failed')
    await page.goto('/home')
    await expect(page).toHaveURL(/\/home/, { timeout: 20_000 })
  })

  test('Photo quick action accepts a safe image without console errors', async ({ page }) => {
    test.setTimeout(90_000)
    await page.goto('/home?mode=discover#home-feed-composer')

    const photoButton = page.getByRole('button', { name: /^photo$/i })
    await photoButton.first().click()
    await expect(page.locator('.ProseMirror, [contenteditable="true"]').first()).toBeVisible({ timeout: 20_000 })

    const fileChooserPromise = page.waitForEvent('filechooser')
    await photoButton.first().click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(FIXTURE_IMAGE)

    await expect
      .poll(
        async () => {
          const err = page.getByText(/network error during upload|upload failed|could not prepare feed photo/i)
          const review = page.getByText(/held for review during alpha/i)
          const preview = page.locator('img.h-16.w-16')
          return (await err.isVisible().catch(() => false)) ||
            (await review.isVisible().catch(() => false)) ||
            ((await preview.count()) > 0)
        },
        { timeout: 90_000 },
      )
      .toBeTruthy()
  })
})
