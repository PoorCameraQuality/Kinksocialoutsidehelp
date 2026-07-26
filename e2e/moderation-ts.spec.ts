import { test, expect, type APIRequestContext } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { loginViaApi, logoutViaApi, isDbReady } from './helpers/auth'
import { SEED_USERS } from './helpers/seed-users'
import { attachConsoleGuard } from './helpers/assertions'

const SITE_ADMIN_PASSWORD =
  process.env.E2E_SITE_ADMIN_PASSWORD ?? process.env.BRAX_ADMIN_PASSWORD ?? 'Airship!2'
const REPORT_MARKER = `e2e-moderation-ts-${randomUUID().slice(0, 8)}`

type ProfileRow = { userId?: string; username?: string }

async function casesFeatureReady(request: APIRequestContext): Promise<boolean> {
  const res = await request.get('/api/v1/moderation/cases?limit=1')
  if (res.status() === 404 || res.status() === 501) return false
  return res.ok()
}

async function resolveUserId(request: APIRequestContext, username: string): Promise<string | null> {
  const res = await request.get(`/api/v1/profiles?q=${encodeURIComponent(username)}&limit=5`)
  if (!res.ok()) return null
  const body = (await res.json()) as { items?: ProfileRow[] }
  const row = (body.items ?? []).find((p) => p.username === username)
  return row?.userId ?? null
}

test.describe('T&S-1 moderation cases', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await isDbReady(request)), 'DB not ready. Run docker compose + npm run db:prepare')
  })

  test('reporter files profile report; site admin reviews case and adds note', async ({ page, request }) => {
    attachConsoleGuard(page)

    const reporterOk = await loginViaApi(request, SEED_USERS.member)
    test.skip(!reporterOk, 'RopeDreamer login unavailable')

    const targetId = await resolveUserId(request, SEED_USERS.attendee)
    test.skip(!targetId, `Could not resolve profile id for ${SEED_USERS.attendee}`)

    const reportRes = await request.post('/api/v1/moderation/reports', {
      headers: { 'Content-Type': 'application/json' },
      data: {
        targetType: 'profile',
        targetId,
        policyReason: 'OTHER',
        body: REPORT_MARKER,
      },
    })
    test.skip(!reportRes.ok(), `Report intake unavailable (${reportRes.status()})`)
    const reportBody = (await reportRes.json()) as {
      reportId?: string
      caseId?: string
      duplicate?: boolean
    }
    expect(reportBody.reportId).toBeTruthy()
    expect(reportBody.caseId).toBeTruthy()

    await logoutViaApi(request)

    const adminOk = await loginViaApi(page.request, SEED_USERS.siteAdmin, SITE_ADMIN_PASSWORD)
    test.skip(!adminOk, 'Brax site admin login unavailable')

    const casesReady = await casesFeatureReady(page.request)
    test.skip(!casesReady, 'T&S-1 cases API not available')

    await page.goto(`/moderation/cases/${encodeURIComponent(reportBody.caseId!)}`)
    await expect(page.getByRole('heading', { level: 2, name: /other/i })).toBeVisible({
      timeout: 20_000,
    })
    if (!reportBody.duplicate) {
      await expect(page.getByText(REPORT_MARKER).first()).toBeVisible({ timeout: 20_000 })
    }

    const noteField = page.getByPlaceholder(/internal note/i)
    await expect(noteField).toBeVisible({ timeout: 15_000 })
    const noteText = `e2e note ${REPORT_MARKER}`
    await noteField.fill(noteText)

    const saveNote = page.getByRole('button', { name: /save note|add note|update note/i })
    await saveNote.click()
    await expect(page.getByText(noteText)).toBeVisible({ timeout: 15_000 })
  })
})
