#!/usr/bin/env node
/**
 * UI architecture screenshot capture — tiered routes × viewports × personas.
 * Requires preflight pass (npm run audit:ui-preflight).
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'
import {
  ROOT,
  OUT_DIR,
  SCREENSHOT_DIR,
  VIEWPORTS,
  PERSONAS,
  DEMO_PASSWORD,
  ADMIN_PASSWORD,
  passwordForPersona,
  ensureDir,
  writeJson,
  slugify,
  readText,
} from './audit-ui-shared.mjs'

const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
const orgSlug = process.env.E2E_ORG_SLUG ?? 'demo-east-collective'
const convSlug = process.env.E2E_CONV_SLUG ?? 'preview-c2k-weekend'

const MIN_AUTH_CAPTURES = parseInt(process.env.AUDIT_MIN_AUTH_CAPTURES ?? '40', 10)

function buildRouteTiers(groupId) {
  return [
    { tier: 'A', path: '/', personas: ['guest'], publicOk: true },
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
    { tier: 'A', path: '/settings/privacy', personas: ['member'] },
    { tier: 'A', path: '/support', personas: ['guest', 'member'], publicOk: true },
    { tier: 'B', path: '/conventions', personas: ['member'] },
    { tier: 'B', path: `/conventions/${convSlug}`, personas: ['member'] },
    { tier: 'B', path: `/orgs/${orgSlug}`, personas: ['member'] },
    { tier: 'B', path: '/education', personas: ['member'] },
    { tier: 'B', path: '/vendors', personas: ['member'] },
    { tier: 'B', path: '/presenters', personas: ['member'] },
    { tier: 'B', path: '/media', personas: ['member'] },
    { tier: 'C', path: '/organizer', personas: ['organizer'] },
    { tier: 'C', path: `/organizer/orgs/${orgSlug}`, personas: ['organizer'] },
    { tier: 'C', path: `/organizer/orgs/${orgSlug}/conventions/${convSlug}`, personas: ['organizer'] },
    { tier: 'C', path: `/organizer/orgs/${orgSlug}/conventions/${convSlug}/door`, personas: ['organizer'] },
    { tier: 'D', path: '/moderation/dashboard', personas: ['mod-admin'] },
    { tier: 'D', path: '/policies', personas: ['guest'], publicOk: true },
    { tier: 'D', path: '/terms', personas: ['guest'], publicOk: true },
    { tier: 'D', path: '/?login=1', personas: ['guest'], publicOk: true },
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

function isLoginWall(url, pathname) {
  if (url.includes('login=1') || url.includes('/login')) return true
  if (pathname === '/' && url.includes('login')) return true
  return false
}

function recordCapture(captures, entry) {
  captures.push(entry)
  if (entry.status === 'ok' && entry.file) {
    console.log('wrote', entry.file)
  } else {
    console.warn('skip', entry.path, entry.persona, entry.viewport, entry.reason)
  }
}

async function setupPersona(context, persona) {
  await context.clearCookies()
  const cfg = PERSONAS[persona]
  if (!cfg.username) return

  await login(context.request, cfg.username, cfg.password ?? passwordForPersona(persona))

  if (cfg.onboardingComplete === false) {
    await setOnboardingComplete(context.request, false)
  } else if (cfg.onboardingComplete === true) {
    await setOnboardingComplete(context.request, true)
  }
}

async function gotoWithRetry(page, url, attempts = 2) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      return
    } catch (err) {
      lastErr = err
      if (i < attempts - 1) {
        await page.waitForTimeout(2000)
      }
    }
  }
  throw lastErr
}

async function launchBrowserSession() {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  return { browser, context, page }
}

async function main() {
  const preflightPath = path.join(OUT_DIR, 'preflight-report.json')
  if (!fs.existsSync(preflightPath)) {
    console.error('Missing preflight-report.json — run npm run audit:ui-preflight first')
    process.exit(1)
  }
  const preflight = JSON.parse(readText(preflightPath))
  if (!preflight.ok) {
    console.error('Preflight did not pass — fix runtime before screenshots')
    process.exit(1)
  }

  ensureDir(SCREENSHOT_DIR)
  let { browser, context, page } = await launchBrowserSession()

  const groupId = await resolveGroupId(context.request)
  const ROUTE_TIERS = buildRouteTiers(groupId)
  const captures = []
  const viewports = Object.entries(VIEWPORTS)

  for (const [vpTag, vp] of viewports) {
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height })
    } catch {
      await browser.close().catch(() => {})
      ;({ browser, context, page } = await launchBrowserSession())
      await page.setViewportSize({ width: vp.width, height: vp.height })
    }

    for (const route of ROUTE_TIERS) {
      for (const persona of route.personas) {
        const baseEntry = {
          tier: route.tier,
          path: route.path,
          persona,
          viewport: vpTag,
        }

        try {
          if (persona !== 'guest') {
            await setupPersona(context, persona)
          } else {
            await context.clearCookies()
          }

          await gotoWithRetry(page, `${base}${route.path}`)
          await page.waitForTimeout(1500)

          const finalUrl = page.url()
          const onLoginWall = !route.publicOk && persona !== 'guest' && isLoginWall(finalUrl, route.path)

          if (onLoginWall) {
            const file = path.join(SCREENSHOT_DIR, `${slugify(route.path)}-login-wall-${vpTag}.png`)
            await page.screenshot({ path: file, fullPage: true })
            recordCapture(captures, {
              ...baseEntry,
              status: 'login_wall',
              reason: 'Redirected to login wall — session not established',
              file: path.relative(ROOT, file).replace(/\\/g, '/'),
              url: finalUrl,
            })
            continue
          }

          const filename = `${slugify(route.path)}-${persona}-${vpTag}.png`
          const filePath = path.join(SCREENSHOT_DIR, filename)
          await page.screenshot({ path: filePath, fullPage: true })
          recordCapture(captures, {
            ...baseEntry,
            status: 'ok',
            reason: null,
            file: path.relative(ROOT, filePath).replace(/\\/g, '/'),
            url: finalUrl,
          })
        } catch (err) {
          if (String(err.message ?? err).includes('Target page, context or browser has been closed')) {
            ;({ browser, context, page } = await launchBrowserSession())
            await page.setViewportSize({ width: vp.width, height: vp.height })
          }
          recordCapture(captures, {
            ...baseEntry,
            status: 'skipped',
            reason: String(err.message ?? err),
            file: null,
            url: null,
          })
        }
      }
    }
  }

  await login(context.request, 'RopeDreamer')
  await setOnboardingComplete(context.request, true)
  await browser.close()

  const okCaptures = captures.filter((c) => c.status === 'ok')
  const authCaptures = okCaptures.filter((c) => c.persona !== 'guest')
  const manifest = {
    generatedAt: new Date().toISOString(),
    groupId,
    captureCount: okCaptures.length,
    authCaptureCount: authCaptures.length,
    skippedCount: captures.filter((c) => c.status === 'skipped').length,
    loginWallCount: captures.filter((c) => c.status === 'login_wall').length,
    captures,
  }

  writeJson(path.join(OUT_DIR, 'screenshot-manifest.json'), manifest)

  console.log(`\nScreenshots: ${okCaptures.length} ok (${authCaptures.length} authenticated) in ${SCREENSHOT_DIR}`)

  if (authCaptures.length < MIN_AUTH_CAPTURES) {
    console.error(`FAIL: only ${authCaptures.length} authenticated captures (min ${MIN_AUTH_CAPTURES})`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
