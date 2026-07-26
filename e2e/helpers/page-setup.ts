import type { APIRequestContext, Page } from '@playwright/test'
import { test } from '@playwright/test'
import { loginPage, isDbReady } from './auth'
import { attachConsoleGuard, waitForPageSettled } from './assertions'
import { SEED } from './fixtures'

export async function skipUnlessDbReady(request: APIRequestContext): Promise<void> {
  for (let attempt = 0; attempt < 15; attempt++) {
    if (await isDbReady(request)) return
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  test.skip(true, 'DB not ready — run docker compose + npm run db:prepare')
}

export async function loginDemoOrSkip(page: Page): Promise<void> {
  const ok = await loginPage(page)
  test.skip(!ok, 'demo login unavailable (seed DB + RopeDreamer / E2E_DEMO_PASSWORD)')
}

export async function setupAuthenticatedPage(page: Page, request: APIRequestContext): Promise<void> {
  await skipUnlessDbReady(request)
  attachConsoleGuard(page)
  await loginDemoOrSkip(page)
}

export async function gotoSettled(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await waitForPageSettled(page)
}

export function demoProfilePath(): string {
  return `/profile/${SEED.demoUser}`
}

/** Create a status post for feed interaction tests; returns post id or null. */
export async function createStatusPostForE2E(page: Page, prefix = 'pass4-feed-check'): Promise<string | null> {
  const res = await page.request.post('/api/v1/feed/posts', {
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({
      kind: 'status',
      body: `${prefix} ${Date.now()}`,
      bodyFormat: 'text',
    }),
  })
  if (!res.ok()) return null
  const json = (await res.json()) as { post?: { id?: string } }
  return json.post?.id ?? null
}

/** Open Following feed and wait for at least one stream post card. */
export async function gotoFollowingFeed(page: Page): Promise<void> {
  await gotoSettled(page, '/home?mode=following')
}

export async function waitForFeedStreamPost(page: Page, timeoutMs = 25_000): Promise<boolean> {
  try {
    await page.locator('article.feed-stream-post').first().waitFor({ state: 'visible', timeout: timeoutMs })
    return true
  } catch {
    return false
  }
}

/** Create a post and land on Following feed with the card visible. Returns post body marker or false. */
export async function ensureFollowingFeedPost(page: Page, prefix = 'pass4-feed-check'): Promise<string | false> {
  const body = `${prefix} ${Date.now()}`

  await page.request.patch('/api/settings/me', {
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ feed: { followingFilter: 'all', homeMode: 'following' } }),
  })

  const res = await page.request.post('/api/v1/feed/posts', {
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ kind: 'status', body, bodyFormat: 'text' }),
  })
  if (!res.ok()) return false
  const json = (await res.json()) as { post?: { id?: string } }
  const postId = json.post?.id
  if (!postId) return false

  let found = false
  for (let i = 0; i < 20; i++) {
    const feedRes = await page.request.get('/api/v1/feed/following?limit=20&filter=all')
    if (feedRes.ok()) {
      const feedJson = (await feedRes.json()) as {
        items?: Array<{ kind?: string; post?: { id?: string; body?: string } }>
      }
      found = (feedJson.items ?? []).some(
        (it) => it.kind === 'post' && (it.post?.id === postId || it.post?.body === body),
      )
      if (found) break
    }
    await page.waitForTimeout(400)
  }
  if (!found) return false

  await gotoFollowingFeed(page)
  await page
    .getByRole('tablist', { name: 'Home feed scope' })
    .waitFor({ state: 'visible', timeout: 15_000 })
    .catch(() => {})

  try {
    await page.getByText(body, { exact: false }).first().waitFor({ state: 'visible', timeout: 30_000 })
    return body
  } catch {
    const visible = await waitForFeedStreamPost(page, 5_000)
    return visible ? body : false
  }
}
