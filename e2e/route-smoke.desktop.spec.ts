import { test, expect } from '@playwright/test'
import { loginPage, isDbReady } from './helpers/auth'
import { attachConsoleGuard, expectNoHorizontalOverflow, waitForPageSettled } from './helpers/assertions'
import { SEED } from './helpers/fixtures'
import {
  publicRoutesWithSeed,
  authenticatedRoutesWithSeed,
  organizerRoutes,
  type RouteSpec,
} from './helpers/routes'
import { VIEWPORTS } from './helpers/viewports'

async function smokeRoute(page: import('@playwright/test').Page, spec: RouteSpec, dbOk: boolean) {
  if (spec.skipIfNoDb && !dbOk) {
    test.skip(true, `Skipping ${spec.name}: database not ready`)
  }
  const responses: import('@playwright/test').Response[] = []
  page.on('response', (r) => responses.push(r))
  attachConsoleGuard(page)
  await page.setViewportSize(VIEWPORTS.desktop)
  await page.goto(spec.path)
  await waitForPageSettled(page)
  await expect(page.locator('body')).not.toContainText(/Unhandled Runtime Error|stack trace at/i)
  if (spec.expectHeading) {
    if (typeof spec.expectHeading === 'string') {
      await expect(page.getByRole('heading', { name: spec.expectHeading }).first()).toBeVisible({
        timeout: 20_000,
      })
    } else {
      await expect(page.getByRole('heading', { level: 1 }).first()).toContainText(spec.expectHeading, {
        timeout: 20_000,
      })
    }
  }
  for (const res of responses) {
    const url = res.url()
    if (url.includes('/api/') && res.status() >= 500) {
      throw new Error(`${spec.path}: API ${res.status()} ${url}`)
    }
  }
}

test.describe('route smoke. Desktop', () => {
  let dbOk = false

  test.beforeAll(async ({ request }) => {
    dbOk = await isDbReady(request)
  })

  for (const spec of publicRoutesWithSeed(SEED.orgSlug, SEED.convSlug)) {
    test(`public ${spec.name}`, async ({ page }) => {
      await smokeRoute(page, spec, dbOk)
    })
  }

  test.describe('authenticated', () => {
    test.beforeEach(async ({ page }) => {
      const ok = await loginPage(page)
      test.skip(!ok, 'demo login unavailable')
    })

    for (const spec of authenticatedRoutesWithSeed(SEED.orgSlug, SEED.convSlug)) {
      test(spec.name, async ({ page }) => {
        await smokeRoute(page, spec, dbOk)
      })
    }

    for (const spec of organizerRoutes(SEED.orgSlug, SEED.convSlug)) {
      test(spec.name, async ({ page }) => {
        await smokeRoute(page, spec, dbOk)
      })
    }
  })
})
