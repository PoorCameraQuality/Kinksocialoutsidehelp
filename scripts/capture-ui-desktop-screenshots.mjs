#!/usr/bin/env node
/**
 * Desktop UI screenshot capture — tiered routes × desktop viewports × personas.
 * Output: docs/audits/ui/screenshots/ui-desktop-audit/*.png
 *         docs/audits/ui/generated/desktop-screenshot-manifest.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'
import {
  ROOT,
  OUT_DIR,
  DEMO_PASSWORD,
  passwordForPersona,
  ensureDir,
  writeJson,
  slugify,
  readText,
} from './audit-ui-shared.mjs'

const DESKTOP_SCREENSHOT_DIR = path.join(ROOT, 'docs/audits/ui/screenshots/ui-desktop-audit')

const DESKTOP_VIEWPORTS = {
  '1280': { width: 1280, height: 800 },
  '1366': { width: 1366, height: 900 },
  '1440': { width: 1440, height: 1000 },
  '1600': { width: 1600, height: 1000 },
  '1920': { width: 1920, height: 1080 },
}

const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
const orgSlug = process.env.E2E_ORG_SLUG ?? 'demo-east-collective'
const convSlug = process.env.E2E_CONV_SLUG ?? 'preview-c2k-weekend'

function buildRouteTiers(groupId, vendorSlug) {
  return [
    { tier: 'A', path: '/', personas: ['guest'], publicOk: true },
    { tier: 'A', path: '/?login=1', personas: ['guest'], publicOk: true },
    { tier: 'A', path: '/home', personas: ['member', 'new-member'] },
    { tier: 'A', path: '/explore', personas: ['member'] },
    { tier: 'A', path: '/people', personas: ['member'] },
    { tier: 'A', path: '/events', personas: ['guest', 'member'], publicOk: true },
    { tier: 'A', path: groupId ? `/groups/${groupId}` : '/groups', personas: ['member'] },
    { tier: 'A', path: '/messaging', personas: ['member'] },
    { tier: 'A', path: '/notifications', personas: ['member'] },
    { tier: 'A', path: '/profile', personas: ['member'] },
    { tier: 'A', path: '/profile/edit', personas: ['member', 'new-member'] },
    { tier: 'A', path: '/onboarding', personas: ['new-member'] },
    { tier: 'A', path: '/settings/account', personas: ['member'] },
    { tier: 'A', path: '/connections', personas: ['member'] },
    { tier: 'A', path: '/saved', personas: ['member'] },
    { tier: 'A', path: '/support', personas: ['guest', 'member'], publicOk: true },
    { tier: 'B', path: '/conventions', personas: ['member'] },
    { tier: 'B', path: `/conventions/${convSlug}`, personas: ['member'] },
    { tier: 'B', path: `/orgs/${orgSlug}`, personas: ['member'] },
    { tier: 'B', path: '/education', personas: ['member'] },
    { tier: 'B', path: '/vendors', personas: ['member'] },
    { tier: 'B', path: '/presenters', personas: ['member'] },
    { tier: 'B', path: '/media', personas: ['member'] },
    { tier: 'B', path: '/places', personas: ['member'] },
    { tier: 'B', path: '/vendors/onboarding', personas: ['member'] },
    { tier: 'B', path: '/presenters/onboarding', personas: ['member'] },
    { tier: 'B', path: vendorSlug ? `/vendors/${vendorSlug}` : '/vendors', personas: ['member'] },
    { tier: 'C', path: '/organizer', personas: ['organizer'] },
    { tier: 'C', path: `/organizer/orgs/${orgSlug}`, personas: ['organizer'] },
    { tier: 'C', path: `/organizer/orgs/${orgSlug}/conventions/${convSlug}`, personas: ['organizer'] },
    { tier: 'C', path: `/organizer/orgs/${orgSlug}/conventions/${convSlug}/door`, personas: ['organizer'] },
    { tier: 'D', path: '/moderation/dashboard', personas: ['mod-admin'] },
    { tier: 'D', path: '/moderation/cases', personas: ['mod-admin'] },
    { tier: 'D', path: '/policies', personas: ['guest'], publicOk: true },
    { tier: 'D', path: '/terms', personas: ['guest'], publicOk: true },
  ]
}

async function login(request, username, password = DEMO_PASSWORD) {
  const res = await request.post(`${base}/api/auth/session`, {
    data: { username, password },
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok()) {
    const body = await res.text().catch(() => '')
    throw new Error(`Login failed for ${username}: ${res.status()} ${body.slice(0, 120)}`)
  }
}

async function setOnboardingComplete(request, complete) {
  const getRes = await request.get(`${base}/api/settings/me`)
  if (!getRes.ok()) return false
  const data = await getRes.json()
  const feed = { ...(data.feed ?? {}), onboardingCompletedAt: complete ? new Date().toISOString() : null }
  const patch = await request.patch(`${base}/api/settings/me`, {
    data: { feed },
    headers: { 'Content-Type': 'application/json' },
  })
  return patch.ok()
}

async function resolveGroupId(request) {
  try {
    await login(request, 'RopeDreamer')
    const res = await request.get(`${base}/api/v1/me/groups`)
    if (!res.ok()) return null
    const data = await res.json()
    const first = Array.isArray(data) ? data[0] : data?.groups?.[0] ?? data?.items?.[0]
    return first?.id ?? first?.groupId ?? null
  } catch {
    return null
  }
}

async function resolveVendorSlug(request) {
  try {
    await login(request, 'RopeDreamer')
    const res = await request.get(`${base}/api/v1/vendors?limit=1`)
    if (!res.ok()) return null
    const data = await res.json()
    const first = Array.isArray(data) ? data[0] : data?.items?.[0] ?? data?.vendors?.[0]
    return first?.slug ?? first?.id ?? null
  } catch {
    return null
  }
}

const PERSONAS = {
  guest: { username: null, password: null, onboardingComplete: null },
  'new-member': { username: 'RopeDreamer', password: DEMO_PASSWORD, onboardingComplete: false },
  member: { username: 'RopeDreamer', password: DEMO_PASSWORD, onboardingComplete: true },
  organizer: { username: 'RopeDreamer', password: DEMO_PASSWORD, onboardingComplete: true },
  'mod-admin': { username: 'Brax', password: process.env.BRAX_ADMIN_PASSWORD ?? 'Airship!2', onboardingComplete: true },
}

async function setupPersona(context, persona) {
  await context.clearCookies()
  const cfg = PERSONAS[persona]
  if (!cfg.username) return
  await login(context.request, cfg.username, cfg.password ?? passwordForPersona(persona))
  if (cfg.onboardingComplete === false) await setOnboardingComplete(context.request, false)
  else if (cfg.onboardingComplete === true) await setOnboardingComplete(context.request, true)
}

function isLoginWall(url) {
  return url.includes('login=1') || url.includes('/login')
}

async function main() {
  const preflightPath = path.join(OUT_DIR, 'preflight-report.json')
  if (!fs.existsSync(preflightPath)) {
    console.error('Missing preflight-report.json — run npm run audit:ui-preflight first')
    process.exit(1)
  }
  const preflight = JSON.parse(readText(preflightPath))
  if (!preflight.ok) {
    console.error('Preflight did not pass — fix runtime before desktop screenshots')
    process.exit(1)
  }

  ensureDir(DESKTOP_SCREENSHOT_DIR)
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  const groupId = await resolveGroupId(context.request)
  const vendorSlug = await resolveVendorSlug(context.request)
  const ROUTE_TIERS = buildRouteTiers(groupId, vendorSlug)
  const captures = []

  for (const [vpTag, vp] of Object.entries(DESKTOP_VIEWPORTS)) {
    await page.setViewportSize({ width: vp.width, height: vp.height })

    for (const route of ROUTE_TIERS) {
      for (const persona of route.personas) {
        const baseEntry = { tier: route.tier, path: route.path, persona, viewport: vpTag, width: vp.width, height: vp.height }

        try {
          if (persona !== 'guest') await setupPersona(context, persona)
          else await context.clearCookies()

          await page.goto(`${base}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
          await page.waitForTimeout(1200)

          const finalUrl = page.url()
          const onLoginWall = !route.publicOk && persona !== 'guest' && isLoginWall(finalUrl)

          const filename = `${slugify(route.path)}-${persona}-${vpTag}.png`
          const filePath = path.join(DESKTOP_SCREENSHOT_DIR, filename)
          await page.screenshot({ path: filePath, fullPage: false })

          captures.push({
            ...baseEntry,
            status: onLoginWall ? 'login_wall' : 'ok',
            reason: onLoginWall ? 'Redirected to login wall' : null,
            file: path.relative(ROOT, filePath).replace(/\\/g, '/'),
            url: finalUrl,
          })
          console.log('wrote', captures[captures.length - 1].file)
        } catch (err) {
          captures.push({
            ...baseEntry,
            status: 'skipped',
            reason: String(err.message ?? err),
            file: null,
            url: null,
          })
          console.warn('skip', route.path, persona, vpTag, err.message)
        }
      }
    }
  }

  await browser.close()

  const okCaptures = captures.filter((c) => c.status === 'ok')
  const manifest = {
    generatedAt: new Date().toISOString(),
    groupId,
    vendorSlug,
    viewports: DESKTOP_VIEWPORTS,
    captureCount: okCaptures.length,
    skippedCount: captures.filter((c) => c.status === 'skipped').length,
    loginWallCount: captures.filter((c) => c.status === 'login_wall').length,
    captures,
  }

  writeJson(path.join(OUT_DIR, 'desktop-screenshot-manifest.json'), manifest)
  console.log(`\nDesktop screenshots: ${okCaptures.length} ok in ${DESKTOP_SCREENSHOT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
