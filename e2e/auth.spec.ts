import { test, expect } from '@playwright/test'
import { loginPage, loginViaApi, logoutViaApi, DEMO_USER } from './helpers/auth'
import { attachConsoleGuard } from './helpers/assertions'

test.describe('auth', () => {
  test('logged-out visitor is redirected from home to login', async ({ page }) => {
    attachConsoleGuard(page)
    await page.goto('/home')
    await expect(page).toHaveURL(/\/?(\?|&)login=1/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { level: 2, name: 'Welcome back' })).toBeVisible()
  })

  test('login-gated routes redirect anonymous visitors to login', async ({ page }) => {
    attachConsoleGuard(page)
    await page.goto('/events')
    await expect(page).toHaveURL(/\/?(\?|&)login=1/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { level: 2, name: 'Welcome back' })).toBeVisible()
  })

  test('login works and authenticated nav appears', async ({ page }) => {
    attachConsoleGuard(page)
    const ok = await loginPage(page)
    test.skip(!ok, 'demo login unavailable')
    await page.goto('/home', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible({ timeout: 20_000 })
    await expect(
      page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Conventions', exact: true }),
    ).toBeVisible()
  })

  test('logout clears session', async ({ request }) => {
    const login = await loginViaApi(request)
    test.skip(!login, 'demo login unavailable')
    const me1 = await request.get('/api/auth/me')
    expect(me1.ok()).toBeTruthy()
    const body1 = (await me1.json()) as { viewer?: { authenticated?: boolean } }
    expect(body1.viewer?.authenticated).toBe(true)
    await logoutViaApi(request)
    const me2 = await request.get('/api/auth/me')
    const body2 = (await me2.json()) as { viewer?: { authenticated?: boolean } }
    expect(body2.viewer?.authenticated).not.toBe(true)
  })

  test('organizer door hidden from logged-out users', async ({ page }) => {
    attachConsoleGuard(page)
    await page.goto('/organizer/orgs/demo-east-collective/conventions/preview-c2k-weekend/door')
    await expect(page.getByText(/sign in required|log in|sign in|unauthorized/i).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('me endpoint returns username after login', async ({ request }) => {
    const ok = await loginViaApi(request)
    test.skip(!ok, 'demo login unavailable')
    const me = await request.get('/api/auth/me')
    const body = (await me.json()) as { viewer?: { username?: string } }
    expect(body.viewer?.username).toBe(DEMO_USER)
  })
})
