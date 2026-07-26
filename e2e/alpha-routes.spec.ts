import { test, expect } from '@playwright/test'
import { loginPage, isDbReady } from './helpers/auth'
import { attachConsoleGuard, waitForPageSettled } from './helpers/assertions'
import { SEED } from './helpers/fixtures'
import { doorPath, organizerConventionPath } from './helpers/fixtures'
import { VIEWPORTS } from './helpers/viewports'

type AlphaRoute = {
  path: string
  name: string
  auth?: boolean
  heading?: string | RegExp
  skipIfNoDb?: boolean
}

const ALPHA_ROUTES: AlphaRoute[] = [
  { path: '/', name: 'landing', heading: 'Join free' },
  { path: '/home', name: 'home', auth: true },
  { path: '/events', name: 'events', auth: true, heading: 'Events' },
  { path: '/conventions', name: 'conventions', auth: true },
  { path: '/groups', name: 'groups', auth: true, heading: 'Groups' },
  { path: '/orgs', name: 'orgs', auth: true, heading: 'Organizations' },
  { path: '/people', name: 'people', auth: true },
  { path: '/profile/edit', name: 'profile-edit', auth: true },
  { path: '/settings/account', name: 'settings-account', auth: true, heading: 'Settings' },
  { path: '/settings/privacy', name: 'settings-privacy', auth: true, heading: 'Settings' },
  { path: '/messaging', name: 'messaging', auth: true, heading: 'Messages' },
  { path: '/organizer', name: 'organizer-hub', auth: true, skipIfNoDb: true },
  {
    path: `${organizerConventionPath()}?tab=dashboard`,
    name: 'conv-dashboard',
    auth: true,
    skipIfNoDb: true,
  },
  { path: doorPath(), name: 'door', auth: true, skipIfNoDb: true },
]

test.describe('alpha routes', () => {
  let dbOk = false

  test.beforeAll(async ({ request }) => {
    dbOk = await isDbReady(request)
  })

  for (const route of ALPHA_ROUTES) {
    test(`desktop ${route.name} loads`, async ({ page }) => {
      if (route.skipIfNoDb && !dbOk) test.skip(true, 'DB not ready')
      if (route.auth) {
        const ok = await loginPage(page)
        test.skip(!ok, 'demo login unavailable')
      }
      const responses: import('@playwright/test').Response[] = []
      page.on('response', (r) => responses.push(r))
      attachConsoleGuard(page)
      await page.setViewportSize(VIEWPORTS.desktop)
      await page.goto(route.path)
      await waitForPageSettled(page)
      await expect(page.locator('body')).not.toContainText(/Unhandled Runtime Error/i)
      if (route.heading) {
        if (typeof route.heading === 'string') {
          await expect(page.getByRole('heading', { name: route.heading }).first()).toBeVisible({
            timeout: 20_000,
          })
        } else {
          await expect(page.getByRole('heading', { level: 1 }).first()).toContainText(route.heading, {
            timeout: 20_000,
          })
        }
      }
      for (const res of responses) {
        if (res.url().includes('/api/') && res.status() >= 500) {
          throw new Error(`${route.path}: API ${res.status()} ${res.url()}`)
        }
      }
    })
  }
})
