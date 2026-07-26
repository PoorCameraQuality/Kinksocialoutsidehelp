import { test, expect } from '@playwright/test'
import { loginPage, isDbReady } from './helpers/auth'
import { attachConsoleGuard, expectNoHorizontalOverflow, waitForPageSettled } from './helpers/assertions'
import { SEED, doorPath, organizerConventionPath } from './helpers/fixtures'
import { publicRoutesWithSeed, authenticatedRoutesWithSeed, type RouteSpec } from './helpers/routes'
import { VIEWPORTS } from './helpers/viewports'

const MOBILE_CRITICAL: RouteSpec[] = [
  { path: '/', name: 'landing-mobile' },
  { path: '/events', name: 'events-mobile', auth: 'session', expectHeading: 'Events' },
  { path: '/home', name: 'home-mobile', auth: 'session' },
  { path: '/orgs/new', name: 'org-create-mobile', auth: 'session', skipIfNoDb: true },
  { path: doorPath(), name: 'door-mobile', auth: 'session', skipIfNoDb: true },
  { path: `${organizerConventionPath()}?tab=program`, name: 'program-mobile', auth: 'session', skipIfNoDb: true },
  { path: `${organizerConventionPath()}?tab=people&peopleTab=signups`, name: 'signups-mobile', auth: 'session', skipIfNoDb: true },
]

async function mobileSmoke(page: import('@playwright/test').Page, spec: RouteSpec, dbOk: boolean) {
  if (spec.skipIfNoDb && !dbOk) test.skip(true, `Skipping ${spec.name}: DB not ready`)
  attachConsoleGuard(page)
  await page.setViewportSize(VIEWPORTS.mobile)
  await page.goto(spec.path)
  await waitForPageSettled(page)
  await expectNoHorizontalOverflow(page)
  await expect(page.locator('body')).not.toContainText(/Unhandled Runtime Error/i)
}

test.describe('route smoke. Mobile', () => {
  let dbOk = false

  test.beforeAll(async ({ request }) => {
    dbOk = await isDbReady(request)
  })

  for (const spec of publicRoutesWithSeed(SEED.orgSlug, SEED.convSlug).filter((r) => !r.auth)) {
    test(`public ${spec.name}`, async ({ page }) => {
      await mobileSmoke(page, spec, dbOk)
    })
  }

  test.describe('authenticated mobile', () => {
    test.beforeEach(async ({ page }) => {
      const ok = await loginPage(page)
      test.skip(!ok, 'demo login unavailable')
    })

    for (const spec of [...authenticatedRoutesWithSeed(SEED.orgSlug, SEED.convSlug).slice(0, 2), ...MOBILE_CRITICAL.filter((s) => s.auth)]) {
      test(spec.name, async ({ page }) => {
        await mobileSmoke(page, spec, dbOk)
      })
    }
  })
})
