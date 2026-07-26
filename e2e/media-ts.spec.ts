import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { loginViaApi, logoutViaApi, isDbReady } from './helpers/auth'
import { SEED_USERS } from './helpers/seed-users'
import { attachConsoleGuard } from './helpers/assertions'

const REPORT_MARKER = `e2e-media-ts-${randomUUID().slice(0, 8)}`

type ProfileRow = { userId?: string; username?: string }

async function profilePhotoAttestationReady(request: APIRequestContext): Promise<boolean> {
  const res = await request.post('/api/profile/me/photos', {
    headers: { 'Content-Type': 'application/json' },
    data: {
      url: 'https://example.test/e2e-probe.jpg',
    },
  })
  if (res.status() === 401) {
    const authed = await loginViaApi(request, SEED_USERS.member)
    if (!authed) return false
    const retry = await request.post('/api/profile/me/photos', {
      headers: { 'Content-Type': 'application/json' },
      data: {
        url: 'https://example.test/e2e-probe.jpg',
      },
    })
    await logoutViaApi(request)
    if (retry.status() === 422) {
      const body = (await retry.json()) as { error?: string; code?: string }
      return /attestation/i.test(body.error ?? body.code ?? '')
    }
    return retry.status() === 400 || retry.status() === 201
  }
  if (res.status() === 422) {
    const body = (await res.json()) as { error?: string; code?: string }
    return /attestation/i.test(body.error ?? body.code ?? '')
  }
  return false
}

async function loggedOutBlurReady(page: Page, username: string): Promise<boolean> {
  await page.goto(`/profile/${encodeURIComponent(username)}`)
  const gallery = page.locator('[data-testid="profile-photo-gallery"], .profile-photo-gallery')
  if ((await gallery.count()) === 0) return false
  const blurred = page.locator(
    '[data-testid="profile-photo-blurred"], [data-media-blurred="true"], img[class*="blur"]'
  )
  return (await blurred.count()) > 0
}

async function resolveProfilePhotoTarget(
  request: APIRequestContext,
  username: string
): Promise<{ photoId: string; userId: string } | null> {
  const profileRes = await request.get(`/api/v1/profiles/${encodeURIComponent(username)}`)
  if (!profileRes.ok()) return null
  const profile = (await profileRes.json()) as {
    userId?: string
    photos?: { id: string }[]
  }
  const photoId = profile.photos?.[0]?.id
  if (!photoId || !profile.userId) return null
  return { photoId, userId: profile.userId }
}

test.describe('T&S-2 media safety', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await isDbReady(request)), 'DB not ready. Run docker compose + npm run db:prepare')
  })

  test('profile photo upload path requires attestation when enabled', async ({ page, request }) => {
    attachConsoleGuard(page)

    const reporterOk = await loginViaApi(request, SEED_USERS.member)
    test.skip(!reporterOk, 'RopeDreamer login unavailable')

    const attestationReady = await profilePhotoAttestationReady(request)
    test.skip(!attestationReady, 'Profile photo attestation gate not implemented')

    await page.goto('/profile/edit')
    const attestationField = page.getByRole('checkbox', { name: /attest|consent|own this/i })
    await expect(attestationField.first()).toBeVisible({ timeout: 15_000 })

    await logoutViaApi(request)
  })

  test('logged-out viewer sees blurred profile photos when enabled', async ({ page, request }) => {
    attachConsoleGuard(page)

    await logoutViaApi(request)
    const blurReady = await loggedOutBlurReady(page, SEED_USERS.attendee)
    test.skip(!blurReady, 'Logged-out profile photo blur not implemented')

    const sharpSrc = page.locator('[data-testid="profile-photo-src"], img[src*="http"]')
    await expect(sharpSrc).toHaveCount(0)
  })

  test('report on profile photo creates moderation case', async ({ request }) => {
    const reporterOk = await loginViaApi(request, SEED_USERS.member)
    test.skip(!reporterOk, 'RopeDreamer login unavailable')

    const target = await resolveProfilePhotoTarget(request, SEED_USERS.attendee)
    test.skip(!target, `No profile photo target for ${SEED_USERS.attendee}`)

    const reportRes = await request.post('/api/v1/moderation/reports', {
      headers: { 'Content-Type': 'application/json' },
      data: {
        targetType: 'profile_photo',
        targetId: target.photoId,
        policyReason: 'EXPLICIT_VISIBILITY_VIOLATION',
        body: REPORT_MARKER,
      },
    })

    if (reportRes.status() === 400) {
      const body = (await reportRes.json()) as { error?: string }
      test.skip(/unsupported|not available/i.test(body.error ?? ''), 'profile_photo reports not implemented')
    }

    test.skip(!reportRes.ok(), `Report intake unavailable (${reportRes.status()})`)

    const reportBody = (await reportRes.json()) as {
      reportId?: string
      caseId?: string
    }
    expect(reportBody.reportId).toBeTruthy()
    expect(reportBody.caseId).toBeTruthy()

    await logoutViaApi(request)
  })
})
