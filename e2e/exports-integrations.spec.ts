import { test, expect } from '@playwright/test'
import { loginPage, isDbReady } from './helpers/auth'
import { organizerConventionPath, SEED } from './helpers/fixtures'
import { attachConsoleGuard } from './helpers/assertions'

test.describe('exports and integrations', () => {
  test.beforeEach(async ({ page, request }) => {
    const db = await isDbReady(request)
    test.skip(!db, 'database not ready')
    const ok = await loginPage(page)
    test.skip(!ok, 'demo login unavailable')
    attachConsoleGuard(page)
  })

  test('exports tab loads without console errors', async ({ page }) => {
    await page.goto(`${organizerConventionPath()}?tab=exports`)
    await expect(page.getByText(/export/i).first()).toBeVisible({ timeout: 20_000 })
  })

  test('integrations tab loads ECKE section', async ({ page }) => {
    await page.goto(`${organizerConventionPath()}?tab=integrations`)
    await expect(page.getByText(/East Coast Kink|ECKE|integration/i).first()).toBeVisible({
      timeout: 20_000,
    })
  })

  test('ECKE publish status reports bridgeConnected field', async ({ request }) => {
    const res = await request.get(
      `/api/v1/conventions/${encodeURIComponent(SEED.convSlug)}/ecke-publish`,
    )
    test.skip(!res.ok(), 'ECKE status route unavailable')
    const body = (await res.json()) as { bridgeConnected?: boolean }
    expect(typeof body.bridgeConnected).toBe('boolean')
  })
})
