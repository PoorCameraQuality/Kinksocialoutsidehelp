import type { APIRequestContext, Page } from '@playwright/test'
import { usernameForRole, type SeedUserRole } from './seed-users'

export const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD ?? 'demo'
export const DEMO_USER = process.env.E2E_DEMO_USER ?? 'RopeDreamer'

export async function loginAs(
  request: APIRequestContext,
  role: SeedUserRole,
  password = DEMO_PASSWORD,
): Promise<boolean> {
  const username = usernameForRole(role)
  if (!username) return false
  return loginViaApi(request, username, password)
}

export async function loginPageAs(page: Page, role: SeedUserRole, password = DEMO_PASSWORD): Promise<boolean> {
  return loginAs(page.request, role, password)
}

export async function loginViaApi(
  request: APIRequestContext,
  username = DEMO_USER,
  password = DEMO_PASSWORD,
): Promise<boolean> {
  const res = await request.post('/api/auth/session', {
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ username, password }),
  })
  return res.ok()
}

/** Toggle onboarding completion for audit screenshots / E2E personas. */
export async function setOnboardingCompleteViaApi(
  request: APIRequestContext,
  complete: boolean,
): Promise<boolean> {
  const getRes = await request.get('/api/settings/me')
  if (!getRes.ok()) return false
  const data = (await getRes.json()) as { feed?: Record<string, unknown> }
  const feed = {
    ...(data.feed ?? {}),
    onboardingCompletedAt: complete ? new Date().toISOString() : null,
  }
  const patch = await request.patch('/api/settings/me', {
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ feed }),
  })
  return patch.ok()
}

export async function loginPage(page: Page, username = DEMO_USER, password = DEMO_PASSWORD): Promise<boolean> {
  return loginViaApi(page.request, username, password)
}

export async function logoutViaApi(request: APIRequestContext): Promise<void> {
  await request.post('/api/auth/logout').catch(() => {})
}

export async function isDbReady(request: APIRequestContext): Promise<boolean> {
  const res = await request.get('/api/health/ready')
  if (!res.ok()) return false
  const body = (await res.json()) as { database?: string }
  return body.database === 'ok'
}
