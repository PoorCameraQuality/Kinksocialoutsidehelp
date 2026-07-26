import type { Page, Response } from '@playwright/test'
import { expect } from '@playwright/test'

const IGNORE_CONSOLE = [
  /favicon/i,
  /Failed to load resource.*404/i,
  /Manifest:/i,
  // Optional service workers (door kiosk, program cache) - failures are non-fatal; see registerDoorSw.ts
  /bad HTTP response code \(404\) was received when fetching the script/i,
  // React dev-only nesting warnings in organizer tables (pre-existing)
  /validateDOMNesting/i,
  // Expected permission denials during smoke loads (guest convention hub, organizer tabs without grant)
  /Failed to load resource: the server responded with a status of 403 \(Forbidden\)/i,
]

export function attachConsoleGuard(page: Page): void {
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (IGNORE_CONSOLE.some((re) => re.test(text))) return
    throw new Error(`console.error on ${page.url()}: ${text}`)
  })
  page.on('pageerror', (err) => {
    throw new Error(`pageerror on ${page.url()}: ${err.message}`)
  })
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement
    return doc.scrollWidth > doc.clientWidth + 2
  })
  expect(overflow, 'unexpected horizontal overflow on mobile').toBe(false)
}

export async function expectNoServerErrors(responses: Response[]): Promise<void> {
  for (const res of responses) {
    const url = res.url()
    if (!url.includes('/api/')) continue
    if (res.status() >= 500) {
      throw new Error(`Unexpected ${res.status()} from ${url}`)
    }
  }
}

export async function waitForPageSettled(page: Page, timeoutMs = 15_000): Promise<void> {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(300)
  const main = page.locator('main, [role="main"], h1').first()
  await main.waitFor({ state: 'visible', timeout: timeoutMs }).catch(() => {})
}
