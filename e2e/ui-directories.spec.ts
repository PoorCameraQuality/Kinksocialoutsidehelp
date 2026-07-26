import { test, expect } from '@playwright/test'
import { setupAuthenticatedPage, gotoSettled } from './helpers/page-setup'
import { expectNoHorizontalOverflow } from './helpers/assertions'
import { VIEWPORTS } from './helpers/viewports'

type DirectoryCase = {
  name: string
  path: string
  heading: RegExp | string
  cardSelector: string
  actionPattern?: RegExp
}

const DIRECTORIES: DirectoryCase[] = [
  {
    name: 'people',
    path: '/people',
    heading: /people|members|discover/i,
    cardSelector: 'a[href*="/profile/"], [class*="Person"], [class*="people"]',
    actionPattern: /connect|message|view profile/i,
  },
  {
    name: 'vendors',
    path: '/vendors',
    heading: 'Vendors',
    cardSelector: 'a[href*="/vendors/"]',
  },
  {
    name: 'groups',
    path: '/groups',
    heading: 'Groups',
    cardSelector: 'a[href*="/groups/"]',
    actionPattern: /view group/i,
  },
  {
    name: 'events',
    path: '/events',
    heading: 'Events',
    cardSelector: 'a[aria-label^="View event:"], a[href*="/events/"]',
  },
  {
    name: 'organizations',
    path: '/orgs',
    heading: 'Organizations',
    cardSelector: 'a[href*="/orgs/"]',
  },
  {
    name: 'explore',
    path: '/explore',
    heading: /Explore the community/i,
    cardSelector: 'section[class*="xpl-section"], .explore-hub a[href="/groups"]',
  },
]

test.describe('Pass 4 · directory pages desktop', () => {
  test.beforeEach(async ({ page, request }) => {
    await setupAuthenticatedPage(page, request)
  })

  for (const dir of DIRECTORIES) {
    test(`${dir.name} page loads with cards`, async ({ page }) => {
      await gotoSettled(page, dir.path)
      if (typeof dir.heading === 'string') {
        await expect(page.getByRole('heading', { name: dir.heading }).first()).toBeVisible({ timeout: 20_000 })
      } else {
        await expect(page.getByRole('heading').filter({ hasText: dir.heading }).first()).toBeVisible({
          timeout: 20_000,
        })
      }

      if (dir.name === 'groups') {
        let cards = page.locator(dir.cardSelector)
        if ((await cards.count()) === 0) {
          const slug = `pass4-group-${Date.now().toString(36)}`
          const created = await page.request.post('/api/v1/groups', {
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({
              name: `pass4-group-${Date.now().toString(36)}`,
              slug,
              category: 'Education',
              tags: ['pass4', 'test'],
              visibility: 'public',
            }),
          })
          test.skip(!created.ok(), 'No group cards in seed and POST /api/v1/groups failed — run npm run db:prepare')
          await gotoSettled(page, dir.path)
          cards = page.locator(dir.cardSelector)
        }
        await expect(cards.first()).toBeVisible({ timeout: 20_000 })
        return
      }

      await expect(page.locator(dir.cardSelector).first()).toBeVisible({ timeout: 20_000 })
    })
  }

  test('vendors directory cards do not emphasize prices in grid', async ({ page }) => {
    await gotoSettled(page, '/vendors')
    const cards = page.locator('a[href*="/vendors/"]')
    const count = await cards.count()
    test.skip(count === 0, 'No vendor cards in seed/demo data')
    const firstCard = cards.first()
    const text = (await firstCard.innerText()).toLowerCase()
    expect(text).not.toMatch(/\$\d+|\d+\.\d{2}\s*usd/)
  })

  test('explore shows global search and filter affordances', async ({ page }) => {
    await gotoSettled(page, '/explore')
    await expect(page.getByRole('searchbox', { name: /Search the community/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /filter/i }).first()).toBeVisible()
  })

  test('orgs directory is not dominated by repeated admin dashboard CTAs', async ({ page }) => {
    await gotoSettled(page, '/orgs')
    const dashboardLinks = page.getByRole('link', { name: /dashboard|organizer console/i })
    expect(await dashboardLinks.count()).toBeLessThanOrEqual(2)
  })
})

test.describe('Pass 4 · directory pages mobile 390', () => {
  test.beforeEach(async ({ page, request }) => {
    await setupAuthenticatedPage(page, request)
    await page.setViewportSize(VIEWPORTS.mobile)
  })

  for (const dir of DIRECTORIES.filter((d) => d.name !== 'explore')) {
    test(`${dir.name} mobile layout has no horizontal overflow`, async ({ page }) => {
      await gotoSettled(page, dir.path)
      await expectNoHorizontalOverflow(page)
    })
  }

  test('explore mobile layout has no horizontal overflow', async ({ page }) => {
    await gotoSettled(page, '/explore')
    await expectNoHorizontalOverflow(page)
  })
})
