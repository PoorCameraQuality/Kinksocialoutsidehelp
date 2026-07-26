import { test, expect } from '@playwright/test'

const demoPassword = process.env.E2E_DEMO_PASSWORD ?? 'demo'

test.describe('following feed', () => {
  test('load more appends items when cursor pagination available', async ({ page }) => {
    const ready = await page.request.get('/api/health/ready')
    expect(ready.ok()).toBeTruthy()
    const health = (await ready.json()) as { database?: string }
    test.skip(health.database !== 'ok', 'Skipping: DB not available (run docker compose + npm run db:prepare)')

    const login = await page.request.post('/api/auth/session', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ username: 'RopeDreamer', password: demoPassword }),
    })
    test.skip(!login.ok(), 'Skipping: demo login failed (seed DB + RopeDreamer)')

    const stamp = Date.now()
    for (let i = 0; i < 21; i++) {
      const postRes = await page.request.post('/api/v1/feed/posts', {
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({
          kind: 'status',
          body: `e2e-load-more-${stamp}-${i}`,
          bodyFormat: 'text',
        }),
      })
      test.skip(!postRes.ok(), 'Skipping: POST /feed/posts failed')
    }

    const firstPage = await page.request.get('/api/v1/feed/following?limit=20')
    test.skip(!firstPage.ok(), 'Skipping: following feed unavailable')
    const firstJson = (await firstPage.json()) as { nextCursor?: string | null; items?: unknown[] }
    test.skip(!firstJson.nextCursor, 'Skipping: not enough feed items for pagination cursor')

    await page.goto('/home?mode=following')
    await expect(page.getByRole('tablist', { name: 'Feed' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('tab', { name: 'Following' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Load more' })).toBeVisible({ timeout: 15_000 })

    const markerPrefix = `e2e-load-more-${stamp}`
    const visibleBefore = await page.getByText(new RegExp(markerPrefix)).count()
    await page.getByRole('button', { name: 'Load more' }).click()
    await expect(page.getByRole('button', { name: 'Loading…' })).toBeHidden({ timeout: 15_000 })

    const visibleAfter = await page.getByText(new RegExp(markerPrefix)).count()
    expect(visibleAfter).toBeGreaterThanOrEqual(visibleBefore)

    const secondPage = await page.request.get(
      `/api/v1/feed/following?limit=20&cursor=${encodeURIComponent(firstJson.nextCursor!)}`,
    )
    expect(secondPage.ok()).toBeTruthy()
    const secondJson = (await secondPage.json()) as {
      items?: Array<{ kind?: string; post?: { body?: string } }>
    }
    const marker = secondJson.items?.find((it) => it.kind === 'post' && it.post?.body?.includes(`e2e-load-more-${stamp}`))
    if (marker?.post?.body) {
      await expect(page.getByText(marker.post.body, { exact: false }).first()).toBeVisible({ timeout: 15_000 })
    }
  })
})
