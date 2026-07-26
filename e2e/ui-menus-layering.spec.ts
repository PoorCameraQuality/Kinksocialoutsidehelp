import { test, expect } from '@playwright/test'
import { setupAuthenticatedPage, gotoSettled, ensureFollowingFeedPost } from './helpers/page-setup'
import { expectVisibleInViewport, scrollFeedPostForMenuOpen, expectFloatingAboveFeedCard } from './helpers/layering'
import { VIEWPORTS } from './helpers/viewports'

async function openPass4PostOverflowMenu(page: import('@playwright/test').Page): Promise<import('@playwright/test').Locator> {
  const marker = await ensureFollowingFeedPost(page)
  test.skip(!marker, 'Could not create feed post or Following feed empty (DB/API)')

  const post = page.locator('article.feed-stream-post').filter({ hasText: marker }).first()
  await expect(post).toBeVisible()
  await scrollFeedPostForMenuOpen(post)
  await post.getByRole('button', { name: 'More actions' }).click()
  const menu = page.getByRole('menu').filter({ has: page.getByRole('menuitem', { name: 'Copy link' }) })
  await expect(menu).toBeVisible()
  return menu
}

test.describe('Pass 4 · feed and header menu layering desktop', () => {
  test.describe.configure({ timeout: 60_000 })

  test.beforeEach(async ({ page, request }) => {
    await setupAuthenticatedPage(page, request)
  })

  test('post overflow menu opens above feed cards and is not clipped', async ({ page }) => {
    const menu = await openPass4PostOverflowMenu(page)
    await expectVisibleInViewport(menu)
    await expectFloatingAboveFeedCard(page, '[role="menu"]')
  })

  test('header Create menu opens above feed content', async ({ page }) => {
    await gotoSettled(page, '/home?mode=following')
    await page.getByRole('button', { name: 'Create menu' }).click()
    const createPanel = page.locator('.z-dc-dropdown').filter({ hasText: /Create|Post|Event/i }).first()
    await expect(createPanel).toBeVisible()
    await expectVisibleInViewport(createPanel)
  })

  test('account menu opens above feed when wide viewport', async ({ page }) => {
    await gotoSettled(page, '/home?mode=following')
    const accountBtn = page.getByRole('button', { name: /Account menu/i }).first()
    await expect(accountBtn).toBeVisible({ timeout: 15_000 })
    await accountBtn.click()
    const accountMenu = page.getByRole('dialog', { name: 'Account menu' })
    await expect(accountMenu).toBeVisible()
    await expectVisibleInViewport(accountMenu)
  })
})

test.describe('Pass 4 · feed menu layering mobile 390', () => {
  test.describe.configure({ timeout: 60_000 })

  test.beforeEach(async ({ page, request }) => {
    await setupAuthenticatedPage(page, request)
    await page.setViewportSize(VIEWPORTS.mobile)
  })

  test('mobile post overflow menu is visible in viewport', async ({ page }) => {
    const menu = await openPass4PostOverflowMenu(page)
    await expectVisibleInViewport(menu)
  })
})
