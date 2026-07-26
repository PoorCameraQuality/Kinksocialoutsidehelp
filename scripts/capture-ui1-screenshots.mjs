#!/usr/bin/env node
/**
 * UI-1 verification screenshots — run with dev stack up (npm run dev).
 * Output: docs/audits/ui/screenshots/ui1/
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
const outDir = join(process.cwd(), 'docs', 'audits', 'ui', 'screenshots', 'ui1')
const demoPassword = process.env.E2E_DEMO_PASSWORD ?? 'demo'

const routes = [
  { name: 'login', path: '/?login=1', auth: false },
  { name: 'onboarding-finish', path: '/profile/edit?onboarding=1', auth: true },
  { name: 'onboarding-redirect', path: '/onboarding', auth: true },
  { name: 'profile-complete-redirect', path: '/profile/complete', auth: true },
  { name: 'home', path: '/home', auth: true },
  { name: 'events', path: '/events', auth: false },
  { name: 'conventions', path: '/conventions', auth: false },
  { name: 'groups', path: '/groups', auth: false },
  { name: 'org-hub', path: '/orgs/demo-east-collective', auth: true },
  {
    name: 'door-denied',
    path: '/organizer/orgs/demo-east-collective/conventions/preview-c2k-weekend/door',
    auth: false,
  },
]

const viewports = [
  { tag: '390', width: 390, height: 844 },
  { tag: '1440', width: 1440, height: 900 },
]

mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
const context = await browser.newContext()
const page = await context.newPage()

async function login() {
  const res = await page.request.post(`${base}/api/auth/session`, {
    data: { username: 'RopeDreamer', password: demoPassword },
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok()) throw new Error(`Login failed: ${res.status()}`)
}

for (const vp of viewports) {
  await page.setViewportSize({ width: vp.width, height: vp.height })
  for (const route of routes) {
    if (route.auth) await login()
    else await context.clearCookies()
    await page.goto(`${base}${route.path}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)
    const file = join(outDir, `${route.name}-${vp.tag}.png`)
    await page.screenshot({ path: file, fullPage: true })
    console.log('wrote', file)
  }
}

await browser.close()
console.log(`\nDone — ${routes.length * viewports.length} screenshots in ${outDir}`)
