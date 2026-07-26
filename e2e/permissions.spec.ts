import { test, expect } from '@playwright/test'
import { loginViaApi, isDbReady } from './helpers/auth'
import { SEED } from './helpers/fixtures'

test.describe('permissions · API contracts', () => {
  test.beforeEach(async ({ request }) => {
    const db = await isDbReady(request)
    test.skip(!db, 'database not ready')
  })

  test('convention participation requires auth', async ({ request }) => {
    const res = await request.get(`/api/v1/conventions/${SEED.convSlug}/me/participation`)
    expect(res.status()).toBe(401)
  })

  test('organizer bootstrap requires auth', async ({ request }) => {
    const res = await request.get(`/api/v1/conventions/${SEED.convSlug}/organizer/bootstrap`)
    expect(res.status()).toBe(401)
  })

  test('demo user can load organizer bootstrap when seeded', async ({ request }) => {
    const login = await loginViaApi(request)
    test.skip(!login, 'demo login unavailable')
    const res = await request.get(`/api/v1/conventions/${SEED.convSlug}/organizer/bootstrap`)
    expect(res.ok()).toBeTruthy()
  })

  test('calendar feed token 404 for invalid token', async ({ request }) => {
    const res = await request.get(`/api/v1/conventions/${SEED.convSlug}/calendar-feed/invalid-token-xyz.ics`)
    expect([404, 410]).toContain(res.status())
  })

  test('org forum post requires auth', async ({ request }) => {
    const orgRes = await request.get(`/api/v1/organizations/${SEED.orgSlug}`)
    test.skip(!orgRes.ok(), 'org not found')
    const res = await request.post(`/api/v1/organizations/${SEED.orgSlug}/forum/threads`, {
      data: { title: 'e2e', body: 'test' },
    })
    expect(res.status()).toBe(401)
  })
})
