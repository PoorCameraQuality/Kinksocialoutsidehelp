import { test, expect } from '@playwright/test'

const convSlug = 'preview-c2k-weekend'
const registerPath = `/conventions/${convSlug}/register`

test.describe('convention registration', () => {
  test('public register UI path on preview convention when DB seeded', async ({ page }) => {
    const ready = await page.request.get('/api/health/ready')
    expect(ready.ok()).toBeTruthy()
    const health = (await ready.json()) as { database?: string }
    test.skip(health.database !== 'ok', 'Skipping: DB not available (run docker compose + npm run db:prepare)')

    const stamp = Date.now()
    const username = `e2ereg${stamp}`.slice(0, 20)
    const email = `e2ereg-${stamp}@mailpit.local`
    const password = process.env.E2E_REG_PASSWORD ?? 'RegPass!99'

    const register = await page.request.post('/api/auth/register', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        username,
        email,
        password,
        ageAffirmed: true,
        termsAccepted: true,
      }),
    })
    test.skip(!register.ok(), 'Skipping: user registration failed (DB off or rate limit)')

    const infoRes = await page.request.get(`/api/v1/public/conventions/${convSlug}/register-info`)
    test.skip(!infoRes.ok(), 'Skipping: register-info unavailable for preview convention')
    const info = (await infoRes.json()) as {
      convention?: { name?: string }
      categories?: Array<{ id: string; name: string; requiresAccessCode?: boolean; grantsStaffAccess?: boolean }>
    }
    const category = (info.categories ?? []).find((c) => !c.requiresAccessCode && !c.grantsStaffAccess)
    test.skip(!category?.name, 'Skipping: no public attendee category without access code')
    const conventionName = info.convention?.name ?? convSlug

    await page.goto(registerPath)
    await expect(page.getByRole('heading', { name: 'Register for this convention', level: 1 })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('heading', { name: 'Pick a category', level: 2 })).toBeVisible()

    await page.getByRole('radio', { name: new RegExp(category.name!, 'i') }).check()
    await page.getByRole('button', { name: 'Continue' }).click()

    const formStep = page.getByRole('heading', { name: 'Your details', level: 2 })
    const policiesStep = page.getByRole('heading', { name: 'Policies', level: 2 })
    await expect(formStep.or(policiesStep)).toBeVisible({ timeout: 15_000 })

    if (await formStep.isVisible()) {
      await page.getByLabel('Badge name').fill(`E2E ${username}`)
      const emergencyName = page.getByText('Emergency contact name').locator('..').getByRole('textbox')
      if (await emergencyName.count()) {
        await emergencyName.fill('E2E Contact')
      }
      const emergencyPhone = page.getByText('Emergency contact phone').locator('..').getByRole('textbox')
      if (await emergencyPhone.count()) {
        await emergencyPhone.fill('555-0100')
      }
      await page.getByRole('button', { name: /Continue|Submit registration/ }).click()
    }

    if (await policiesStep.isVisible()) {
      const required = page.getByRole('checkbox', { name: 'Required' })
      if (await required.count()) {
        for (let i = 0; i < (await required.count()); i++) {
          await required.nth(i).check()
        }
      }
      await page.getByRole('button', { name: 'Submit registration' }).click()
    } else if (!(await formStep.isVisible())) {
      await page.getByRole('button', { name: 'Submit registration' }).click()
    }

    await expect(page.getByRole('heading', { name: /registered for/i })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('link', { name: new RegExp(conventionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })).toBeVisible()
  })
})
