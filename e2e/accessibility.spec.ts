import { test } from '@playwright/test'
import { setupAuthenticatedPage, gotoSettled, demoProfilePath } from './helpers/page-setup'
import { expectNoSeriousAxeViolations } from './helpers/a11y'

const AUTHENTICATED_A11Y_ROUTES: Array<{ name: string; path: string | (() => string) }> = [
  { name: 'home', path: '/home' },
  { name: 'profile', path: demoProfilePath },
  { name: 'people', path: '/people' },
  { name: 'groups', path: '/groups' },
  { name: 'events', path: '/events' },
  { name: 'vendors', path: '/vendors' },
  { name: 'organizations', path: '/orgs' },
  { name: 'explore', path: '/explore' },
]

test.describe('Pass 4 · axe accessibility (serious/critical)', () => {
  test.beforeEach(async ({ page, request }) => {
    await setupAuthenticatedPage(page, request)
  })

  for (const route of AUTHENTICATED_A11Y_ROUTES) {
    test(`${route.name} has no serious/critical axe violations`, async ({ page }) => {
      const path = typeof route.path === 'function' ? route.path() : route.path
      await gotoSettled(page, path)
      await expectNoSeriousAxeViolations(page)
    })
  }
})
