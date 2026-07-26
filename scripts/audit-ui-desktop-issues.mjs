#!/usr/bin/env node
/**
 * Desktop UX issues audit — Playwright heuristics at desktop viewports.
 * Output: docs/audits/ui/generated/desktop-issues.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'
import {
  ROOT,
  OUT_DIR,
  DOCS_DIR,
  DEMO_PASSWORD,
  writeJson,
  slugify,
  mdEscape,
  readText,
} from './audit-ui-shared.mjs'

const DESKTOP_SCREENSHOT_DIR = path.join(ROOT, 'docs/audits/ui/screenshots/ui-desktop-audit')
const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
const orgSlug = process.env.E2E_ORG_SLUG ?? 'demo-east-collective'
const convSlug = process.env.E2E_CONV_SLUG ?? 'preview-c2k-weekend'

const DESKTOP_VIEWPORTS = [
  { tag: '1280', width: 1280, height: 800 },
  { tag: '1440', width: 1440, height: 1000 },
  { tag: '1920', width: 1920, height: 1080 },
]

const AUDIT_ROUTES = [
  { path: '/', tier: 'A', guestOk: true },
  { path: '/home', tier: 'A' },
  { path: '/explore', tier: 'A' },
  { path: '/people', tier: 'A' },
  { path: '/events', tier: 'A' },
  { path: '/groups', tier: 'A' },
  { path: '/messaging', tier: 'A' },
  { path: '/notifications', tier: 'A' },
  { path: '/profile', tier: 'A' },
  { path: '/profile/edit', tier: 'A' },
  { path: '/onboarding', tier: 'A', persona: 'new-member' },
  { path: '/settings/account', tier: 'A' },
  { path: '/connections', tier: 'A' },
  { path: '/saved', tier: 'A' },
  { path: '/conventions', tier: 'B' },
  { path: `/conventions/${convSlug}`, tier: 'B' },
  { path: `/orgs/${orgSlug}`, tier: 'B' },
  { path: '/education', tier: 'B' },
  { path: '/vendors', tier: 'B' },
  { path: '/presenters', tier: 'B' },
  { path: '/media', tier: 'B' },
  { path: '/vendors/onboarding', tier: 'B' },
  { path: '/presenters/onboarding', tier: 'B' },
  { path: '/organizer', tier: 'C', persona: 'organizer' },
  { path: `/organizer/orgs/${orgSlug}/conventions/${convSlug}`, tier: 'C', persona: 'organizer' },
  { path: '/moderation/dashboard', tier: 'D', persona: 'mod-admin' },
  { path: '/terms', tier: 'D', guestOk: true },
  { path: '/policies', tier: 'D', guestOk: true },
]

const BACKEND_TEXT_RES = [
  /Command Bridge/i,
  /\bSITE_ADMIN\b/,
  /\bMODERATOR\+?\b/,
  /internal notes?/i,
  /rule-of-two/i,
  /\bECKE\b/,
  /database migration/i,
  /demo (members|threads|events)/i,
  /seeded/i,
  /API database/i,
]

async function login(request, username = 'RopeDreamer', password = DEMO_PASSWORD) {
  const res = await request.post(`${base}/api/auth/session`, {
    data: { username, password },
    headers: { 'Content-Type': 'application/json' },
  })
  return res.ok()
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

async function analyzePage(page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    const horizontalOverflow = doc.scrollWidth > doc.clientWidth + 4

    const h1s = document.querySelectorAll('h1')
    const h1Count = h1s.length

    const buttons = document.querySelectorAll('button')
    const nestedButtons = [...buttons].filter((b) => b.closest('button') && b.closest('button') !== b).length

    const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea')
    const unlabeledInputs = [...inputs].filter((el) => {
      const id = el.id
      const hasLabel = id && document.querySelector(`label[for="${id}"]`)
      const hasAria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')
      return !hasLabel && !hasAria && el.type !== 'submit' && el.type !== 'button'
    }).length

    const ctas = document.querySelectorAll('a[class*="btn"], button[class*="primary"], [data-testid*="cta"]')
    const primaryCtas = [...ctas].filter((el) => {
      const cls = el.className ?? ''
      return /primary|accent|bg-dc-accent|btn-primary/i.test(cls) || el.getAttribute('data-variant') === 'primary'
    })

    const navEls = document.querySelectorAll('nav, [role="navigation"], header nav')
    const navCount = navEls.length
    const fixedNavCount = [...navEls].filter((n) => {
      const s = getComputedStyle(n)
      return s.position === 'fixed' || s.position === 'sticky'
    }).length

    const main = document.querySelector('main, [role="main"]')
    const mainEmpty = main ? main.innerText.trim().length < 30 : true
    const hasSkeleton = !!document.querySelector('[class*="skeleton"], [class*="Skeleton"], [aria-busy="true"]')

    const imgs = document.querySelectorAll('img')
    const brokenMedia = [...imgs].filter((img) => !img.complete || img.naturalWidth === 0).length

    const emptyMediaRegions = document.querySelectorAll('[class*="aspect-"], [class*="media"], [class*="cover"]')
    const emptyRegions = [...emptyMediaRegions].filter((el) => {
      const rect = el.getBoundingClientRect()
      if (rect.height < 40 || rect.width < 40) return false
      const hasImg = el.querySelector('img[src]')
      const hasBg = getComputedStyle(el).backgroundImage !== 'none'
      return !hasImg && !hasBg && el.textContent.trim().length < 5
    }).length

    const tables = document.querySelectorAll('table, [role="table"], [class*="DataTable"]')
    const wideTables = [...tables].filter((t) => t.getBoundingClientRect().width > 900).length

    const filters = document.querySelectorAll('[class*="filter"], [class*="Filter"], input[type="search"]')
    const filterCount = filters.length

    const bodyText = document.body?.innerText ?? ''

    const aboveFoldHeight = window.innerHeight
    const aboveFoldEls = [...document.querySelectorAll('h1, h2, button, a, nav, [role="tablist"]')].filter((el) => {
      const r = el.getBoundingClientRect()
      return r.top >= 0 && r.top < aboveFoldHeight * 0.65
    })

    const focusable = document.querySelectorAll('a, button, input, select, textarea, [tabindex]')
    const smallTargets = [...focusable].filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && (r.width < 32 || r.height < 32)
    }).length

    const bottomNavEls = document.querySelectorAll('nav[aria-label="Bottom navigation"]')
    const bottomNavVisible = [...bottomNavEls].some((el) => {
      const s = getComputedStyle(el)
      return s.display !== 'none' && s.visibility !== 'hidden' && el.getBoundingClientRect().height > 0
    })

    return {
      horizontalOverflow,
      h1Count,
      nestedButtons,
      unlabeledInputs,
      primaryCtaCount: primaryCtas.length,
      navCount,
      fixedNavCount,
      mainEmpty,
      hasSkeleton,
      brokenMedia,
      emptyRegions,
      wideTables,
      filterCount,
      aboveFoldElementCount: aboveFoldEls.length,
      smallTargets,
      bottomNavVisible,
      bodyTextSample: bodyText.slice(0, 5000),
    }
  })
}

function classifyIssues(route, viewport, analysis) {
  const issues = []
  const flags = []

  if (analysis.horizontalOverflow) {
    issues.push({ flag: 'horizontal-overflow', severity: 'P1', problem: 'Horizontal overflow at desktop width', fix: 'shell/template' })
  }
  if (analysis.h1Count > 1) {
    issues.push({ flag: 'multiple-h1', severity: 'P2', problem: `${analysis.h1Count} H1 elements on page`, fix: 'component' })
    flags.push('multiple-h1')
  }
  if (analysis.nestedButtons > 0) {
    issues.push({ flag: 'nested-buttons', severity: 'P2', problem: `${analysis.nestedButtons} nested button elements`, fix: 'component' })
    flags.push('nested-buttons')
  }
  if (analysis.unlabeledInputs > 2) {
    issues.push({ flag: 'missing-labels', severity: 'P2', problem: `${analysis.unlabeledInputs} form fields without label/aria`, fix: 'component' })
    flags.push('missing-labels')
  }
  if (analysis.primaryCtaCount > 4) {
    issues.push({ flag: 'competing-ctas', severity: 'P2', problem: `${analysis.primaryCtaCount} primary-style CTAs above the fold region`, fix: 'template' })
    flags.push('too-many-ctas')
  }
  if (analysis.fixedNavCount > 3 || analysis.navCount > 5) {
    issues.push({ flag: 'duplicate-nav', severity: 'P2', problem: `Duplicate navigation (${analysis.navCount} nav regions, ${analysis.fixedNavCount} fixed/sticky)`, fix: 'shell' })
    flags.push('duplicate-nav')
  }
  if (analysis.aboveFoldElementCount > 18) {
    issues.push({ flag: 'cluttered-above-fold', severity: 'P2', problem: 'Cluttered above-the-fold layout (many headings/controls in top 65vh)', fix: 'template' })
    flags.push('cluttered-above-fold')
  }
  if (analysis.emptyRegions > 2) {
    issues.push({ flag: 'empty-media', severity: 'P2', problem: `${analysis.emptyRegions} empty media/aspect-ratio regions`, fix: 'component' })
    flags.push('empty-media')
  }
  if (analysis.brokenMedia > 0) {
    issues.push({ flag: 'broken-media', severity: 'P2', problem: `${analysis.brokenMedia} broken image(s)`, fix: 'component' })
    flags.push('broken-media')
  }
  if (analysis.mainEmpty && !analysis.hasSkeleton) {
    issues.push({ flag: 'missing-skeleton', severity: 'P2', problem: 'Empty main without skeleton loading state', fix: 'component' })
    flags.push('missing-skeleton')
  }
  if (analysis.wideTables > 0 && route.path.includes('/organizer')) {
    issues.push({ flag: 'dense-table', severity: 'P3', problem: 'Wide data table — consider master-detail on desktop', fix: 'template' })
    flags.push('dense-table')
  }
  if (analysis.bottomNavVisible) {
    issues.push({ flag: 'mobile-chrome-on-desktop', severity: 'P3', problem: 'Mobile bottom nav chrome visible at desktop width', fix: 'shell' })
    flags.push('mobile-chrome-on-desktop')
  }
  if (analysis.smallTargets > 8) {
    issues.push({ flag: 'small-targets', severity: 'P3', problem: `${analysis.smallTargets} interactive targets under 32px`, fix: 'component' })
    flags.push('small-targets')
  }
  if (route.path.includes('/organizer') || route.path.includes('/moderation')) {
    issues.push({ flag: 'internal-dashboard', severity: 'P3', problem: 'Dashboard/console surface — verify public pages do not share this density', fix: 'template' })
    flags.push('internal-dashboard')
  }
  if (route.path === '/explore' || route.path === '/home') {
    if (analysis.filterCount < 2) {
      issues.push({ flag: 'filter-inconsistency', severity: 'P3', problem: 'Filter/search pattern may differ from directory pages', fix: 'template' })
    }
  }

  for (const re of BACKEND_TEXT_RES) {
    if (re.test(analysis.bodyTextSample)) {
      issues.push({ flag: 'backend-language', severity: 'P2', problem: `Backend/developer language visible (${re.source})`, fix: 'copy' })
      flags.push('backend-language')
      break
    }
  }

  return { issues, flags: [...new Set(flags)] }
}

function screenshotLink(routePath, persona, viewport) {
  const file = path.join(DESKTOP_SCREENSHOT_DIR, `${slugify(routePath)}-${persona}-${viewport}.png`)
  if (!fs.existsSync(file)) return null
  return path.relative(DOCS_DIR, file).replace(/\\/g, '/')
}

async function launchSession() {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  return { browser, context, page }
}

async function main() {
  let { browser, context, page } = await launchSession()
  const results = []
  let serverOk = false
  let dbOk = false

  try {
    const health = await context.request.get(`${base}/api/health/ready`)
    serverOk = health.ok()
    if (serverOk) {
      const body = await health.json()
      dbOk = body.database === 'ok'
    }
  } catch {
    serverOk = false
  }

  for (const vp of DESKTOP_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: vp.width, height: vp.height })
    } catch {
      await browser.close().catch(() => {})
      ;({ browser, context, page } = await launchSession())
      await page.setViewportSize({ width: vp.width, height: vp.height })
    }

    for (const route of AUDIT_ROUTES) {
      const persona = route.persona ?? (route.guestOk ? 'guest' : 'member')

      try {
        await context.clearCookies()
        if (!route.guestOk) {
          const user = persona === 'mod-admin' ? 'Brax' : 'RopeDreamer'
          const pw = persona === 'mod-admin' ? (process.env.BRAX_ADMIN_PASSWORD ?? 'Airship!2') : DEMO_PASSWORD
          const ok = await login(context.request, user, pw)
          if (!ok) throw new Error('login failed')
          if (persona === 'new-member') await setOnboardingComplete(context.request, false)
          else await setOnboardingComplete(context.request, true)
        }

        await page.goto(`${base}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
        await page.waitForTimeout(800)

        const analysis = await analyzePage(page)
        const { issues, flags } = classifyIssues(route, vp, analysis)

        results.push({
          path: route.path,
          tier: route.tier,
          viewport: vp.tag,
          persona,
          analysis,
          issues,
          flags,
          screenshot: screenshotLink(route.path, persona, vp.tag),
        })
      } catch (err) {
        if (String(err.message ?? err).includes('Target page, context or browser has been closed')) {
          await browser.close().catch(() => {})
          ;({ browser, context, page } = await launchSession())
          await page.setViewportSize({ width: vp.width, height: vp.height })
        }
        results.push({
          path: route.path,
          tier: route.tier,
          viewport: vp.tag,
          persona,
          issues: [{ flag: 'skipped', severity: 'P4', problem: String(err.message ?? err), fix: 'runtime' }],
          flags: ['skipped'],
          screenshot: null,
        })
      }
    }
  }

  await browser.close()

  const generatedAt = new Date().toISOString()
  writeJson(path.join(OUT_DIR, 'desktop-issues.json'), { generatedAt, serverOk, dbOk, results })
  console.log(`Desktop issues: ${results.length} checks → desktop-issues.json`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
