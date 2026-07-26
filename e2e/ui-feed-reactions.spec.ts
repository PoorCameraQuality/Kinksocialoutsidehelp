import { test, expect } from '@playwright/test'
import { setupAuthenticatedPage, ensureFollowingFeedPost } from './helpers/page-setup'
import { expectVisibleInViewport, expectFloatingAboveFeedCard } from './helpers/layering'
import { VIEWPORTS } from './helpers/viewports'

async function openFirstPostReactionPicker(page: import('@playwright/test').Page): Promise<void> {
  const post = page.locator('article.feed-stream-post').first()
  await expect(post).toBeVisible({ timeout: 15_000 })
  const reactBtn = post.getByRole('button', { name: /React to this post|Change reaction/i }).first()
  await expect(reactBtn).toBeVisible()
  await reactBtn.click()
}

test.describe('Pass 4 · feed reaction picker desktop', () => {
  test.describe.configure({ timeout: 60_000 })

  test.beforeEach(async ({ page, request }) => {
    await setupAuthenticatedPage(page, request)
    const ok = await ensureFollowingFeedPost(page)
    test.skip(!ok, 'Could not create feed post or Following feed empty (DB/API)')
  })

  test('React opens picker with Love, Respect, Sympathize, Helpful', async ({ page }) => {
    await openFirstPostReactionPicker(page)
    const popover = page.locator('.feed-reaction-picker__popover')
    await expect(popover).toBeVisible({ timeout: 10_000 })
    for (const label of ['Love', 'Respect', 'Sympathize', 'Helpful']) {
      await expect(popover.getByText(label, { exact: true }).first()).toBeVisible()
    }
  })

  test('selecting Love sets active reaction state', async ({ page }) => {
    await openFirstPostReactionPicker(page)
    const popover = page.locator('.feed-reaction-picker__popover')
    await popover.getByRole('menuitemradio', { name: /Love/i }).first().click()
    await expect(page.getByRole('button', { name: /Loved\. Change reaction/i }).first()).toBeVisible({
      timeout: 10_000,
    })
  })

  test('reaction picker is not clipped and stacks above feed card', async ({ page }) => {
    await openFirstPostReactionPicker(page)
    const popover = page.locator('.feed-reaction-picker__popover')
    await expectVisibleInViewport(popover)
    await expectFloatingAboveFeedCard(page, '.feed-reaction-picker__popover')
  })
})

test.describe('Pass 4 · feed reaction picker mobile 390', () => {
  test.describe.configure({ timeout: 60_000 })

  test.beforeEach(async ({ page, request }) => {
    await setupAuthenticatedPage(page, request)
    await page.setViewportSize(VIEWPORTS.mobile)
    const ok = await ensureFollowingFeedPost(page)
    test.skip(!ok, 'Could not create feed post or Following feed empty (DB/API)')
  })

  test('mobile reaction sheet opens and options are tappable', async ({ page }) => {
    await openFirstPostReactionPicker(page)
    const sheet = page.locator('.feed-reaction-picker__sheet')
    await expect(sheet).toBeVisible({ timeout: 10_000 })
    await expect(sheet.getByText('Love', { exact: true }).first()).toBeVisible()
    await expect(sheet.getByText('Respect', { exact: true }).first()).toBeVisible()
    await sheet.getByRole('menuitemradio', { name: /Respect/i }).first().click()
    await expect(page.getByRole('button', { name: /Respected\. Change reaction/i }).first()).toBeVisible({
      timeout: 10_000,
    })
  })
})
