import { test, expect } from '@playwright/test'
import { isDbReady, loginViaApi, logoutViaApi, DEMO_PASSWORD, DEMO_USER } from './helpers/auth'
import { randomUUID } from 'node:crypto'

test.describe('Pass 4 · event privacy API contracts', () => {
  test('anonymous GET private event by UUID returns 404', async ({ request }) => {
    test.skip(!(await isDbReady(request)), 'DB not ready')

    const login = await loginViaApi(request, DEMO_USER, DEMO_PASSWORD)
    test.skip(!login, 'demo login unavailable')

    const listRes = await request.get('/api/v1/events?hostId=me')
    test.skip(!listRes.ok(), 'host events list unavailable')
    const list = (await listRes.json()) as { items?: Array<{ id: string; visibility?: string }> }
    const privateEvent = (list.items ?? []).find((e) => e.visibility === 'private')
    test.skip(!privateEvent, 'no private host event in seed — smoke only')

    await logoutViaApi(request)
    const detail = await request.get(`/api/v1/events/${privateEvent!.id}`)
    expect(detail.status()).toBe(404)

    const strangerLogin = await loginViaApi(request, 'ShutterSeed', DEMO_PASSWORD)
    if (strangerLogin) {
      const asStranger = await request.get(`/api/v1/events/${privateEvent!.id}`)
      expect(asStranger.status()).toBe(404)
    }
  })

  test('global events list excludes private events when DB seeded', async ({ request }) => {
    test.skip(!(await isDbReady(request)), 'DB not ready')
    const login = await loginViaApi(request, DEMO_USER, DEMO_PASSWORD)
    test.skip(!login, 'demo login unavailable')

    const globalRes = await request.get('/api/v1/events')
    expect(globalRes.ok()).toBeTruthy()
    const global = (await globalRes.json()) as { items?: Array<{ id: string; visibility?: string }> }
    const privateInGlobal = (global.items ?? []).some((e) => e.visibility === 'private')
    expect(privateInGlobal).toBe(false)

    const hostRes = await request.get('/api/v1/events?hostId=me')
    test.skip(!hostRes.ok(), 'host events unavailable')
    const host = (await hostRes.json()) as { items?: Array<{ id: string; visibility?: string }> }
    const privateOnHost = (host.items ?? []).find((e) => e.visibility === 'private')
    if (privateOnHost) {
      expect((global.items ?? []).some((e) => e.id === privateOnHost.id)).toBe(false)
    }
  })

  test('unknown event UUID returns 404 for anonymous viewer', async ({ request }) => {
    test.skip(!(await isDbReady(request)), 'DB not ready')
    const res = await request.get(`/api/v1/events/${randomUUID()}`)
    expect(res.status()).toBe(404)
  })
})
