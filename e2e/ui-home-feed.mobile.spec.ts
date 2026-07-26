import { test, expect } from '@playwright/test'
import { setupAuthenticatedPage, gotoSettled, ensureFollowingFeedPost } from './helpers/page-setup'
import { expectNoHorizontalOverflow } from './helpers/assertions'
import { VIEWPORTS } from './helpers/viewports'

test.describe('Pass 4 · home feed mobile 390', () => {
  test.beforeEach(async ({ page, request }) => {
    await setupAuthenticatedPage(page, request)
    await page.setViewportSize(VIEWPORTS.mobile)
  })

  test('mobile home feed loads composer and bottom nav', async ({ page }) => {
    await gotoSettled(page, '/home')
    await expect(page.getByRole('tablist', { name: 'Home feed scope' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('navigation', { name: 'Bottom navigation' })).toBeVisible({ timeout: 15_000 })
    const composer = page.locator('#home-feed-composer, #local-home-feed-composer').first()
    await expect(composer).toBeVisible()
  })

  test('mobile home feed has no horizontal overflow', async ({ page }) => {
    await gotoSettled(page, '/home')
    await expectNoHorizontalOverflow(page)
  })

  test('mobile feed action bar fits viewport when post exists', async ({ page }) => {
    test.setTimeout(60_000)
    const ok = await ensureFollowingFeedPost(page)
    test.skip(!ok, 'Could not create feed post or Following feed empty (DB/API)')

    const actionBar = page.locator('.feed-action-bar').first()
    await expect(actionBar).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
})
