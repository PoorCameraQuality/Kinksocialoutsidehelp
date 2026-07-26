import path from 'node:path'
import { test, expect } from '@playwright/test'
import { loginPage, isDbReady } from './helpers/auth'
import { attachConsoleGuard } from './helpers/assertions'

const FIXTURE_IMAGE = path.join(
  process.cwd(),
  'packages/web/public/landing/happy-face-emoji-xo9Ho2tuRnU.jpg',
)

async function checkAllAttestations(page: import('@playwright/test').Page) {
  const boxes = page.getByTestId('media-upload-composer').getByRole('checkbox')
  const count = await boxes.count()
  for (let i = 0; i < count; i += 1) {
    await boxes.nth(i).check()
  }
}

test.describe('media upload', () => {
  test('anonymous visitor is redirected from /create to login', async ({ page }) => {
    attachConsoleGuard(page)
    await page.goto('/create')
    await expect(page).toHaveURL(/\/?(\?|&)login=1/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { level: 2, name: 'Welcome back' })).toBeVisible()
  })

  test.describe('authenticated composer', () => {
    test.beforeEach(async ({ page }) => {
      const ok = await loginPage(page)
      test.skip(!ok, 'demo login unavailable')
      attachConsoleGuard(page)
    })

    test('create page loads upload composer with picture and video tabs', async ({ page }) => {
      await page.goto('/create')
      await expect(page.getByRole('heading', { level: 1, name: 'Create' })).toBeVisible({ timeout: 15_000 })
      await expect(page.getByTestId('media-upload-composer')).toBeVisible()
      await expect(page.getByTestId('media-upload-tab-picture')).toBeVisible()
      await expect(page.getByTestId('media-upload-tab-video')).toBeVisible()
    })

    test('video tab switches dropzone label', async ({ page }) => {
      await page.goto('/create')
      await page.getByTestId('media-upload-tab-video').click()
      await expect(page.getByText('Add a video')).toBeVisible()
      await page.getByTestId('media-upload-tab-picture').click()
      await expect(page.getByText('Add pictures')).toBeVisible()
    })

    test('publish stays disabled until a file is staged', async ({ page }) => {
      await page.goto('/create')
      await expect(page.getByTestId('media-upload-publish')).toBeDisabled()
    })

    test('attestation checklist blocks publish until all boxes are checked', async ({ page }) => {
      await page.goto('/create')
      await page.getByTestId('media-upload-dropzone').locator('input[type="file"]').setInputFiles(FIXTURE_IMAGE)
      await expect(page.getByTestId('media-upload-publish')).toBeEnabled()
      await page.getByTestId('media-upload-publish').click()
      await expect(page.getByText(/complete all attestation confirmations/i)).toBeVisible()
    })
  })

  test.describe('upload pipeline (database)', () => {
    test.beforeEach(async ({ page, request }) => {
      test.skip(!(await isDbReady(request)), 'DB not ready. Run docker compose + npm run db:prepare')
      const ok = await loginPage(page)
      test.skip(!ok, 'demo login unavailable')
      attachConsoleGuard(page)
    })

    test('picture upload publishes and navigates to media detail', async ({ page }) => {
      test.setTimeout(120_000)
      await page.goto('/create')
      await page.getByTestId('media-upload-dropzone').locator('input[type="file"]').setInputFiles(FIXTURE_IMAGE)
      await checkAllAttestations(page)
      await page.getByTestId('media-upload-publish').click()
      await expect(page).toHaveURL(/\/media\/item\//, { timeout: 90_000 })
      await expect(page.getByText(/upload published|media/i).first()).toBeVisible({ timeout: 15_000 })
    })
  })
})
