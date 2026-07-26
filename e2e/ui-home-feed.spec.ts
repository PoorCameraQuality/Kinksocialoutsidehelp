import { test, expect } from '@playwright/test'
import { setupAuthenticatedPage, gotoSettled, ensureFollowingFeedPost } from './helpers/page-setup'
import { waitForPageSettled } from './helpers/assertions'

test.describe('Pass 4 · home feed desktop', () => {
  test.beforeEach(async ({ page, request }) => {
    await setupAuthenticatedPage(page, request)
  })

  test('home feed loads with composer and scope tabs', async ({ page }) => {
    await gotoSettled(page, '/home')
    await expect(page.getByRole('tablist', { name: 'Home feed scope' })).toBeVisible({ timeout: 20_000 })
    const composer = page.locator('#home-feed-composer, #local-home-feed-composer').first()
    await expect(composer).toBeVisible({ timeout: 15_000 })
  })

  test('feed shows a post card when API post exists', async ({ page }) => {
    test.setTimeout(60_000)
    const ok = await ensureFollowingFeedPost(page)
    test.skip(!ok, 'Could not create feed post or Following feed empty (DB/API)')
    await expect(page.locator('article.feed-stream-post').first()).toBeVisible()
  })

  test('home feed has no runtime error surface', async ({ page }) => {
    await gotoSettled(page, '/home')
    await waitForPageSettled(page)
    await expect(page.locator('body')).not.toContainText(/Unhandled Runtime Error/i)
  })
})
