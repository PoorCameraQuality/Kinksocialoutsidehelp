#!/usr/bin/env node
/**
 * Mobile UX issues audit — Playwright heuristics at 360/390 for tier A+B routes.
 * Output: docs/audits/ui/generated/mobile-issues.json, contributes to docs/UI_MOBILE_AUDIT.md
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'
import {
  ROOT,
  OUT_DIR,
  DOCS_DIR,
  SCREENSHOT_DIR,
  writeJson,
  slugify,
  mdEscape,
  readText,
  DEMO_PASSWORD,
  ADMIN_PASSWORD,
  passwordForPersona,
} from './audit-ui-shared.mjs'

const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
const orgSlug = process.env.E2E_ORG_SLUG ?? 'demo-east-collective'
const convSlug = process.env.E2E_CONV_SLUG ?? 'preview-c2k-weekend'

const MOBILE_VIEWPORTS = [
  { tag: '360', width: 360, height: 800 },
  { tag: '390', width: 390, height: 844 },
]

const AUDIT_ROUTES = [
  { path: '/', tier: 'A', guestOk: true },
  { path: '/terms', tier: 'D', guestOk: true },
  { path: '/policies', tier: 'D', guestOk: true },
  { path: '/home', tier: 'A' },
  { path: '/explore', tier: 'A' },
  { path: '/people', tier: 'A' },
  { path: '/events', tier: 'A' },
  { path: '/groups', tier: 'A' },
  { path: '/messaging', tier: 'A' },
  { path: '/notifications', tier: 'A' },
  { path: '/profile', tier: 'A' },
  { path: '/profile/edit', tier: 'A' },
  { path: '/onboarding', tier: 'A' },
  { path: '/settings/account', tier: 'A' },
  { path: '/settings/privacy', tier: 'A' },
  { path: '/support', tier: 'A' },
  { path: '/conventions', tier: 'B' },
  { path: `/conventions/${convSlug}`, tier: 'B', skipIfNoDb: true },
  { path: `/orgs/${orgSlug}`, tier: 'B', skipIfNoDb: true },
  { path: '/education', tier: 'B' },
  { path: '/vendors', tier: 'B' },
  { path: '/presenters', tier: 'B' },
  { path: '/media', tier: 'B' },
  { path: '/organizer', tier: 'C', persona: 'mod-admin' },
  { path: '/moderation/dashboard', tier: 'D', persona: 'mod-admin' },
]

const BACKEND_TEXT_RES = [
  /Command Bridge/i,
  /\bSITE_ADMIN\b/,
  /\bMODERATOR\+?\b/,
  /internal notes?/i,
  /rule-of-two/i,
  /\bECKE\b/,
]

async function login(request, username = 'RopeDreamer', password = DEMO_PASSWORD) {
  const res = await request.post(`${base}/api/auth/session`, {
    data: { username, password },
    headers: { 'Content-Type': 'application/json' },
  })
  return res.ok()
}

async function isDbReady(request) {
  try {
    const res = await request.get(`${base}/api/health/ready`)
    if (!res.ok()) return false
    const body = await res.json()
    return body.database === 'ok'
  } catch {
    return false
  }
}

async function analyzePage(page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    const horizontalOverflow = doc.scrollWidth > doc.clientWidth + 2

    const interactive = [
      ...document.querySelectorAll('button, a, [role="button"], input, select, textarea, [tabindex="0"]'),
    ]
    const smallTargets = []
    for (const el of interactive) {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) continue
      if (rect.width < 44 || rect.height < 44) {
        const label = (el.textContent ?? el.getAttribute('aria-label') ?? el.tagName).trim().slice(0, 40)
        smallTargets.push({ label, w: Math.round(rect.width), h: Math.round(rect.height) })
      }
    }

    const navEls = document.querySelectorAll('nav, [role="navigation"]')
    const fixedNavCount = [...navEls].filter((n) => {
      const s = getComputedStyle(n)
      return s.position === 'fixed' || s.position === 'sticky'
    }).length

    const bodyText = document.body?.innerText ?? ''
    const hasStickyBottom = !!document.querySelector(
      '[class*="sticky"][class*="bottom"], [class*="fixed"][class*="bottom"], .safe-area-pb button[type="submit"]',
    )

    const main = document.querySelector('main, [role="main"]')
    const mainEmpty = main ? main.innerText.trim().length < 20 : true
    const hasSkeleton = !!document.querySelector('[class*="skeleton"], [class*="Skeleton"], [aria-busy="true"]')

    const bottomNavH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--c2k-bottom-nav-total-h')) || 72
    const mainPb = main ? parseFloat(getComputedStyle(main).paddingBottom) : 0
    const safeAreaIssue = !!document.querySelector('.md\\:hidden.fixed.bottom-0') && mainPb < bottomNavH * 0.5

    const cols = document.querySelectorAll('[class*="grid-cols-3"], [class*="lg:grid-cols-3"]')
    const dashboardOnMobile = [...cols].some((c) => c.getBoundingClientRect().width < 500)

    return {
      horizontalOverflow,
      smallTargetCount: smallTargets.length,
      smallTargets: smallTargets.slice(0, 8),
      fixedNavCount,
      hasStickyBottom,
      mainEmpty,
      hasSkeleton,
      safeAreaIssue,
      dashboardOnMobile,
      bodyTextSample: bodyText.slice(0, 4000),
    }
  })
}

function classifyIssues(route, viewport, analysis) {
  const issues = []

  if (analysis.horizontalOverflow) {
    issues.push({
      severity: 'P1',
      problem: 'Horizontal overflow',
      fix: 'shell/template',
    })
  }
  if (analysis.smallTargetCount > 5) {
    issues.push({
      severity: 'P2',
      problem: `${analysis.smallTargetCount} touch targets under 44px`,
      fix: 'component',
    })
  } else if (analysis.smallTargetCount > 0) {
    issues.push({
      severity: 'P3',
      problem: `${analysis.smallTargetCount} touch targets under 44px`,
      fix: 'component',
    })
  }
  if (analysis.fixedNavCount > 2) {
    issues.push({
      severity: 'P2',
      problem: `Duplicate nav (${analysis.fixedNavCount} fixed/sticky nav elements)`,
      fix: 'shell',
    })
  }
  if (analysis.safeAreaIssue) {
    issues.push({
      severity: 'P2',
      problem: 'Possible bottom nav overlap / insufficient main padding',
      fix: 'shell',
    })
  }
  if (
    (route.path.includes('/edit') || route.path.includes('/onboarding') || route.path.includes('/register')) &&
    !analysis.hasStickyBottom
  ) {
    issues.push({
      severity: 'P2',
      problem: 'Long form/wizard without detected sticky bottom action',
      fix: 'template',
    })
  }
  if (analysis.mainEmpty && !analysis.hasSkeleton) {
    issues.push({
      severity: 'P3',
      problem: 'Empty main content without skeleton loading state',
      fix: 'component',
    })
  }
  if (analysis.dashboardOnMobile) {
    issues.push({
      severity: 'P2',
      problem: '3-column dashboard grid visible on narrow viewport',
      fix: 'template',
    })
  }

  for (const re of BACKEND_TEXT_RES) {
    if (re.test(analysis.bodyTextSample)) {
      issues.push({
        severity: 'P3',
        problem: `Backend/internal language visible (${re.source})`,
        fix: 'copy',
      })
      break
    }
  }

  return issues
}

function screenshotLink(routePath, persona, viewport) {
  const file = path.join(SCREENSHOT_DIR, `${slugify(routePath)}-${persona}-${viewport}.png`)
  if (!fs.existsSync(file)) return '—'
  return path.relative(DOCS_DIR, file).replace(/\\/g, '/')
}

function buildSummaryTable(results, manifest) {
  const issues = results.flatMap((r) => r.issues ?? [])
  const bySev = { P1: 0, P2: 0, P3: 0, P4: 0 }
  for (const i of issues) {
    bySev[i.severity] = (bySev[i.severity] ?? 0) + 1
  }

  const personas = [...new Set(results.map((r) => r.persona))]
  const skipped = results.filter((r) =>
    r.issues?.some((i) => i.problem.includes('skipped') || i.problem.includes('login failed')),
  )

  const lines = [
    '## Summary',
    '',
    '| Metric | Count |',
    '|--------|------:|',
    `| Route/viewport checks | ${results.length} |`,
    `| P1 issues | ${bySev.P1} |`,
    `| P2 issues | ${bySev.P2} |`,
    `| P3 issues | ${bySev.P3} |`,
    `| Personas covered | ${personas.join(', ') || '—'} |`,
    `| Skipped (with reason) | ${skipped.length} |`,
  ]

  if (manifest) {
    lines.push(
      `| Screenshots (ok) | ${manifest.captureCount ?? 0} |`,
      `| Authenticated captures | ${manifest.authCaptureCount ?? 0} |`,
      `| Login-wall captures | ${manifest.loginWallCount ?? 0} |`,
      `| Screenshot skips | ${manifest.skippedCount ?? 0} |`,
    )
  }

  lines.push('')
  return lines.join('\n')
}

function buildMarkdown(results, generatedAt, dbOk, serverOk, manifest) {
  const lines = [
    '# UI Mobile Audit — kink.social',
    '',
    `Generated: ${generatedAt.slice(0, 10)} via \`npm run audit:ui-architecture\``,
    '',
    '**Viewports:** 360×800, 390×844 (primary), 430×932, 768×1024, 1440×900 (screenshots).',
    '',
    `**Runtime:** dev server ${serverOk ? 'reachable' : 'unreachable'}; database ${dbOk ? 'ready' : 'not ready'}.`,
    '',
    buildSummaryTable(results, manifest),
    '## Screenshot index',
    '',
    'Screenshots live under [`docs/audits/ui/screenshots/ui-architecture-audit/`](audits/ui/screenshots/ui-architecture-audit/).',
    '',
    'See [`docs/audits/ui/generated/screenshot-manifest.json`](audits/ui/generated/screenshot-manifest.json) for the full capture manifest.',
    '',
    '### Tier A — member core (sample links @ 390px, member persona)',
    '',
  ]

  const tierA = results.filter((r) => r.tier === 'A' && r.viewport === '390' && r.persona === 'member')
  for (const r of tierA) {
    const link = screenshotLink(r.path, 'member', '390')
    lines.push(`- \`${r.path}\`${link !== '—' ? ` — [screenshot](${link})` : ''}`)
  }

  lines.push(
    '',
    '## Mobile issues by route',
    '',
    '| Route | Viewport | Persona | Issues | Severity | Fix category | Screenshot |',
    '|-------|----------|---------|--------|----------|--------------|------------|',
  )

  for (const r of results.sort((a, b) => a.path.localeCompare(b.path) || a.viewport.localeCompare(b.viewport))) {
    const issueSummary = r.issues.length
      ? r.issues.map((i) => i.problem).join('; ')
      : 'No automated issues'
    const maxSev = r.issues.reduce((best, i) => {
      const n = parseInt(i.severity.replace('P', ''), 10)
      return n < parseInt(best.replace('P', ''), 10) ? i.severity : best
    }, 'P4')
    const fix = r.issues.map((i) => i.fix).filter(Boolean).join(', ') || '—'
    const shot = screenshotLink(r.path, r.persona, r.viewport)
    lines.push(
      `| \`${mdEscape(r.path)}\` | ${r.viewport} | ${r.persona} | ${mdEscape(issueSummary)} | ${r.issues.length ? maxSev : '—'} | ${fix} | ${shot !== '—' ? `[view](${shot})` : '—'} |`,
    )
  }

  lines.push(
    '',
    '## Automated check definitions',
    '',
    '| Check | Threshold |',
    '|-------|-----------|',
    '| Horizontal overflow | `scrollWidth > clientWidth + 2` |',
    '| Touch targets | Interactive elements &lt; 44×44 CSS px |',
    '| Duplicate nav | More than 2 fixed/sticky `nav` elements |',
    '| Safe area | Bottom nav present but main padding &lt; half nav height |',
    '| Sticky actions | Forms/onboarding without sticky/fixed bottom control |',
    '| Backend language | Command Bridge, role enums, ECKE, rule-of-two |',
    '| Dashboard on mobile | 3-col grid visible below 500px width |',
    '',
    '## Manual follow-up (Tier C/D)',
    '',
    '- [ ] Door mode: search visible, check-in CTA ≥56px, exit link works',
    '- [ ] Organizer command bridge: tabs reachable, no content under fixed header',
    '- [ ] Moderation queues: case actions thumb-reachable',
    '- [ ] Create flow modal: sheet fits viewport, footer not under browser chrome',
    '',
    '## Related',
    '',
    '- [`docs/audits/ui/MOBILE_UX_AUDIT.md`](audits/ui/MOBILE_UX_AUDIT.md) — staging checklist template',
    '- [`e2e/route-smoke.mobile.spec.ts`](../e2e/route-smoke.mobile.spec.ts) — CI overflow guard',
    '',
  )

  return lines.join('\n')
}

async function main() {
  const preflightPath = path.join(OUT_DIR, 'preflight-report.json')
  if (!fs.existsSync(preflightPath)) {
    console.error('Missing preflight-report.json — run npm run audit:ui-preflight first')
    process.exit(1)
  }
  const preflight = JSON.parse(readText(preflightPath))
  if (!preflight.ok) {
    console.error('Preflight did not pass — fix runtime before mobile audit')
    process.exit(1)
  }

  let serverOk = false
  let dbOk = false
  const results = []
  const manifestPath = path.join(OUT_DIR, 'screenshot-manifest.json')
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(readText(manifestPath)) : null

  try {
    const browser = await chromium.launch()
    const context = await browser.newContext()
    const page = await context.newPage()

    try {
      const ping = await context.request.get(base, { timeout: 5000 })
      serverOk = ping.ok()
    } catch {
      serverOk = false
    }

    dbOk = serverOk && (await isDbReady(context.request))

    if (!serverOk) {
      console.error('Dev server not reachable after preflight — aborting')
      process.exit(1)
    }

    for (const vp of MOBILE_VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height })

      for (const route of AUDIT_ROUTES) {
        if (route.skipIfNoDb && !dbOk) {
          results.push({
            path: route.path,
            tier: route.tier,
            viewport: vp.tag,
            persona: route.persona ?? 'member',
            issues: [
              {
                severity: 'P3',
                problem: 'Skipped — database not ready for dynamic route',
                fix: 'system',
              },
            ],
          })
          continue
        }

        const persona = route.persona ?? (route.guestOk ? 'guest' : 'member')
        await context.clearCookies()
        if (persona !== 'guest') {
          const user = persona === 'mod-admin' ? 'Brax' : 'RopeDreamer'
          const pw = passwordForPersona(persona)
          const loginOk = await login(context.request, user, pw)
          if (!loginOk) {
            results.push({
              path: route.path,
              tier: route.tier,
              viewport: vp.tag,
              persona,
              issues: [
                {
                  severity: 'P1',
                  problem: `Authenticated audit skipped — API login failed for ${user}`,
                  fix: 'system',
                },
              ],
            })
            continue
          }
        }

        try {
          await page.goto(`${base}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
          await page.waitForTimeout(1200)
          const analysis = await analyzePage(page)
          const issues = classifyIssues(route, vp.tag, analysis)

          results.push({
            path: route.path,
            tier: route.tier,
            viewport: vp.tag,
            persona,
            analysis: {
              horizontalOverflow: analysis.horizontalOverflow,
              smallTargetCount: analysis.smallTargetCount,
              fixedNavCount: analysis.fixedNavCount,
              hasStickyBottom: analysis.hasStickyBottom,
              dashboardOnMobile: analysis.dashboardOnMobile,
            },
            issues,
          })
          console.log(`${route.path} @ ${vp.tag} (${persona}): ${issues.length} issues`)
        } catch (err) {
          results.push({
            path: route.path,
            tier: route.tier,
            viewport: vp.tag,
            persona,
            error: String(err.message ?? err),
            issues: [{ severity: 'P1', problem: `Page load failed: ${err.message}`, fix: 'system' }],
          })
        }
      }
    }

    await browser.close()
  } catch (err) {
    console.error('Playwright mobile audit failed:', err.message)
    process.exit(1)
  }

  const loginSkips = results.filter((r) =>
    r.issues?.some((i) => i.problem.includes('login failed')),
  )
  if (loginSkips.length > 0) {
    console.error(`FAIL: ${loginSkips.length} authenticated checks skipped due to login failure`)
    process.exit(1)
  }

  const generatedAt = new Date().toISOString()
  writeJson(path.join(OUT_DIR, 'mobile-issues.json'), { generatedAt, serverOk, dbOk, results })
  fs.writeFileSync(
    path.join(DOCS_DIR, 'UI_MOBILE_AUDIT.md'),
    buildMarkdown(results, generatedAt, dbOk, serverOk, manifest),
  )

  console.log(`Mobile audit: ${results.length} route/viewport checks → docs/UI_MOBILE_AUDIT.md`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
