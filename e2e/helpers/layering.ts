import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'

/** Scroll a feed post into a stable band so portaled overflow menus fit in the viewport. */
export async function scrollFeedPostForMenuOpen(post: Locator): Promise<void> {
  await post.scrollIntoViewIfNeeded()
  await post.evaluate((el) => {
    const rect = el.getBoundingClientRect()
    const targetCenterY = window.innerHeight * 0.32
    const currentCenterY = rect.top + rect.height / 2
    window.scrollBy({ top: currentCenterY - targetCenterY })
  })
}

/** Popover/menu should be visible and not clipped by the viewport edges. */
export async function expectVisibleInViewport(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  expect(box, 'floating UI should have a bounding box').toBeTruthy()
  if (!box) return

  const viewport = locator.page().viewportSize()
  expect(viewport, 'viewport size required').toBeTruthy()
  if (!viewport) return

  expect(box.y, 'popover clipped above viewport').toBeGreaterThanOrEqual(-8)
  expect(box.y + box.height, 'popover clipped below viewport').toBeLessThanOrEqual(viewport.height + 8)
  expect(box.x, 'popover clipped left of viewport').toBeGreaterThanOrEqual(-8)
  expect(box.x + box.width, 'popover clipped right of viewport').toBeLessThanOrEqual(viewport.width + 8)
}

/** Fixed/portaled overlays should sit above feed card surfaces (z-index stack). */
export async function expectFloatingAboveFeedCard(page: import('@playwright/test').Page, floatingSelector: string): Promise<void> {
  const card = page.locator('article.feed-stream-post').first()
  await expect(card).toBeVisible()

  const [floatZ, cardZ] = await page.evaluate(
    ({ sel }) => {
      const floating = document.querySelector(sel)
      const feedCard = document.querySelector('article.feed-stream-post')
      const zOf = (el: Element | null) => {
        if (!el) return 0
        const z = window.getComputedStyle(el).zIndex
        return z === 'auto' ? 0 : Number.parseInt(z, 10) || 0
      }
      return [zOf(floating), zOf(feedCard)]
    },
    { sel: floatingSelector },
  )

  expect(floatZ, 'floating UI z-index should be >= feed card').toBeGreaterThanOrEqual(cardZ)
}
