import { test, expect } from '@playwright/test'
import { loginPage, logoutViaApi, isDbReady } from './helpers/auth'

const BRAX_PW = process.env.E2E_SITE_ADMIN_PASSWORD ?? process.env.BRAX_ADMIN_PASSWORD ?? 'Airship!2'
const DEMO_PW = process.env.E2E_DEMO_PASSWORD ?? 'demo'

test.describe('LEGAL-ALPHA-1 manual smoke (UI)', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await isDbReady(request)), 'DB not ready')
  })

  test('public policy routes render expected copy', async ({ page }) => {
    await page.goto('/policies')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })

    await page.goto('/policies/dmca')
    await expect(page.getByText(/DMCA|Copyright/i).first()).toBeVisible()

    await page.goto('/dmca')
    await expect(page.getByText(/10.*14.*business days/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: /Repeat infringer policy/i })).toBeVisible()

    await page.goto('/policies/appeals')
    await expect(page.getByText(/appeal/i).first()).toBeVisible()

    await page.goto('/policies/adult-content-records')
    await expect(page.getByText(/user-generated content|User-Generated Content/i).first()).toBeVisible()

    await page.goto('/ncii')
    await expect(page.getByText(/NCII|non-consensual/i).first()).toBeVisible()
    await expect(page.getByText(/does not integrate with third-party NCII/i)).toBeVisible()

    await page.goto('/law-enforcement')
    await expect(page.getByText(/valid legal process|Valid legal process/i).first()).toBeVisible()
    // TOC link may be CSS-hidden on narrow viewports; assert body copy instead.
    await expect(page.getByRole('heading', { name: /Preservation|legal hold/i }).first()).toBeVisible()
  })

  test('signup and footer policy links', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('link', { name: /terms/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /privacy/i }).first()).toBeVisible()

    await page.goto('/')
    const footer = page.locator('footer')
    await expect(footer.getByRole('link', { name: /privacy|terms|guidelines|dmca/i }).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('non-admin blocked from legal/DMCA admin pages', async ({ page, request }) => {
    const ok = await loginPage(page, 'RopeDreamer', DEMO_PW)
    test.skip(!ok, 'RopeDreamer login unavailable')

    await page.goto('/moderation/legal')
    await expect(page.getByText(/Legal admin or site admin access required/i)).toBeVisible({
      timeout: 15_000,
    })

    await page.goto('/moderation/dmca')
    await expect(page.getByText(/Trust.*Safety or site admin access required/i)).toBeVisible()

    await logoutViaApi(request)
  })

  test('Brax admin pages load; privacy settings copy honest', async ({ page, request }) => {
    const ok = await loginPage(page, 'Brax', BRAX_PW)
    test.skip(!ok, 'Brax login unavailable')

    await page.goto('/moderation/legal')
    await expect(page.getByText(/Legal admin or site admin access required/i)).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Legal requests' })).toBeVisible({ timeout: 15_000 })

    await page.goto('/moderation/dmca')
    await expect(page.getByText(/Trust.*Safety or site admin access required/i)).toHaveCount(0)

    await page.goto('/settings/privacy')
    await expect(page.getByText(/Deletion may be delayed or blocked/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Download JSON export/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Request account deletion/i })).toBeVisible()

    await logoutViaApi(request)
  })
})
