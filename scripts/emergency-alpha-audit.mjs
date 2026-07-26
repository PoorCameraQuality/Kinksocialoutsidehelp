#!/usr/bin/env node
/**
 * Production emergency alpha audit for kink.social (or EMERGENCY_AUDIT_URL).
 * Evidence only — does not modify app code.
 *
 * Output: npm run snapshot:alpha
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, cpSync, rmSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { homedir } from 'node:os'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

const BASE_URL = (process.env.EMERGENCY_AUDIT_URL ?? 'https://kink.social').replace(/\/$/, '')
const USERNAME = process.env.EMERGENCY_AUDIT_USER ?? 'TestAdmin'
const PASSWORD = process.env.EMERGENCY_AUDIT_PASSWORD ?? 'Testing!2'

const SCREENSHOTS_DIR = join(REPO_ROOT, 'audit-output', 'screenshots')
const REPORTS_DIR = join(REPO_ROOT, 'audit-output', 'reports')
const FIXTURES_DIR = join(REPO_ROOT, 'audit-output', 'fixtures')

const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  mobile: { width: 390, height: 844 },
}

const ERROR_PATTERNS = [
  { id: 'undefined', re: /\bundefined\b/i },
  { id: 'null_literal', re: /\bnull\b/i },
  { id: 'nan', re: /\bNaN\b/ },
  { id: 'error_prefix', re: /Error:/i },
  { id: 'stack', re: /\bstack\b/i },
  { id: 'prisma', re: /Prisma/i },
  { id: 'drizzle', re: /Drizzle/i },
  { id: 'sql', re: /\bSQL\b/i },
  { id: 's3', re: /\bS3\b/i },
  { id: 'bucket', re: /bucket/i },
  { id: 'http_500', re: /\b500\b/ },
  { id: 'http_401', re: /\b401\b/ },
  { id: 'http_403', re: /\b403\b/ },
  { id: 'object_object', re: /\[object Object\]/i },
]

const SEED_LOGGED_IN_ROUTES = [
  '/home',
  '/explore',
  '/events',
  '/conventions',
  '/groups',
  '/education',
  '/vendors',
  '/people',
  '/orgs',
  '/messaging',
  '/notifications',
  '/connections',
  '/profile',
  '/profile/edit',
  '/settings/account',
  '/settings/profile',
  '/settings/privacy',
  '/settings/notifications',
  '/saved',
  '/my-posts',
  '/organizer',
  '/presenters',
  '/media',
]

/** Minimal valid 1×1 PNG (safe test fixture). */
function generateSafePngBuffer() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
}

function ensureDirs() {
  for (const dir of [SCREENSHOTS_DIR, REPORTS_DIR, FIXTURES_DIR]) {
    mkdirSync(dir, { recursive: true })
  }
  const fixturePath = join(FIXTURES_DIR, 'safe-test.png')
  if (!existsSync(fixturePath)) {
    writeFileSync(fixturePath, generateSafePngBuffer())
  }
  return fixturePath
}

function slugifyRoute(path) {
  return path
    .replace(/^\//, '')
    .replace(/[?#].*$/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'root'
}

function redactSecrets(text) {
  if (text == null) return text
  if (typeof text === 'object') return deepRedact(text)
  return String(text).replaceAll(PASSWORD, '[REDACTED]')
}

function deepRedact(value) {
  if (typeof value === 'string') return value.replaceAll(PASSWORD, '[REDACTED]')
  if (Array.isArray(value)) return value.map(deepRedact)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = deepRedact(v)
    return out
  }
  return value
}

function classifySeverity(entry) {
  const { visibleProblems, failedRequests, consoleErrors, status, loginRequired, uploadFailure } = entry
  if (loginRequired && entry.route !== '/?login=1') return 'high'
  if (uploadFailure) return 'high'
  if (visibleProblems.some((p) => /prisma|drizzle|sql|s3|bucket|500/i.test(p))) return 'launch-blocker'
  if (failedRequests.some((r) => r.status >= 500)) return 'launch-blocker'
  if (visibleProblems.length > 0) return 'high'
  if (failedRequests.some((r) => r.status === 401 || r.status === 403)) return 'medium'
  if (consoleErrors.length > 0) return 'medium'
  if (status === 'error') return 'high'
  if (status === 'skipped') return 'low'
  return 'none'
}

function recommendFixCategory(entry) {
  const sev = classifySeverity(entry)
  const probs = entry.visibleProblems.join(' ')
  if (entry.loginRequired) return 'auth-session'
  if (/prisma|drizzle|sql/i.test(probs)) return 'database'
  if (/s3|bucket/i.test(probs) || entry.uploadFailure) return 'storage-upload'
  if (/401|403/.test(probs) || entry.failedRequests.some((r) => r.status === 401 || r.status === 403))
    return 'permissions'
  if (entry.consoleErrors.length) return 'frontend-runtime'
  if (entry.failedRequests.some((r) => r.status >= 500)) return 'api-backend'
  if (sev === 'none') return 'none'
  return 'ui-layout'
}

function suspectedCause(entry) {
  if (entry.loginRequired) return 'Session missing or expired; route redirected to login'
  if (entry.uploadFailure) return entry.uploadDetail ?? 'Upload pipeline failed'
  if (entry.failedRequests.some((r) => r.status >= 500))
    return `API returned ${entry.failedRequests.filter((r) => r.status).join(', ')}`
  if (entry.visibleProblems.some((p) => /prisma|drizzle|sql/i.test(p)))
    return 'Backend/database error surfaced in UI'
  if (entry.visibleProblems.some((p) => /s3|bucket/i.test(p))) return 'Object storage misconfiguration or failure'
  if (entry.consoleErrors.length) return 'JavaScript runtime error in browser'
  if (entry.failedRequests.length) return 'HTTP client errors on API calls'
  if (entry.visibleProblems.length) return 'Raw error strings visible on page'
  return 'No issue detected'
}

function normalizeInternalPath(href, baseUrl) {
  try {
    const url = new URL(ref, baseUrl)
    const base = new URL(baseUrl)
    if (url.origin !== base.origin) return null
    const path = url.pathname + url.search
    if (path.startsWith('//')) return null
    if (/\.(png|jpe?g|webp|svg|pdf|ico)$/i.test(url.pathname)) return null
    if (ref.startsWith('#') || ref === '#create') return null
    if (path.includes('logout')) return null
    return path
  } catch {
    return null
  }
}

function uniquePaths(paths) {
  const seen = new Set()
  const out = []
  for (const p of paths) {
    const key = p.split('#')[0]
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}

function attachListeners(page, routePath, viewport, consoleErrors, failedRequests) {
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleErrors.push({
        route: routePath,
        viewport,
        type: msg.type(),
        message: redactSecrets(msg.text()),
        url: page.url(),
      })
    }
  })

  page.on('response', (response) => {
    const status = response.status()
    const url = response.url()
    if (status < 400) return
    if (!url.includes('/api/') && !url.includes(BASE_URL)) return
    failedRequests.push({
      route: routePath,
      viewport,
      url: redactSecrets(url),
      status,
      method: response.request().method(),
      statusText: response.statusText(),
    })
  })

  page.on('pageerror', (err) => {
    consoleErrors.push({
      route: routePath,
      viewport,
      type: 'pageerror',
      message: redactSecrets(err.message),
      url: page.url(),
    })
  })
}

function scanVisibleProblems(bodyText) {
  const hits = []
  const sample = bodyText.slice(0, 50_000)
  for (const { id, re } of ERROR_PATTERNS) {
    if (re.test(sample)) hits.push(id)
  }
  return [...new Set(hits)]
}

function filterVisibleProblems(hits, bodyText) {
  /** Drop noisy null/undefined hits on pages that mention those words in normal copy. */
  const nullErrorRe = /(\bnull\b.*\b(error|pointer|reference|check)|cannot read.*null)/i
  const undefinedErrorRe = /(\bundefined\b.*\b(behavior|is not|property|function)|ReferenceError)/i
  const filtered = hits.filter((id) => {
    if (id === 'null_literal' && !nullErrorRe.test(bodyText)) return false
    if (id === 'undefined' && !undefinedErrorRe.test(bodyText)) return false
    return true
  })
  return filtered.length ? filtered : hits.filter((id) => !['null_literal', 'undefined'].includes(id))
}

function visibleProblemSummary(hits, bodyText) {
  const snippets = []
  for (const id of hits) {
    const pat = ERROR_PATTERNS.find((p) => p.id === id)?.re
    if (!pat) continue
    const idx = bodyText.search(pat)
    if (idx >= 0) {
      snippets.push(bodyText.slice(Math.max(0, idx - 40), idx + 80).replace(/\s+/g, ' ').trim())
    }
  }
  return snippets.slice(0, 5)
}

function routeConsoleErrors(all, route, viewport) {
  return all.filter((e) => e.route === route && e.viewport === viewport)
}

function routeNetworkErrors(all, route, viewport) {
  return all.filter((e) => e.route === route && e.viewport === viewport)
}

function screenshotPath(routeSlug, viewport) {
  return join(SCREENSHOTS_DIR, `${routeSlug}-${viewport}.png`)
}

function waitForStable(page) {
  return page
    .waitForLoadState('domcontentloaded')
    .then(async () => {
      try {
        await page.waitForLoadState('networkidle', { timeout: 12_000 })
      } catch {
        /* SPA polling */
      }
      await page.waitForTimeout(800)
    })
}

function isLoginWall(bodyText, url) {
  return (
    /\?(\?|&)login=1/.test(url) ||
    /sign in to continue|log in to continue|create an account/i.test(bodyText.slice(0, 2000))
  )
}

function makeRouteRecord({
  route,
  status,
  screenshotDesktop,
  screenshotMobile,
  visibleProblems,
  visibleSnippets,
  consoleErrors,
  failedRequests,
  error,
  loginRequired,
  extra = {}
}) {
  const entry = {
    route,
    status,
    screenshotDesktop,
    screenshotMobile,
    visibleProblems,
    visibleSnippets,
    consoleErrors,
    failedRequests,
    error,
    loginRequired: Boolean(loginRequired),
    ...extra,
  }
  entry.severity = classifySeverity(entry)
  entry.recommendedFixCategory = recommendFixCategory(entry)
  entry.suspectedCause = suspectedCause(entry)
  return entry
}

function generateMarkdownReport(report) {
  const lines = [
    '# Emergency Alpha Audit',
    '',
    `**Generated:** ${report.generatedAt}`,
    `**Target:** ${report.baseUrl}`,
    `**Login user:** ${report.username}`,
    `**Login succeeded:** ${report.loginSucceeded ? 'yes' : 'no'}`,
    '',
    '## Summary',
    '',
    `- Routes visited: ${report.routes.length}`,
    `- Launch blockers: ${report.summary.launchBlockers}`,
    `- High severity: ${report.summary.high}`,
    `- Medium severity: ${report.summary.medium}`,
    `- Upload tests: ${report.uploadTests.map((u) => `${u.name}=${u.status}`).join(', ')}`,
    `- Feed post test: ${report.feedPostTest.status}`,
    '',
    '## Route findings',
    '',
    '| Route | Status | Severity | Visible problem | Console errors | Failed requests | Suspected cause | Fix category |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ]

  for (const r of report.routes) {
    const visibleProblems = r.visibleProblems ?? []
    const consoleErrors = r.consoleErrors ?? []
    const failedRequests = r.failedRequests ?? []
    const vis = visibleProblems.length ? visibleProblems.join(', ') : '—'
    const cons = consoleErrors.length ? String(consoleErrors.length) : '0'
    const net = failedRequests.length ? failedRequests.map((f) => `${f.status}`).join(', ') : '0'
    lines.push(
      `| \`${r.route}\` | ${r.status} | ${r.severity} | ${vis} | ${cons} | ${net} | ${r.suspectedCause} | ${r.recommendedFixCategory} |`,
    )
    if (r.screenshotDesktop) {
      lines.push(`| ↳ desktop | | | | | | | \`${r.screenshotDesktop}\` | |`)
    }
    if (r.screenshotMobile) {
      lines.push(`| ↳ mobile | | | | | | | \`${r.screenshotMobile}\` | |`)
    }
    if (r.visibleSnippets?.length) {
      for (const s of r.visibleSnippets) {
        lines.push(`| ↳ snippet | | | \`${redactSecrets(s).slice(0, 100)}\` | | | | |`)
      }
    }
    if (r.error) {
      lines.push(`| ↳ error | | | \`${redactSecrets(r.error)}\` | | | | |`)
    }
  }

  lines.push('', '## Upload tests', '')
  for (const u of report.uploadTests) {
    lines.push(`### ${u.name}`)
    lines.push(`- **Status:** ${u.status}`)
    lines.push(`- **Reachable:** ${u.reachable}`)
    if (u.detail) lines.push(`- **Detail:** ${redactSecrets(u.detail)}`)
    if (u.screenshot) lines.push(`- **Screenshot:** \`${u.screenshot}\``)
    lines.push('')
  }

  lines.push('## Feed post test', '')
  lines.push(`- **Status:** ${report.feedPostTest.status}`)
  lines.push(`- **Reachable:** ${report.feedPostTest.reachable}`)
  if (report.feedPostTest.detail) lines.push(`- **Detail:** ${redactSecrets(report.feedPostTest.detail)}`)

  lines.push('', '## Login', '')
  lines.push(`- API login: ${report.login.apiOk ? 'ok' : 'failed'}`)
  lines.push(`- UI login: ${report.login.uiOk ? 'ok' : 'failed'}`)
  if (report.login.detail) lines.push(`- Detail: ${redactSecrets(report.login.detail)}`)

  if (report.loginSucceeded === false) {
    lines.push('', '## ⚠ Login failed — treat all authed routes as unreliable', '')
  }

  return lines.join('\n')
}

function summarizeRoutes(routes) {
  const counts = { launchBlockers: 0, high: 0, medium: 0, low: 0, none: 0 }
  for (const r of routes) {
    const sev = r.severity ?? 'none'
    if (sev === 'launch-blocker') counts.launchBlockers++
    else if (sev === 'high') counts.high++
    else if (sev === 'medium') counts.medium++
    else if (sev === 'low') counts.low++
    else counts.none++
  }
  return counts
}

function runTimestamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

function listFilesRecursive(dir, base = dir) {
  const out = []
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...listFilesRecursive(full, base))
    else out.push(relative(base, full).replace(/\\/g, '/'))
  }
  return out
}

/** Copy screenshots + reports to Desktop and repo bundle folder; zip for ChatGPT upload. */
function bundleForUpload(runId, report) {
  const bundleName = `kink-social-audit-${runId}`
  const repoBundle = join(REPO_ROOT, 'audit-output', 'bundles', bundleName)
  const desktopBundle = join(homedir(), 'Desktop', bundleName)
  const desktopZip = `${desktopBundle}.zip`

  for (const dest of [repoBundle, desktopBundle]) {
    rmSync(dest, { recursive: true, force: true })
    mkdirSync(join(dest, 'screenshots'), { recursive: true })
    mkdirSync(join(dest, 'reports'), { recursive: true })
    if (existsSync(SCREENSHOTS_DIR)) {
      cpSync(SCREENSHOTS_DIR, join(dest, 'screenshots'), { recursive: true })
    }
    if (existsSync(REPORTS_DIR)) {
      cpSync(REPORTS_DIR, join(dest, 'reports'), { recursive: true })
    }
  }

  const readme = [
    'Kink Social — Emergency Alpha Audit Bundle',
    '==========================================',
    '',
    `Generated: ${report.generatedAt}`,
    `Target: ${report.baseUrl}`,
    `Login: ${report.loginSucceeded ? 'OK' : 'FAILED'} (${report.username})`,
    '',
    'Upload to ChatGPT',
    '-----------------',
    '1. Upload this entire folder OR the .zip next to it on your Desktop.',
    '2. Also paste audit-output/reports/emergency-alpha-audit.md (included here as reports/emergency-alpha-audit.md).',
    '3. Key screenshots to review first:',
    '   - logged-out-desktop.png / logged-out-mobile.png',
    '   - login-page-desktop.png / login-page-mobile.png',
    '   - upload-avatar.png, upload-avatar-after.png',
    '   - Any route named *-desktop.png / *-mobile.png with visible errors',
    '',
    `Screenshots: ${listFilesRecursive(join(desktopBundle, 'screenshots')).length} files`,
    `Launch blockers: ${report.summary.launchBlockers}`,
    `High severity routes: ${report.summary.high}`,
    '',
    'Paths on this machine:',
    `  Folder: ${desktopBundle}`,
    `  Zip:    ${desktopZip}`,
    `  Repo:   ${repoBundle}`,
    '',
  ].join('\n')

  writeFileSync(join(desktopBundle, 'UPLOAD-README.txt'), readme)
  writeFileSync(join(repoBundle, 'UPLOAD-README.txt'), readme)

  const manifest = {
    bundleName,
    generatedAt: report.generatedAt,
    baseUrl: report.baseUrl,
    desktopFolder: desktopBundle,
    desktopZip,
    repoFolder: repoBundle,
    screenshots: listFilesRecursive(join(desktopBundle, 'screenshots')),
    reports: listFilesRecursive(join(desktopBundle, 'reports')),
  }
  writeFileSync(join(desktopBundle, 'manifest.json'), JSON.stringify(manifest, null, 2))
  writeFileSync(join(repoBundle, 'manifest.json'), JSON.stringify(manifest, null, 2))

  if (process.platform === 'win32') {
    try {
      rmSync(desktopZip, { force: true })
      execSync(
        `powershell -NoProfile -Command "Compress-Archive -Path '${desktopBundle.replace(/'/g, "''")}\\*' -DestinationPath '${desktopZip.replace(/'/g, "''")}' -Force"`,
        { stdio: 'pipe' },
      )
    } catch (err) {
      console.warn('Could not create zip (folder copy still available):', err.message ?? err)
    }
  }

  return manifest
}

function printReportSummary(report, bundle) {
  console.log('\n========== EMERGENCY ALPHA AUDIT REPORT ========')
  console.log(`Target: ${report.baseUrl}`)
  console.log(`Login: ${report.loginSucceeded ? 'OK' : 'FAILED'}`)
  console.log(
    `Routes: ${report.routes.length} | blockers=${report.summary.launchBlockers} high=${report.summary.high} medium=${report.summary.medium}`,
  )
  console.log(`Reports: ${join(REPORTS_DIR, 'emergency-alpha-audit.md')}`)
  console.log(`JSON:    ${join(REPORTS_DIR, 'emergency-alpha-audit.json')}`)
  if (bundle) {
    console.log('')
    console.log('--- Upload bundle (for ChatGPT) ---')
    console.log(`Desktop folder: ${bundle.desktopFolder}`)
    console.log(`Desktop zip:    ${bundle.desktopZip}`)
    console.log(`Repo copy:      ${bundle.repoFolder}`)
    console.log(`Screenshots:    ${bundle.screenshots.length} files`)
  }
  console.log('========================================\n')

  const blockers = report.routes.filter((r) => r.severity === 'launch-blocker')
  const highs = report.routes.filter((r) => r.severity === 'high').slice(0, 10)
  if (blockers.length) {
    console.log('Launch blockers:')
    for (const r of blockers) console.log(`  - ${r.route}: ${r.suspectedCause}`)
  }
  if (highs.length) {
    console.log('High severity (top 10):')
    for (const r of highs) console.log(`  - ${r.route}: ${r.visibleProblems.join(', ') || r.error || r.suspectedCause}`)
  }
}

function loginViaApi(request, username, password) {
  return request
    .post('/api/auth/session', {
      headers: { 'Content-Type': 'application/json' },
      data: { username, password },
    })
    .then(async (res) => ({
      ok: res.ok(),
      status: res.status(),
      body: await res.json().catch(async () => ({ raw: await res.text() })),
    }))
}

function loginViaUi(page, username, password) {
  return ( async () => {
    await page.goto('/?login=1', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    const loginTab = page.getByRole('button', { name: /^login$/i }).first()
    if (await loginTab.isVisible().catch(async () => false)) {
      await loginTab.click()
    }
    const loginForm = page
      .locator('form')
      .filter({ has: page.locator('a[href="/forgot-password"]') })
      .first()
    await loginForm.locator('input[name="username"]').fill(username, { timeout: 15_000 })
    await loginForm.locator('input[name="password"]').fill(password)
    await loginForm.getByRole('button', { name: /^login$/i }).click()
    await page.waitForURL((url) => !url.search.includes('login=1'), { timeout: 45_000 }).catch(async () => {})
    const me = await page.request.get('/api/auth/me')
    if (!me.ok()) return { ok: false, detail: `me HTTP ${me.status()}` }
    const body = await me.json()
    return { ok: body?.viewer?.authenticated === true, detail: body?.viewer?.username }
  })()
}

function discoverRoutesFromNav(page) {
  return page.evaluate((baseOrigin) => {
    const paths = new Set()
    const selectors = ['nav a[href]', 'header a[href]', '[role="navigation"] a[href]', 'footer a[href]']
    for (const sel of selectors) {
      for (const a of document.querySelectorAll(sel)) {
        const href = a.getAttribute('href')
        if (!href || href.startsWith('#') || href === '#create') continue
        try {
          const u = new URL(href, baseOrigin)
          if (u.origin !== baseOrigin) continue
          if (/\.(png|jpe?g|webp|svg|pdf)$/i.test(u.pathname)) continue
          paths.add(u.pathname + u.search)
        } catch {
          /* ignore */
        }
      }
    }
    return [...paths]
  }, BASE_URL)
}

function discoverProfileMenuRoutes(page) {
  return page.evaluate((baseOrigin) => {
    const paths = new Set()
    for (const a of document.querySelectorAll('a[href^="/profile"], a[href^="/settings"]')) {
      const href = a.getAttribute('href')
      if (!href) continue
      try {
        const u = new URL(href, baseOrigin)
        if (u.origin === baseOrigin) paths.add(u.pathname + u.search)
      } catch {
        /* ignore */
      }
    }
    return [...paths]
  }, BASE_URL)
}

function routeRecordForViewport(allConsole, allNetwork, route, viewport, bodyText, url, status, shotPath, error) {
  const visibleHits = filterVisibleProblems(scanVisibleProblems(bodyText), bodyText)
  const snippets = visibleProblemSummary(visibleHits, bodyText)
  const consoleErrors = routeConsoleErrors(allConsole, route, viewport)
  const failedRequests = routeNetworkErrors(allNetwork, route, viewport)
  const loginRequired = isLoginWall(bodyText, url)
  return {
    viewport,
    status,
    screenshot: shotPath,
    visibleProblems: visibleHits,
    visibleSnippets: snippets,
    consoleErrors,
    failedRequests,
    error,
    loginRequired,
    url,
  }
}

function mergeRouteResults(desktop, mobile) {
  const mergedConsole = [...(desktop.consoleErrors ?? []), ...(mobile.consoleErrors ?? [])]
  const mergedNetwork = [...(desktop.failedRequests ?? []), ...(mobile.failedRequests ?? [])]
  const visibleProblems = [...new Set([...(desktop.visibleProblems ?? []), ...(mobile.visibleProblems ?? [])])]
  const visibleSnippets = [...new Set([...(desktop.visibleSnippets ?? []), ...(mobile.visibleSnippets ?? [])])]
  const status =
    desktop.status === 'error' || mobile.status === 'error'
      ? 'error'
      : desktop.loginRequired || mobile.loginRequired
        ? 'login-wall'
        : visibleProblems.length || mergedNetwork.length || mergedConsole.length
          ? 'warn'
          : 'ok'
  return makeRouteRecord({
    route: desktop.route ?? mobile.route,
    status,
    screenshotDesktop: desktop.screenshot,
    screenshotMobile: mobile.screenshot,
    visibleProblems,
    visibleSnippets,
    consoleErrors: mergedConsole,
    failedRequests: mergedNetwork,
    error: desktop.error || mobile.error,
    loginRequired: desktop.loginRequired || mobile.loginRequired,
  })
}

function captureLoggedOut(browser, allConsole, allNetwork, routes) {
  return ( async () => {
    for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
      const ctx = await browser.newContext({
        baseURL: BASE_URL,
        viewport: { width: vp.width, height: vp.height },
      })
      const page = await ctx.newPage()
      const route = '/'
      attachListeners(page, route, vpName, allConsole, allNetwork)
      const shot = join(SCREENSHOTS_DIR, `logged-out-${vpName}.png`)
      try {
        await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await waitForStable(page)
        await page.screenshot({ path: shot, fullPage: true })
        const bodyText = await page.locator('body').innerText().catch(async () => '')
        routes.push(
          routeRecordForViewport(allConsole, allNetwork, route, vpName, bodyText, page.url(), 'ok', shot, null),
        )
      } catch (err) {
        routes.push(
          routeRecordForViewport(allConsole, allNetwork, route, vpName, '', page.url(), 'error', shot, String(err)),
        )
      }
      await ctx.close()
    }
  })()
}

function captureRoute(browser, allConsole, allNetwork, storageState, routePath) {
  return ( async () => {
    const slug = slugifyRoute(routePath)
    const desktopCtx = await browser.newContext({
      baseURL: BASE_URL,
      viewport: VIEWPORTS.desktop,
      storageState,
    })
    const mobileCtx = await browser.newContext({
      baseURL: BASE_URL,
      viewport: VIEWPORTS.mobile,
      storageState,
    })

    const results = { desktop: {}, mobile: {} }

    for (const [vpName, ctx] of [
      ['desktop', desktopCtx],
      ['mobile', mobileCtx],
    ]) {
      const page = await ctx.newPage()
      attachListeners(page, routePath, vpName, allConsole, allNetwork)
      const shot = screenshotPath(slug, vpName)
      try {
        await page.goto(routePath, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await waitForStable(page)
        await page.screenshot({ path: shot, fullPage: true })
        const bodyText = await page.locator('body').innerText().catch(async () => '')
        results[vpName] = routeRecordForViewport(
          allConsole,
          allNetwork,
          routePath,
          vpName,
          bodyText,
          page.url(),
          'ok',
          shot,
          null,
        )
      } catch (err) {
        results[vpName] = routeRecordForViewport(
          allConsole,
          allNetwork,
          routePath,
          vpName,
          '',
          page.url(),
          'error',
          shot,
          err instanceof Error ? err.message : String(err),
        )
        await page.screenshot({ path: shot, fullPage: true }).catch(async () => {})
      }
      await page.close()
    }

    await desktopCtx.close()
    await mobileCtx.close()

    const merged = mergeRouteResults(
      { ...results.desktop, route: routePath },
      { ...results.mobile, route: routePath },
    )
    merged.route = routePath
    return merged
  })()
}

function tryFileUpload(page, fileInput, fixturePath) {
  return ( async () => {
    const count = await fileInput.count()
    if (count === 0) return { ok: false, detail: 'No file input found' }
    const input = fileInput.first()
    await input.setInputFiles(fixturePath)
    await page.waitForTimeout(2500)
    const bodyText = await page.locator('body').innerText().catch(async () => '')
    const failed = /upload failed|could not upload|error uploading/i.test(bodyText)
    return { ok: !failed, detail: failed ? 'Upload error visible in UI' : 'File accepted (no immediate error)' }
  })()
}

function testUploads(browser, storageState, fixturePath) {
  return ( async () => {
    const ctx = await browser.newContext({ baseURL: BASE_URL, storageState, viewport: VIEWPORTS.desktop })
    const page = await ctx.newPage()
    const tests = []

    /** Avatar / profile photo */
    {
      const name = 'avatar-upload'
      let reachable = false
      let status = 'skipped'
      let detail = ''
      let screenshot = null
      try {
        await page.goto('/profile/edit', { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await waitForStable(page)
        reachable = true
        screenshot = join(SCREENSHOTS_DIR, 'upload-avatar.png')
        await page.screenshot({ path: screenshot, fullPage: false })
        const fileInput = page.locator('input[type="file"][accept*="image"]')
        const result = await tryFileUpload(page, fileInput, fixturePath)
        status = result.ok ? 'ok' : 'failed'
        detail = result.detail
        await page.screenshot({ path: join(SCREENSHOTS_DIR, 'upload-avatar-after.png'), fullPage: false }).catch(async () => {})
      } catch (err) {
        status = 'error'
        detail = err instanceof Error ? err.message : String(err)
      }
      tests.push({ name, reachable, status, detail, screenshot })
    }

    /** Banner — same basics panel may only have avatar */
    {
      const name = 'banner-upload'
      let reachable = false
      let status = 'skipped'
      let detail = 'No dedicated banner file input on /profile/edit'
      let screenshot = null
      try {
        await page.goto('/profile/edit', { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await waitForStable(page)
        reachable = true
        screenshot = join(SCREENSHOTS_DIR, 'upload-banner.png')
        await page.screenshot({ path: screenshot, fullPage: false })
        const bannerInput = page.getByLabel(/banner|cover photo|header photo/i).locator('..').locator('input[type="file"]')
        if ((await bannerInput.count()) > 0) {
          const result = await tryFileUpload(page, bannerInput, fixturePath)
          status = result.ok ? 'ok' : 'failed'
          detail = result.detail
        } else {
          status = 'not-supported'
        }
      } catch (err) {
        status = 'error'
        detail = err instanceof Error ? err.message : String(err)
      }
      tests.push({ name, reachable, status, detail, screenshot })
    }

    /** Group image — create modal has no upload; check group settings if reachable */
    {
      const name = 'group-image-upload'
      let reachable = false
      let status = 'skipped'
      let detail = 'Create-group flow has no image field; checking not attempted'
      let screenshot = null
      try {
        await page.goto('/groups?create=group', { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await waitForStable(page)
        reachable = await page.getByRole('dialog').isVisible().catch(async () => false)
        screenshot = join(SCREENSHOTS_DIR, 'upload-group.png')
        await page.screenshot({ path: screenshot, fullPage: true })
        const fileInput = page.locator('[role="dialog"] input[type="file"], input[type="file"][accept*="image"]')
        if ((await fileInput.count()) > 0) {
          const result = await tryFileUpload(page, fileInput, fixturePath)
          status = result.ok ? 'ok' : 'failed'
          detail = result.detail
        } else {
          status = 'not-in-create-flow'
        }
      } catch (err) {
        status = 'error'
        detail = err instanceof Error ? err.message : String(err)
      }
      tests.push({ name, reachable, status, detail, screenshot })
    }

    /** Organization image */
    {
      const name = 'organization-image-upload'
      let reachable = false
      let status = 'skipped'
      let detail = ''
      let screenshot = null
      try {
        await page.goto('/orgs/new', { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await waitForStable(page)
        reachable = !isLoginWall(await page.locator('body').innerText(), page.url())
        screenshot = join(SCREENSHOTS_DIR, 'upload-org.png')
        await page.screenshot({ path: screenshot, fullPage: true })
        const fileInput = page.locator('input[type="file"][accept*="image"]')
        if ((await fileInput.count()) > 0) {
          const result = await tryFileUpload(page, fileInput, fixturePath)
          status = result.ok ? 'ok' : 'failed'
          detail = result.detail
        } else {
          status = 'not-in-create-flow'
          detail = 'No image input on org create page'
        }
      } catch (err) {
        status = 'error'
        detail = err instanceof Error ? err.message : String(err)
      }
      tests.push({ name, reachable, status, detail, screenshot })
    }

    /** Event cover */
    {
      const name = 'event-image-upload'
      let reachable = false
      let status = 'skipped'
      let detail = ''
      let screenshot = null
      try {
        await page.goto('/events?create=event', { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await waitForStable(page)
        reachable = await page.getByRole('dialog').isVisible().catch(async () => false)
        screenshot = join(SCREENSHOTS_DIR, 'upload-event.png')
        await page.screenshot({ path: screenshot, fullPage: true })
        const fileInput = page.locator('[role="dialog"] input[type="file"], input[type="file"][accept*="image"]')
        if ((await fileInput.count()) > 0) {
          const result = await tryFileUpload(page, fileInput, fixturePath)
          status = result.ok ? 'ok' : 'failed'
          detail = result.detail
        } else {
          status = 'not-in-create-flow'
          detail = 'No cover photo input visible in create-event modal'
        }
      } catch (err) {
        status = 'error'
        detail = err instanceof Error ? err.message : String(err)
      }
      tests.push({ name, reachable, status, detail, screenshot })
    }

    await ctx.close()
    return tests
  })()
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ])
}

function testFeedPost(browser, storageState) {
  return withTimeout(
    (async () => {
    const ctx = await browser.newContext({ baseURL: BASE_URL, storageState, viewport: VIEWPORTS.desktop })
    const page = await ctx.newPage()
    page.setDefaultTimeout(20_000)
    const result = { reachable: false, status: 'skipped', detail: '' }
    try {
      await page.goto('/home?tab=Local#home-feed-composer', {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      })
      await waitForStable(page)
      result.reachable = true
      const composer = page.locator('#home-feed-composer')
      if ((await composer.count()) === 0) {
        result.status = 'not-found'
        result.detail = 'Feed composer not found on /home'
        await ctx.close()
        return result
      }
      await composer.scrollIntoViewIfNeeded().catch(async () => {})
      const textarea = composer.locator('textarea').first()
      if ((await textarea.count()) === 0) {
        result.status = 'not-found'
        result.detail = 'Composer textarea missing'
        await ctx.close()
        return result
      }
      const stamp = `Emergency audit ${Date.now()}`
      await textarea.fill(stamp)
      const postBtn = composer.getByRole('button', { name: /post|share|publish/i }).first()
      if ((await postBtn.count()) === 0) {
        result.status = 'not-found'
        result.detail = 'Post button not found'
        await ctx.close()
        return result
      }
      await postBtn.click()
      await page.waitForTimeout(3000)
      const bodyText = await page.locator('body').innerText()
      const posted = bodyText.includes(stamp) || /posted|published|success/i.test(bodyText)
      result.status = posted ? 'ok' : 'unknown'
      result.detail = posted ? 'Post text appeared or success message shown' : 'Could not confirm post appeared'
      await page.screenshot({ path: join(SCREENSHOTS_DIR, 'feed-post-test.png'), fullPage: false })
    } catch (err) {
      result.status = 'error'
      result.detail = err instanceof Error ? err.message : String(err)
    }
    await ctx.close()
    return result
  })(),
    45_000,
    'Feed post test',
  )
}

function main() {
  return ( async () => {
    console.log(`Emergency alpha audit → ${BASE_URL}`)
    ensureDirs()
    const fixturePath = ensureDirs()
    const runId = runTimestamp()

    const allConsole = []
    const allNetwork = []
    const routeResults = []
    const loginMeta = { apiOk: false, uiOk: false, detail: '' }

    const browser = await chromium.launch({ headless: true })

    /** Preflight */
    const preflight = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(30_000) }).catch(
      (err) => ({ ok: false, status: 0, err: String(err) }),
    )
    if (!preflight.ok) {
      console.error(`Cannot reach ${BASE_URL}: ${preflight.err ?? preflight.status}`)
      process.exit(1)
    }
    console.log(`Site reachable (HTTP ${preflight.status})`)

    /** Logged-out captures */
    console.log('Capturing logged-out state…')
    await captureLoggedOut(browser, allConsole, allNetwork, routeResults)

    /** Login page captures (before auth) */
    console.log('Capturing login page…')
    for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
      const ctx = await browser.newContext({
        baseURL: BASE_URL,
        viewport: { width: vp.width, height: vp.height },
      })
      const page = await ctx.newPage()
      attachListeners(page, '/?login=1', vpName, allConsole, allNetwork)
      const shot = join(SCREENSHOTS_DIR, `login-page-${vpName}.png`)
      try {
        await page.goto('/?login=1', { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await waitForStable(page)
        await page.screenshot({ path: shot, fullPage: true })
      } catch {
        await page.screenshot({ path: shot, fullPage: true }).catch(() => {})
      }
      await ctx.close()
    }

    /** Login */
    console.log('Logging in…')
    const authCtx = await browser.newContext({ baseURL: BASE_URL, viewport: VIEWPORTS.desktop })
    const authPage = await authCtx.newPage()

    const apiLogin = await loginViaApi(authPage.request, USERNAME, PASSWORD)
    loginMeta.apiOk = apiLogin.ok
    loginMeta.detail = apiLogin.ok ? `session ${apiLogin.status}` : JSON.stringify(redactSecrets(apiLogin.body))

    let storageState = null
    if (apiLogin.ok) {
      loginMeta.uiOk = true
      storageState = await authCtx.storageState()
      console.log(`API login OK (${USERNAME})`)
    } else {
      console.log('API login failed — trying UI login…')
      const uiLogin = await loginViaUi(authPage, USERNAME, PASSWORD)
      loginMeta.uiOk = uiLogin.ok
      loginMeta.detail = uiLogin.ok ? `UI login as ${uiLogin.detail}` : `UI login failed; API: ${loginMeta.detail}`
      if (uiLogin.ok) {
        storageState = await authCtx.storageState()
      }
    }

    let uploadTests = []
    let feedPostTest = { status: 'skipped', reachable: false, detail: 'Login failed' }

    const loginSucceeded = loginMeta.apiOk || loginMeta.uiOk
    if (!loginSucceeded) {
      console.error('Login failed — continuing with logged-out evidence only')
      await authCtx.close()
    } else {
      /** Discover routes */
      await authPage.goto('/home', { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await waitForStable(authPage)
      const navRoutes = await discoverRoutesFromNav(authPage)
      const profileRoutes = await discoverProfileMenuRoutes(authPage)
      await authCtx.close()

      const allRoutes = uniquePaths([...SEED_LOGGED_IN_ROUTES, ...navRoutes, ...profileRoutes])
      console.log(`Visiting ${allRoutes.length} logged-in routes…`)

      for (const routePath of allRoutes) {
        process.stdout.write(`  ${routePath}… `)
        try {
          const rec = await captureRoute(browser, allConsole, allNetwork, storageState, routePath)
          routeResults.push(rec)
          console.log(rec.status)
        } catch (err) {
          routeResults.push(
            makeRouteRecord({
              route: routePath,
              status: 'error',
              screenshotDesktop: null,
              screenshotMobile: null,
              visibleProblems: [],
              visibleSnippets: [],
              consoleErrors: [],
              failedRequests: [],
              error: err instanceof Error ? err.message : String(err),
              loginRequired: false,
            }),
          )
          console.log('FAIL')
        }
      }

      /** Upload + feed tests */
      console.log('Running upload tests…')
      uploadTests = await testUploads(browser, storageState, fixturePath)
      console.log('Running feed post test…')
      feedPostTest = await testFeedPost(browser, storageState)
    }

    await browser.close()

    /** Normalize logged-out into single route row */
    const loggedOutDesktop = routeResults.find((r) => r.viewport === 'desktop' && r.route === '/')
    const loggedOutMobile = routeResults.find((r) => r.viewport === 'mobile' && r.route === '/')
    const filteredRoutes = routeResults.filter((r) => !r.viewport)
    if (loggedOutDesktop && loggedOutMobile) {
      filteredRoutes.unshift(
        mergeRouteResults(
          { ...loggedOutDesktop, route: '/' },
          { ...loggedOutMobile, route: '/' },
        ),
      )
    } else if (loggedOutDesktop || loggedOutMobile) {
      const one = loggedOutDesktop ?? loggedOutMobile
      filteredRoutes.unshift(
        makeRouteRecord({
          route: '/',
          status: one.status,
          screenshotDesktop: loggedOutDesktop?.screenshot ?? null,
          screenshotMobile: loggedOutMobile?.screenshot ?? null,
          visibleProblems: one.visibleProblems ?? [],
          visibleSnippets: one.visibleSnippets ?? [],
          consoleErrors: one.consoleErrors ?? [],
          failedRequests: one.failedRequests ?? [],
          error: one.error,
          loginRequired: false,
        }),
      )
    }

    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      username: USERNAME,
      loginSucceeded,
      login: loginMeta,
      routes: filteredRoutes.map((r) => deepRedact(r)),
      uploadTests: uploadTests,
      feedPostTest: feedPostTest,
      summary: summarizeRoutes(filteredRoutes),
      allConsoleErrors: allConsole.map((e) => ({ ...e, message: redactSecrets(e.message) })),
      allNetworkFailures: allNetwork.map((e) => ({ ...e, url: redactSecrets(e.url) })),
    }

    const jsonPath = join(REPORTS_DIR, 'emergency-alpha-audit.json')
    const mdPath = join(REPORTS_DIR, 'emergency-alpha-audit.md')
    writeFileSync(jsonPath, JSON.stringify(report, null, 2))
    writeFileSync(mdPath, generateMarkdownReport(report))

    const bundle = bundleForUpload(runId, report)
    printReportSummary(report, bundle)
    process.exitCode = report.summary.launchBlockers > 0 || !loginSucceeded ? 1 : 0
  })()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
