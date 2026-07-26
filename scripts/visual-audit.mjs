#!/usr/bin/env node
/**
 * Full visual audit screenshot system for deployed Kink Social / C2K web app.
 * See docs/VISUAL_AUDIT.md
 */
import { mkdirSync, readFileSync, writeFileSync, symlinkSync, rmSync, cpSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

const VIEWPORTS = [
  { id: 'mobile', width: 390, height: 844 },
  { id: 'tablet', width: 768, height: 1024 },
  { id: 'desktop', width: 1440, height: 1000 },
]

const ROLE_DEFS = {
  member: {
    label: 'member',
    emailEnvs: ['VISUAL_AUDIT_MEMBER_EMAIL', 'VISUAL_AUDIT_EMAIL'],
    passwordEnvs: ['VISUAL_AUDIT_MEMBER_PASSWORD', 'VISUAL_AUDIT_PASSWORD'],
  },
  onboarding_member: {
    label: 'onboarding_member',
    emailEnvs: ['VISUAL_AUDIT_ONBOARDING_EMAIL'],
    passwordEnvs: ['VISUAL_AUDIT_ONBOARDING_PASSWORD'],
    defaultEmail: 'OnboardingFresh',
    defaultPasswordFrom: 'member',
  },
  org_owner: {
    label: 'org_owner',
    emailEnvs: ['VISUAL_AUDIT_ORG_OWNER_EMAIL'],
    passwordEnvs: ['VISUAL_AUDIT_ORG_OWNER_PASSWORD'],
  },
  vendor: {
    label: 'vendor',
    emailEnvs: ['VISUAL_AUDIT_VENDOR_EMAIL'],
    passwordEnvs: ['VISUAL_AUDIT_VENDOR_PASSWORD'],
  },
  presenter: {
    label: 'presenter',
    emailEnvs: ['VISUAL_AUDIT_PRESENTER_EMAIL'],
    passwordEnvs: ['VISUAL_AUDIT_PRESENTER_PASSWORD'],
  },
  admin: {
    label: 'admin',
    emailEnvs: ['VISUAL_AUDIT_ADMIN_EMAIL'],
    passwordEnvs: ['VISUAL_AUDIT_ADMIN_PASSWORD'],
  },
}

function envFirst(keys) {
  for (const key of keys) {
    const v = process.env[key]?.trim()
    if (v) return v
  }
  return null
}

function timestampFolder() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

function loadRoutesConfig() {
  const raw = readFileSync(join(REPO_ROOT, 'visual-audit-routes.json'), 'utf8')
  return JSON.parse(raw)
}

function resolvePlaceholders(template, values) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    const v = values[key]
    if (!v) throw new Error(`Missing placeholder {${key}}`)
    return String(v)
  })
}

function configuredRoles() {
  const roles = {}
  for (const [role, def] of Object.entries(ROLE_DEFS)) {
    let email = envFirst(def.emailEnvs)
    let password = envFirst(def.passwordEnvs)
    if (!email && def.defaultEmail) email = def.defaultEmail
    if (!password && def.defaultPasswordFrom === 'member') {
      password = envFirst(ROLE_DEFS.member.passwordEnvs)
    }
    if (email && password) roles[role] = { email, password, label: def.label }
  }
  return roles
}

function memberOnlyMode(roles) {
  const keys = Object.keys(roles).filter((k) => k !== 'onboarding_member')
  return keys.length === 1 && keys[0] === 'member'
}

const CONNECTION_REFUSED_RE = /ERR_CONNECTION_REFUSED|ECONNREFUSED|connect ECONNREFUSED/i

function parseBaseUrl(baseUrl) {
  try {
    return new URL(baseUrl)
  } catch {
    return new URL('http://127.0.0.1:5173')
  }
}

/** Fail fast when the dev server or API proxy is down. */
async function assertServerHealthy(baseUrl, label = 'preflight') {
  const parsed = parseBaseUrl(baseUrl)
  const checks = [
    { name: 'web', url: `${baseUrl}/` },
    { name: 'api-registration-policy', url: `${baseUrl}/api/auth/registration-policy` },
  ]
  const results = []
  for (const check of checks) {
    const started = Date.now()
    try {
      const res = await fetch(check.url, { signal: AbortSignal.timeout(8_000) })
      results.push({ ...check, ok: res.ok, status: res.status, ms: Date.now() - started })
      if (!res.ok) {
        throw new Error(
          `${label}: ${check.name} unhealthy — ${check.url} returned HTTP ${res.status} (host ${parsed.host})`
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (CONNECTION_REFUSED_RE.test(message) || err?.name === 'TimeoutError') {
        throw new Error(
          `${label}: dev server unavailable at ${baseUrl} (${parsed.host}). ${message}. Aborting audit — restart a single dev server and rerun.`
        )
      }
      throw err
    }
  }
  return { host: parsed.host, port: parsed.port || (parsed.protocol === 'https:' ? '443' : '80'), checks: results }
}

function isConnectionRefusedError(err) {
  const message = err instanceof Error ? err.message : String(err)
  return CONNECTION_REFUSED_RE.test(message)
}

/** Authenticated/onboarding routes must not fall back to the public landing shell. */
async function assertRouteAuthState(page, route, baseUrl) {
  if (!route.authRole) return { ok: true }

  const pathname = new URL(page.url()).pathname
  const bodyText = await page.locator('body').innerText().catch(() => '')
  const signedOutLanding =
    pathname === '/' &&
    (/previewing public community pages/i.test(bodyText) ||
      /join the community/i.test(bodyText) ||
      /create an account/i.test(bodyText))

  if (signedOutLanding) {
    return {
      ok: false,
      reason: 'Rendered public landing instead of authenticated route',
      pathname,
    }
  }

  if (route.category === 'onboarding') {
    const onOnboardingPath =
      pathname.startsWith('/onboarding') ||
      pathname.startsWith('/profile/edit') ||
      pathname.startsWith('/vendors/onboarding') ||
      pathname.startsWith('/presenters/onboarding')
    if (!onOnboardingPath) {
      return {
        ok: false,
        reason: 'Onboarding route left onboarding flow',
        pathname,
      }
    }
  }

  try {
    const sessionRes = await page.request.get('/api/auth/session')
    if (!sessionRes.ok()) {
      return {
        ok: false,
        reason: `/api/auth/session returned HTTP ${sessionRes.status()}`,
        pathname,
      }
    }
    const session = await sessionRes.json()
    if (!session?.authenticated) {
      return {
        ok: false,
        reason: 'Session API reports signed out',
        pathname,
      }
    }
  } catch (err) {
    if (isConnectionRefusedError(err)) throw err
    return {
      ok: false,
      reason: `Session check failed: ${err instanceof Error ? err.message : String(err)}`,
      pathname,
    }
  }

  return { ok: true, pathname }
}

function routeAllowedForRoles(route, roles, memberOnly) {
  const authRole = route.authRole
  if (!authRole) return true
  if (memberOnly && authRole !== 'member') return false
  return Boolean(roles[authRole])
}

function pickContextRole(route, roles, memberOnly) {
  if (!route.authRole) return null
  if (memberOnly) return 'member'
  if (roles[route.authRole]) return route.authRole
  if (route.authRole === 'member' && roles.member) return 'member'
  return null
}

async function loginViaUi(page, email, password) {
  await page.goto('/?login=1', { waitUntil: 'domcontentloaded' })
  const loginTab = page.getByRole('button', { name: /^login$/i }).first()
  if (await loginTab.isVisible().catch(() => false)) {
    await loginTab.click()
  }
  const loginForm = page
    .locator('form')
    .filter({ has: page.locator('a[href="/forgot-password"]') })
    .first()
  await loginForm.locator('input[name="username"]').fill(email)
  await loginForm.locator('input[name="password"]').fill(password)
  await loginForm.getByRole('button', { name: /^login$/i }).click()
  await page.waitForURL((url) => !url.search.includes('login=1'), { timeout: 30_000 }).catch(() => {})
  const me = await page.request.get('/api/auth/me')
  if (!me.ok()) return false
  const body = await me.json()
  return body?.viewer?.authenticated === true
}

async function loginViaApi(request, email, password) {
  const res = await request.post('/api/auth/session', {
    headers: { 'Content-Type': 'application/json' },
    data: { username: email, password },
  })
  return res.ok()
}

async function ensureRoleStorage(browser, baseUrl, role, creds, authDir) {
  const statePath = join(authDir, `${role}.json`)
  const context = await browser.newContext({ baseURL: baseUrl })
  const page = await context.newPage()
  let ok = await loginViaApi(page.request, creds.email, creds.password)
  if (ok) {
    await page.goto('/home', { waitUntil: 'domcontentloaded' })
  } else {
    try {
      ok = await loginViaUi(page, creds.email, creds.password)
    } catch {
      ok = false
    }
  }
  if (!ok) {
    await context.close()
    throw new Error(`Login failed for role "${role}"`)
  }
  await context.storageState({ path: statePath })
  await context.close()
  return statePath
}

async function discoverPlaceholders(request, roles, config, memberOnly) {
  const phConfig = config.placeholders ?? {}
  const values = {}
  for (const [key, spec] of Object.entries(phConfig)) {
    const fromEnv = spec.env ? process.env[spec.env]?.trim() : null
    if (fromEnv) {
      values[key] = fromEnv
      continue
    }
    if (spec.default) values[key] = spec.default
  }

  const authed = roles.member ?? Object.values(roles)[0]
  if (authed) {
    await loginViaApi(request, authed.email, authed.password)
  }

  if (!values.eventId && phConfig.eventId?.resolve === 'event') {
    const r = await request.get('/api/v1/events?limit=1')
    if (r.ok()) {
      const data = await r.json()
      const id = data?.items?.[0]?.id ?? data?.events?.[0]?.id
      if (id) values.eventId = String(id)
    }
  }

  if (!values.groupId && phConfig.groupId?.resolve === 'group') {
    const r = await request.get('/api/v1/me/groups')
    if (r.ok()) {
      const data = await r.json()
      const id = data?.items?.[0]?.id ?? data?.groups?.[0]?.id
      if (id) values.groupId = String(id)
    }
  }

  if (!values.vendorSlug) {
    const r = await request.get('/api/v1/vendors?limit=1')
    if (r.ok()) {
      const data = await r.json()
      const slug = data?.items?.[0]?.slug ?? data?.vendors?.[0]?.slug
      if (slug) values.vendorSlug = String(slug)
    }
  }

  if (!values.presenterUsername) {
    const r = await request.get('/api/v1/presenters?limit=1')
    if (r.ok()) {
      const data = await r.json()
      const u = data?.items?.[0]?.username ?? data?.presenters?.[0]?.username
      if (u) values.presenterUsername = String(u)
    }
  }

  if (!memberOnly && roles.admin && !values.moderationCaseId && phConfig.moderationCaseId?.resolve === 'moderationCase') {
    await loginViaApi(request, roles.admin.email, roles.admin.password)
    const r = await request.get('/api/v1/moderation/cases?limit=1')
    if (r.ok()) {
      const data = await r.json()
      const id = data?.items?.[0]?.id ?? data?.cases?.[0]?.id
      if (id) values.moderationCaseId = String(id)
    }
  }

  if (authed) {
    await request.post('/api/auth/logout').catch(() => {})
  }

  return values
}

function routeNeedsPlaceholders(path) {
  return /\{[a-zA-Z0-9_]+\}/.test(path)
}

function expandRoute(route, placeholderValues) {
  if (!routeNeedsPlaceholders(route.path)) {
    return { ...route, resolvedPath: route.path }
  }
  try {
    const resolvedPath = resolvePlaceholders(route.path, placeholderValues)
    return { ...route, resolvedPath }
  } catch (err) {
    return { ...route, resolvedPath: null, resolveError: err.message }
  }
}

async function waitForAppReady(page) {
  await page.waitForLoadState('domcontentloaded')
  try {
    await page.waitForLoadState('networkidle', { timeout: 12_000 })
  } catch {
    /* SPA may keep polling */
  }
  await page.locator('main, [role="main"], h1, body').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
  await page.waitForTimeout(500)
}

async function collectPageMetrics(page, mainResponse) {
  return page.evaluate((respStatus) => {
    const doc = document.documentElement
    const h1s = [...document.querySelectorAll('h1')]
    const headings = h1s.slice(0, 5).map((el) => (el.textContent ?? '').trim().slice(0, 120))

    const buttons = document.querySelectorAll('button, [role="button"]')
    let buttonsWithoutText = 0
    buttons.forEach((btn) => {
      const label = (btn.getAttribute('aria-label') ?? btn.textContent ?? '').trim()
      if (!label) buttonsWithoutText += 1
    })

    const images = [...document.querySelectorAll('img')]
    let imagesMissingAlt = 0
    images.forEach((img) => {
      const alt = img.getAttribute('alt')
      const decorative = img.getAttribute('role') === 'presentation' || img.getAttribute('aria-hidden') === 'true'
      if (!decorative && (alt === null || alt === '')) imagesMissingAlt += 1
    })

    const inputs = [...document.querySelectorAll('input, textarea, select')]
    let inputsWithoutLabels = 0
    inputs.forEach((input) => {
      const id = input.id
      const aria = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby')
      const labelled = id && document.querySelector(`label[for="${CSS.escape(id)}"]`)
      if (!aria && !labelled) inputsWithoutLabels += 1
    })

    const robotsMeta = document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null

    return {
      pageTitle: document.title,
      documentHeight: doc.scrollHeight,
      horizontalOverflow: doc.scrollWidth > doc.clientWidth,
      largestHeadings: headings,
      h1Count: h1s.length,
      buttonCount: buttons.length,
      linkCount: document.querySelectorAll('a[href]').length,
      inputCount: inputs.length,
      noindexMeta: robotsMeta,
      responseStatus: respStatus,
      accessibility: {
        missingH1: h1s.length === 0,
        multipleH1: h1s.length > 1,
        buttonsWithoutAccessibleText: buttonsWithoutText,
        imagesWithoutAlt: imagesMissingAlt,
        inputsWithoutLabels: inputsWithoutLabels,
      },
    }
  }, mainResponse?.status() ?? null)
}

function sanitizeForLog(obj) {
  const json = JSON.stringify(obj)
  const secrets = [
    process.env.VISUAL_AUDIT_PASSWORD,
    process.env.VISUAL_AUDIT_MEMBER_PASSWORD,
    process.env.VISUAL_AUDIT_ORG_OWNER_PASSWORD,
    process.env.VISUAL_AUDIT_VENDOR_PASSWORD,
    process.env.VISUAL_AUDIT_PRESENTER_PASSWORD,
    process.env.VISUAL_AUDIT_ADMIN_PASSWORD,
  ].filter(Boolean)
  let out = json
  for (const s of secrets) {
    out = out.split(s).join('[REDACTED]')
  }
  return JSON.parse(out)
}

function generateRouteIndexHtml(captures, outputDir) {
  const byRoute = new Map()
  for (const cap of captures) {
    if (!cap.screenshotPath) continue
    const list = byRoute.get(cap.routeId) ?? []
    list.push(cap)
    byRoute.set(cap.routeId, list)
  }

  const sections = [...byRoute.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([routeId, items]) => {
      const sorted = [...items].sort((a, b) => a.viewport.localeCompare(b.viewport))
      const cards = sorted
        .map((cap) => {
          const rel = relative(outputDir, cap.screenshotPath).replace(/\\/g, '/')
          return `<figure class="shot"><img src="${rel}" alt="${routeId} ${cap.viewport}" loading="lazy" /><figcaption><strong>${cap.viewport}</strong> — ${cap.url}${cap.failed ? ' <em>(failed)</em>' : ''}</figcaption></figure>`
        })
        .join('\n')
      const meta = sorted[0]
      return `<section class="route"><h2>${routeId}</h2><p class="meta">${meta.category} · ${meta.resolvedPath ?? meta.path}</p><div class="grid">${cards}</div></section>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Visual audit — route index</title>
  <style>
    :root { font-family: system-ui, sans-serif; color: #111; background: #f6f6f8; }
    body { margin: 0; padding: 1.5rem; }
    h1 { font-size: 1.35rem; margin: 0 0 0.5rem; }
    .intro { color: #444; margin-bottom: 1.5rem; max-width: 70ch; }
    .route { background: #fff; border: 1px solid #ddd; border-radius: 10px; padding: 1rem; margin-bottom: 1.25rem; }
    .route h2 { margin: 0 0 0.25rem; font-size: 1.05rem; }
    .meta { margin: 0 0 0.75rem; color: #666; font-size: 0.85rem; }
    .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
    .shot { margin: 0; }
    .shot img { width: 100%; height: auto; border: 1px solid #ccc; border-radius: 6px; background: #eee; }
    figcaption { font-size: 0.75rem; color: #555; margin-top: 0.35rem; word-break: break-all; }
  </style>
</head>
<body>
  <h1>Visual audit — route index</h1>
  <p class="intro">Generated locally. Open this file in a browser to review screenshots grouped by route and viewport.</p>
  ${sections || '<p>No screenshots captured.</p>'}
</body>
</html>`
}

async function captureRoute({
  browser,
  baseUrl,
  route,
  viewport,
  role,
  storageStatePath,
  outputDir,
  consoleErrors,
  networkErrors,
  failures,
  captures,
  xRobotsTag,
}) {
  const contextOptions = { baseURL: baseUrl, viewport: { width: viewport.width, height: viewport.height } }
  if (storageStatePath) contextOptions.storageState = storageStatePath

  const context = await browser.newContext(contextOptions)
  const page = await context.newPage()

  const routeConsole = []
  const routeNetwork = []
  let mainResponse = null

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const entry = { routeId: route.id, viewport: viewport.id, url: page.url(), message: msg.text() }
      routeConsole.push(entry)
      consoleErrors.push(entry)
    }
  })

  page.on('response', (response) => {
    const url = response.url()
    const status = response.status()
    if (status >= 400 && (url.includes('/api/') || url === baseUrl || url.startsWith(baseUrl + '/'))) {
      const entry = { routeId: route.id, viewport: viewport.id, url, status, method: response.request().method() }
      routeNetwork.push(entry)
      networkErrors.push(entry)
    }
    if (response.request().isNavigationRequest() && response.request().frame() === page.mainFrame()) {
      mainResponse = response
      const hdr = response.headers()['x-robots-tag']
      if (hdr) xRobotsTag.set(route.id, hdr)
    }
  })

  const screenshotDir = join(outputDir, 'screenshots', route.id)
  mkdirSync(screenshotDir, { recursive: true })
  const screenshotPath = join(screenshotDir, `${viewport.id}.png`)

  const captureRecord = {
    routeId: route.id,
    path: route.path,
    resolvedPath: route.resolvedPath,
    category: route.category,
    authRole: route.authRole,
    contextRole: role,
    viewport: viewport.id,
    viewportSize: { width: viewport.width, height: viewport.height },
    url: null,
    screenshotPath: null,
    failed: false,
    skipped: false,
  }

  try {
    if (!route.resolvedPath) {
      throw new Error(route.resolveError ?? 'Could not resolve route path')
    }

    const target = route.resolvedPath.startsWith('/') ? route.resolvedPath : `/${route.resolvedPath}`
    const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    if (!mainResponse && response) mainResponse = response

    await waitForAppReady(page)

    const metrics = await collectPageMetrics(page, mainResponse)
    captureRecord.url = page.url()
    captureRecord.pageTitle = metrics.pageTitle
    captureRecord.documentHeight = metrics.documentHeight
    captureRecord.horizontalOverflow = metrics.horizontalOverflow
    captureRecord.largestHeadings = metrics.largestHeadings
    captureRecord.h1Count = metrics.h1Count
    captureRecord.buttonCount = metrics.buttonCount
    captureRecord.linkCount = metrics.linkCount
    captureRecord.inputCount = metrics.inputCount
    captureRecord.noindexMeta = metrics.noindexMeta
    captureRecord.xRobotsTag = xRobotsTag.get(route.id) ?? null
    captureRecord.responseStatus = metrics.responseStatus
    captureRecord.accessibility = metrics.accessibility
    captureRecord.consoleErrorCount = routeConsole.length
    captureRecord.networkErrorCount = routeNetwork.length

    const authAssert = await assertRouteAuthState(page, route, baseUrl)
    captureRecord.authAssertion = authAssert
    if (!authAssert.ok) {
      throw new Error(authAssert.reason ?? 'Authenticated route assertion failed')
    }

    if (route.contentType === 'text') {
      const text = await page.locator('body').innerText().catch(() => '')
      captureRecord.textPreview = text.slice(0, 500)
      await page.screenshot({ path: screenshotPath, fullPage: false })
    } else {
      await page.screenshot({ path: screenshotPath, fullPage: true })
    }

    captureRecord.screenshotPath = screenshotPath
  } catch (err) {
    if (isConnectionRefusedError(err)) {
      err = new Error(
        `Dev server connection refused while capturing ${route.id} @ ${viewport.id}. Audit aborted to avoid blank screenshots.`
      )
      err.abortAudit = true
    }
    captureRecord.failed = true
    captureRecord.error = err instanceof Error ? err.message : String(err)
    failures.push({
      routeId: route.id,
      path: route.path,
      resolvedPath: route.resolvedPath,
      viewport: viewport.id,
      authRole: route.authRole,
      error: captureRecord.error,
      optional: route.optional === true,
    })
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {})
      captureRecord.screenshotPath = screenshotPath
    } catch {
      /* no partial screenshot */
    }
  } finally {
    captures.push(captureRecord)
    await context.close()
  }

  if (captureRecord.failed && captureRecord.error && isConnectionRefusedError({ message: captureRecord.error })) {
    const abortErr = new Error(captureRecord.error)
    abortErr.abortAudit = true
    throw abortErr
  }
}

async function main() {
  const baseUrl = (process.env.VISUAL_AUDIT_BASE_URL ?? 'http://127.0.0.1:5173').replace(/\/$/, '')
  const interactive = process.env.VISUAL_AUDIT_INTERACTIVE === 'true'

  if (interactive) {
    console.warn('VISUAL_AUDIT_INTERACTIVE=true — multi-step flows not implemented in this pass; capturing default states only.')
  }

  const config = loadRoutesConfig()
  const roles = configuredRoles()

  if (!roles.member) {
    console.error('Login required: set VISUAL_AUDIT_EMAIL + VISUAL_AUDIT_PASSWORD (or VISUAL_AUDIT_MEMBER_*).')
    process.exit(1)
  }

  const onlyMember = memberOnlyMode(roles)
  if (onlyMember) {
    console.log('Single account detected — capturing public + member-level routes only.')
  }

  const folderName = timestampFolder()
  const outputDir = join(REPO_ROOT, 'visual-audit-output', folderName)
  const screenshotsDir = join(outputDir, 'screenshots')
  const authDir = join(outputDir, '.auth')
  mkdirSync(screenshotsDir, { recursive: true })
  mkdirSync(authDir, { recursive: true })

  const health = await assertServerHealthy(baseUrl, 'startup')
  console.log(`Server healthy at ${baseUrl} (host ${health.host}, port ${health.port})`)

  const browser = await chromium.launch({ headless: true })

  const storageByRole = {}
  for (const [role, creds] of Object.entries(roles)) {
    console.log(`Signing in (${role})…`)
    storageByRole[role] = await ensureRoleStorage(browser, baseUrl, role, creds, authDir)
    console.log(`  saved storage state for ${role}`)
  }

  const bootstrap = await browser.newContext({ baseURL: baseUrl })
  const placeholderValues = await discoverPlaceholders(bootstrap.request, roles, config, onlyMember)
  await bootstrap.close()

  const expandedRoutes = []
  const seenRouteKeys = new Set()
  for (const route of config.routes) {
    if (!routeAllowedForRoles(route, roles, onlyMember)) continue
    const expanded = expandRoute(route, placeholderValues)
    const key = `${expanded.authRole ?? 'public'}:${expanded.resolvedPath ?? expanded.path}`
    if (seenRouteKeys.has(key)) continue
    seenRouteKeys.add(key)
    expandedRoutes.push(expanded)
  }

  const captures = []
  const failures = []
  const consoleErrors = []
  const networkErrors = []
  const xRobotsTag = new Map()

  console.log(`Capturing ${expandedRoutes.length} routes × ${VIEWPORTS.length} viewports against ${baseUrl}`)

  let lastHealthCheckRouteId = null
  try {
  for (const route of expandedRoutes) {
    if (lastHealthCheckRouteId !== route.id) {
      await assertServerHealthy(baseUrl, `before ${route.id}`)
      lastHealthCheckRouteId = route.id
    }
    if (route.optional && !route.resolvedPath) {
      failures.push({
        routeId: route.id,
        path: route.path,
        skipped: true,
        reason: route.resolveError ?? 'optional route — placeholder unavailable',
        optional: true,
      })
      continue
    }

    const role = pickContextRole(route, roles, onlyMember)
    const storageStatePath = role ? storageByRole[role] : null

    for (const viewport of VIEWPORTS) {
      process.stdout.write(`  ${route.id} @ ${viewport.id}… `)
      try {
        await captureRoute({
          browser,
          baseUrl,
          route,
          viewport,
          role,
          storageStatePath,
          outputDir,
          consoleErrors,
          networkErrors,
          failures,
          captures,
          xRobotsTag,
        })
        const last = captures[captures.length - 1]
        console.log(last.failed ? 'FAIL' : 'ok')
      } catch (err) {
        if (err?.abortAudit || isConnectionRefusedError(err)) {
          console.log('ABORT')
          failures.push({
            routeId: route.id,
            path: route.path,
            viewport: viewport.id,
            aborted: true,
            error: err instanceof Error ? err.message : String(err),
          })
          throw err
        }
        throw err
      }
    }
  }
  } finally {
    await browser.close()
  }

  const authAssertionFailures = captures.filter((c) => c.authAssertion && c.authAssertion.ok === false)

  const metadata = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    serverHealth: health,
    outputDir,
    viewports: VIEWPORTS,
    rolesConfigured: Object.keys(roles),
    memberOnlyMode: onlyMember,
    placeholderValues,
    routeCount: expandedRoutes.length,
    captureCount: captures.length,
    authAssertionFailureCount: authAssertionFailures.length,
    captures: captures.map((c) => sanitizeForLog(c)),
  }

  writeFileSync(join(outputDir, 'metadata.json'), JSON.stringify(metadata, null, 2))
  writeFileSync(join(outputDir, 'failures.json'), JSON.stringify(failures, null, 2))
  writeFileSync(join(outputDir, 'console-errors.json'), JSON.stringify(consoleErrors, null, 2))
  writeFileSync(join(outputDir, 'network-errors.json'), JSON.stringify(networkErrors, null, 2))
  writeFileSync(join(outputDir, 'route-index.html'), generateRouteIndexHtml(captures, outputDir))

  const latestLink = join(REPO_ROOT, 'visual-audit-output', 'latest')
  try {
    rmSync(latestLink, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
  try {
    symlinkSync(folderName, latestLink, 'dir')
  } catch {
    /* Windows without symlink perms — latest folder name is in log */
  }

  if (process.env.VISUAL_AUDIT_DESKTOP_COPY !== 'false') {
    const desktopDir = join(homedir(), 'Desktop', 'screenshot audit', folderName)
    mkdirSync(dirname(desktopDir), { recursive: true })
    cpSync(outputDir, desktopDir, { recursive: true })
    console.log(`  Desktop copy: ${desktopDir}`)
  }

  const failCount = failures.filter((f) => !f.skipped && !f.aborted).length
  const aborted = failures.some((f) => f.aborted)
  console.log(`\nDone — output: ${outputDir}`)
  console.log(`  route-index.html`)
  console.log(`  metadata.json (${captures.length} captures, ${failCount} failures)`)
  if (authAssertionFailures.length > 0) {
    console.error(`  ${authAssertionFailures.length} authenticated route(s) rendered signed-out or failed session checks`)
  }
  if (aborted) {
    console.error('  Audit aborted early — dev server became unavailable. Fix server stability and rerun.')
    process.exitCode = 1
  } else if (failCount > 0 || authAssertionFailures.length > 0) {
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err.message ?? err)
  if (err?.abortAudit || isConnectionRefusedError(err)) {
    console.error('Visual audit aborted — dev server unavailable. Restart one clean dev server and rerun.')
  }
  process.exit(1)
})
