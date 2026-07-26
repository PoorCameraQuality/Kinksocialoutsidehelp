#!/usr/bin/env node
/**
 * Mobile UX screenshot audit for kink.social — evidence only, no mutations.
 *
 * Usage (credentials via env only — never commit):
 *   KINK_SOCIAL_AUDIT_URL=https://kink.social
 *   KINK_SOCIAL_AUDIT_USER=alpha_social
 *   KINK_SOCIAL_AUDIT_PASS=***
 *   node scripts/audit/mobile-ux-screenshot-audit.mjs
 *
 * Optional: KINK_SOCIAL_AUDIT_CREDENTIALS_FILE=/path/to/file (KEY=VALUE lines)
 * Output: Desktop/kink-social-mobile-ux-audit-YYYY-MM-DD-HHMM/
 */
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  readdirSync,
  statSync,
  createWriteStream,
} from 'node:fs'
import { join, dirname, relative, basename } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { chromium, webkit } from '@playwright/test'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '../..')

const DEVICES = [
  { id: 'mobile-360', width: 360, height: 800, mobile: true },
  { id: 'mobile-390', width: 390, height: 844, mobile: true },
  { id: 'mobile-430', width: 430, height: 932, mobile: true },
  { id: 'tablet-768', width: 768, height: 1024, mobile: true },
  { id: 'desktop-1280', width: 1280, height: 900, mobile: false },
]

const WEBKIT_KEY_ROUTES = ['landing', 'home', 'events', 'event-detail', 'profile', 'messaging', 'settings-privacy']

function timestampFolder() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

function loadCredentials() {
  const file = process.env.KINK_SOCIAL_AUDIT_CREDENTIALS_FILE
  if (file && existsSync(file)) {
    const map = Object.fromEntries(
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .filter((l) => l.trim() && !l.trim().startsWith('#'))
        .map((l) => {
          const i = l.indexOf('=')
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
        }),
    )
    return {
      baseURL: (map.KINK_SOCIAL_AUDIT_URL ?? map.URL ?? 'https://kink.social').replace(/\/$/, ''),
      user: map.KINK_SOCIAL_AUDIT_USER ?? map.USER ?? '',
      pass: map.KINK_SOCIAL_AUDIT_PASS ?? map.PASS ?? '',
    }
  }
  return {
    baseURL: (process.env.KINK_SOCIAL_AUDIT_URL ?? 'https://kink.social').replace(/\/$/, ''),
    user: process.env.KINK_SOCIAL_AUDIT_USER ?? '',
    pass: process.env.KINK_SOCIAL_AUDIT_PASS ?? process.env.ALPHA_SOCIAL_SEED_PASSWORD ?? '',
  }
}

function outDir() {
  const stamp = timestampFolder()
  const dir = join(homedir(), 'Desktop', `kink-social-mobile-ux-audit-${stamp}`)
  mkdirSync(dir, { recursive: true })
  for (const d of DEVICES) {
    mkdirSync(join(dir, 'devices', d.id), { recursive: true })
  }
  mkdirSync(join(dir, 'contact-sheets'), { recursive: true })
  return dir
}

const manifest = []
const failures = []
const skippedMenus = []
const findings = []

function record(entry) {
  manifest.push(entry)
}

async function waitStable(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await page.waitForTimeout(800)
}

async function shot(page, opts) {
  const {
    outRoot,
    device,
    engine,
    routeSlug,
    stateName,
    signedIn,
    fileName,
    fullPage = false,
    notes = '',
    testDataOnly = true,
  } = opts
  const relDir = join('devices', device.id, routeSlug)
  mkdirSync(join(outRoot, relDir), { recursive: true })
  const relPath = join(relDir, fileName).replace(/\\/g, '/')
  const absPath = join(outRoot, relPath)
  try {
    await page.screenshot({ path: absPath, fullPage, type: 'png' })
    record({
      file: relPath,
      device: device.id,
      viewport: `${device.width}x${device.height}`,
      browser: engine,
      route: routeSlug,
      state: stateName,
      signedIn,
      testDataOnly,
      notes,
      timestamp: new Date().toISOString(),
    })
    return true
  } catch (err) {
    failures.push({ route: routeSlug, device: device.id, state: stateName, error: err.message })
    return false
  }
}

async function loginViaApi(request, baseURL, user, pass) {
  const res = await request.post(`${baseURL}/api/auth/session`, {
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ username: user, password: pass }),
  })
  return res.ok()
}

async function tryOpen(page, label, fn) {
  try {
    await fn()
    await page.waitForTimeout(400)
    return true
  } catch {
    skippedMenus.push(label)
    return false
  }
}

async function discoverUrls(page, baseURL) {
  const urls = { eventDetail: null, groupDetail: null, profilePath: '/profile' }
  try {
    await page.goto(`${baseURL}/events`, { waitUntil: 'domcontentloaded' })
    await waitStable(page)
    const eventLink = page.locator('a[href*="/events/"]').first()
    if (await eventLink.count()) {
      const href = await eventLink.getAttribute('href')
      if (href) urls.eventDetail = href.startsWith('http') ? href : `${baseURL}${href}`
    }
  } catch (e) {
    failures.push({ route: 'discover-events', error: e.message })
  }
  try {
    await page.goto(`${baseURL}/groups`, { waitUntil: 'domcontentloaded' })
    await waitStable(page)
    const groupLink = page.locator('a[href*="/groups/"]').first()
    if (await groupLink.count()) {
      const href = await groupLink.getAttribute('href')
      if (href && !href.endsWith('/groups')) urls.groupDetail = href.startsWith('http') ? href : `${baseURL}${href}`
    }
  } catch (e) {
    failures.push({ route: 'discover-groups', error: e.message })
  }
  return urls
}

async function capturePublicRoutes(page, ctx, outRoot, device, engine) {
  const base = { outRoot, device, engine, signedIn: false, testDataOnly: true }

  await page.goto(`${ctx.baseURL}/`, { waitUntil: 'domcontentloaded' })
  await waitStable(page)
  await shot(page, { ...base, routeSlug: 'landing', stateName: 'top', fileName: '01-top.png' })
  await shot(page, { ...base, routeSlug: 'landing', stateName: 'viewport-top', fileName: '01-top-viewport.png', fullPage: false })
  await page.evaluate(() => window.scrollTo(0, 600))
  await waitStable(page)
  await shot(page, { ...base, routeSlug: 'landing', stateName: 'mid-scroll', fileName: '02-mid-scroll.png', fullPage: false })
  await tryOpen(page, `${device.id}/landing-login-tab`, async () => {
    await page.goto(`${ctx.baseURL}/?login=1`, { waitUntil: 'domcontentloaded' })
    await waitStable(page)
    await page.getByRole('tab', { name: /log in/i }).click()
  })
  await shot(page, { ...base, routeSlug: 'landing', stateName: 'login-panel', fileName: '03-login-panel.png', notes: 'login tab' })
  await tryOpen(page, `${device.id}/landing-join-tab`, async () => {
    await page.getByRole('tab', { name: /join/i }).click()
  })
  await shot(page, { ...base, routeSlug: 'landing', stateName: 'register-panel', fileName: '04-register-panel.png', notes: 'join tab' })
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await waitStable(page)
  await shot(page, { ...base, routeSlug: 'landing', stateName: 'bottom-scroll', fileName: '05-bottom-scroll.png', fullPage: true })

  await page.goto(`${ctx.baseURL}/?login=1`, { waitUntil: 'domcontentloaded' })
  await waitStable(page)
  await shot(page, { ...base, routeSlug: 'login', stateName: 'empty-form', fileName: '01-empty-form.png' })
  await tryOpen(page, `${device.id}/login-focus`, async () => {
    const field = page.getByLabel(/username or email|username/i).first()
    await field.click()
  })
  await shot(page, { ...base, routeSlug: 'login', stateName: 'focused-field', fileName: '02-focused-field.png' })

  await page.goto(`${ctx.baseURL}/?login=1`, { waitUntil: 'domcontentloaded' })
  await tryOpen(page, `${device.id}/register-tab`, async () => {
    await page.getByRole('tab', { name: /join/i }).click()
  })
  await waitStable(page)
  await shot(page, { ...base, routeSlug: 'register', stateName: 'signup-form', fileName: '01-signup-form.png' })
  await tryOpen(page, `${device.id}/register-checkbox`, async () => {
    const cb = page.getByRole('checkbox').first()
    if (await cb.count()) await cb.focus()
  })
  await shot(page, { ...base, routeSlug: 'register', stateName: 'policy-checkbox-area', fileName: '02-policy-checkbox.png' })

  await page.goto(`${ctx.baseURL}/support`, { waitUntil: 'domcontentloaded' })
  await waitStable(page)
  await shot(page, { ...base, routeSlug: 'support-public', stateName: 'top', fileName: '01-top.png', fullPage: true })
}

async function captureSignedInRoutes(page, ctx, outRoot, device, engine, dynamic) {
  const base = { outRoot, device, engine, signedIn: true, testDataOnly: true }

  const routes = [
    { slug: 'home', path: '/home?mode=discover', extras: (p, b, s, t) => captureHomeExtras(p, b, s, t, ctx.baseURL) },
    { slug: 'people', path: '/people', extras: capturePeopleExtras },
    { slug: 'groups', path: '/groups', extras: captureGroupsExtras },
    { slug: 'events', path: '/events', extras: captureEventsExtras },
    { slug: 'profile', path: dynamic.profilePath ?? '/profile', extras: captureProfileExtras },
    { slug: 'messaging', path: '/messaging', extras: captureMessagingExtras },
    { slug: 'notifications', path: '/notifications', extras: captureNotificationsExtras },
    { slug: 'activity', path: '/activity', extras: (p, b, s) => captureGenericScroll(p, { ...b, routeSlug: 'activity' }, s) },
    { slug: 'settings', path: '/settings', extras: captureSettingsExtras },
    { slug: 'settings-privacy', path: '/settings/privacy', extras: capturePrivacyExtras },
    { slug: 'support-signed-in', path: '/support', extras: captureSupportSignedIn },
    { slug: 'onboarding', path: '/onboarding', extras: (p, b, s) => captureGenericScroll(p, { ...b, routeSlug: 'onboarding' }, s) },
  ]

  for (const r of routes) {
    try {
      if (r.slug === 'onboarding') {
        await page.goto(`${ctx.baseURL}${r.path}`, { waitUntil: 'domcontentloaded', timeout: 45000 })
        await waitStable(page)
        if (!page.url().includes('/onboarding')) {
          skippedMenus.push(`${device.id}/onboarding-already-completed`)
          continue
        }
      } else {
        await page.goto(`${ctx.baseURL}${r.path}`, { waitUntil: 'domcontentloaded', timeout: 45000 })
        await waitStable(page)
      }
      await shot(page, { ...base, routeSlug: r.slug, stateName: 'top', fileName: '01-top.png' })
      await page.evaluate(() => window.scrollTo(0, Math.min(700, document.body.scrollHeight * 0.35)))
      await waitStable(page)
      await shot(page, { ...base, routeSlug: r.slug, stateName: 'mid-scroll', fileName: '02-mid-scroll.png' })
      if (r.extras) await r.extras(page, base, shot, tryOpen)
    } catch (e) {
      failures.push({ route: r.slug, device: device.id, error: e.message })
    }
  }

  if (dynamic.groupDetail) {
    try {
      await page.goto(dynamic.groupDetail, { waitUntil: 'domcontentloaded' })
      await waitStable(page)
      await shot(page, { ...base, routeSlug: 'group-detail', stateName: 'top', fileName: '01-top.png', fullPage: true })
      await tryOpen(page, `${device.id}/group-tab`, async () => {
        const tab = page.getByRole('tab').first()
        if (await tab.count()) await tab.click()
      })
      await shot(page, { ...base, routeSlug: 'group-detail', stateName: 'tab-state', fileName: '02-tab-state.png' })
    } catch (e) {
      failures.push({ route: 'group-detail', device: device.id, error: e.message })
    }
  }

  if (dynamic.eventDetail) {
    try {
      await page.goto(dynamic.eventDetail, { waitUntil: 'domcontentloaded' })
      await waitStable(page)
      await shot(page, { ...base, routeSlug: 'event-detail', stateName: 'top', fileName: '01-top.png', fullPage: true })
      await page.evaluate(() => window.scrollTo(0, 500))
      await waitStable(page)
      await shot(page, { ...base, routeSlug: 'event-detail', stateName: 'mid-scroll', fileName: '02-mid-scroll.png' })
    } catch (e) {
      failures.push({ route: 'event-detail', device: device.id, error: e.message })
    }
  }

  try {
    await page.goto(`${ctx.baseURL}/profile/edit`, { waitUntil: 'domcontentloaded' })
    await waitStable(page)
    await shot(page, { ...base, routeSlug: 'profile-edit', stateName: 'top', fileName: '01-top.png' })
    await page.evaluate(() => window.scrollTo(0, 500))
    await shot(page, { ...base, routeSlug: 'profile-edit', stateName: 'mid-scroll', fileName: '02-mid-scroll.png' })
  } catch (e) {
    failures.push({ route: 'profile-edit', device: device.id, error: e.message })
  }
}

async function captureHomeExtras(page, base, shot, tryOpen, baseURL) {
  await tryOpen(page, 'home-composer', async () => {
    await page.goto(`${baseURL}/home?mode=discover#home-feed-composer`, { waitUntil: 'domcontentloaded' })
    await waitStable(page)
  })
  const photo = page.getByRole('button', { name: /^photo$/i }).first()
  if (await photo.count()) {
    await tryOpen(page, 'home-composer-open', async () => {
      await photo.click()
    })
    await shot(page, { ...base, routeSlug: 'home', stateName: 'composer-open', fileName: '03-composer-open.png' })
    await tryOpen(page, 'home-photo-menu', async () => {
      await photo.click()
    })
  }
  await tryOpen(page, 'home-account-menu', async () => {
    const btn = page.getByRole('button', { name: /account menu/i }).first()
    if (await btn.count()) await btn.click()
  })
  await shot(page, { ...base, routeSlug: 'home', stateName: 'account-menu', fileName: '04-account-menu.png', notes: 'account menu if opened' })
  await tryOpen(page, 'home-create-menu', async () => {
    await page.keyboard.press('Escape').catch(() => {})
    const fab = page.getByRole('button', { name: /^create$/i }).first()
    if (await fab.count()) {
      await fab.click()
    } else {
      const desktopCreate = page.getByRole('button', { name: /create menu/i }).first()
      if (await desktopCreate.count()) await desktopCreate.click()
    }
  })
  await shot(page, { ...base, routeSlug: 'home', stateName: 'create-menu', fileName: '05-create-menu.png', notes: 'create sheet/FAB if opened' })
  await page.keyboard.press('Escape').catch(() => {})
}

async function capturePeopleExtras(page, base, shot, tryOpen) {
  await tryOpen(page, 'people-search', async () => {
    const s = page.getByRole('searchbox').first()
    if (await s.count()) await s.click()
  })
  await shot(page, { ...base, routeSlug: 'people', stateName: 'search-focused', fileName: '03-search-focused.png' })
}

async function captureGroupsExtras(page, base, shot, tryOpen) {
  await tryOpen(page, 'groups-filter', async () => {
    const f = page.getByRole('button', { name: /filter/i }).first()
    if (await f.count()) await f.click()
  })
  await shot(page, { ...base, routeSlug: 'groups', stateName: 'filters-open', fileName: '03-filters-open.png' })
}

async function captureEventsExtras(page, base, shot, tryOpen) {
  await tryOpen(page, 'events-filter', async () => {
    const f = page.getByRole('button', { name: /filter/i }).first()
    if (await f.count()) await f.click()
  })
  await shot(page, { ...base, routeSlug: 'events', stateName: 'filters-open', fileName: '03-filters-open.png' })
}

async function captureProfileExtras(page, base, shot, tryOpen) {
  await page.evaluate(() => window.scrollTo(0, 400))
  await shot(page, { ...base, routeSlug: 'profile', stateName: 'gallery-area', fileName: '03-gallery-area.png' })
}

async function captureMessagingExtras(page, base, shot, tryOpen) {
  await tryOpen(page, 'msg-tab', async () => {
    const t = page.getByRole('tab', { name: /request/i }).first()
    if (await t.count()) await t.click()
  })
  await shot(page, { ...base, routeSlug: 'messaging', stateName: 'requests-tab', fileName: '03-requests-tab.png' })
}

async function captureNotificationsExtras(page, base, shot, tryOpen) {
  await tryOpen(page, 'notif-tab', async () => {
    const t = page.getByRole('tab').first()
    if (await t.count()) await t.click()
  })
  await shot(page, { ...base, routeSlug: 'notifications', stateName: 'tab-state', fileName: '03-tab-state.png' })
}

async function captureGenericScroll(page, base, shot) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await waitStable(page)
  await shot(page, { ...base, routeSlug: base.routeSlug ?? 'route', stateName: 'bottom-scroll', fileName: '03-bottom-scroll.png', fullPage: true })
}

async function captureSettingsExtras(page, base, shot, tryOpen) {
  await page.evaluate(() => window.scrollTo(0, 400))
  await shot(page, { ...base, routeSlug: 'settings', stateName: 'mid-panel', fileName: '03-mid-panel.png' })
}

async function capturePrivacyExtras(page, base, shot, tryOpen) {
  await tryOpen(page, 'privacy-dropdown', async () => {
    const sel = page.locator('select').first()
    if (await sel.count()) await sel.focus()
  })
  await shot(page, { ...base, routeSlug: 'settings-privacy', stateName: 'controls-visible', fileName: '03-controls-visible.png' })
}

async function captureSupportSignedIn(page, base, shot) {
  await page.evaluate(() => window.scrollTo(0, 300))
  await shot(page, { ...base, routeSlug: 'support-signed-in', stateName: 'feedback-area', fileName: '03-feedback-area.png' })
}

function heuristicFindings(manifestEntries, outRoot) {
  for (const m of manifestEntries) {
    if (/account-menu|create-menu|composer-open|filters-open/.test(m.state)) continue
    if (m.device.startsWith('mobile') && m.state === 'top' && /home|messaging|settings/.test(m.route)) {
      findings.push({
        route: m.route,
        device: m.device,
        screenshot: m.file,
        issueType: 'unknown',
        severity: 'low',
        observation: 'Baseline capture for reviewer — check sticky header/bottom nav overlap manually.',
        focus: 'Header, bottom nav, safe-area padding',
      })
    }
  }
}

function writeManifest(outRoot) {
  writeFileSync(join(outRoot, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), count: manifest.length, entries: manifest }, null, 2))
}

function writeFindings(outRoot) {
  const lines = ['# Mobile UX audit — raw findings (automated pass)', '', 'Do not treat as fixes — reviewer input only.', '']
  for (const f of findings) {
    lines.push(`## Route: /${f.route}`)
    lines.push(`Device: ${f.device}`)
    lines.push(`Screenshot: ${f.screenshot}`)
    lines.push(`Issue type: ${f.issueType}`)
    lines.push(`Severity: ${f.severity}`)
    lines.push(`Observation: ${f.observation}`)
    lines.push(`Suggested reviewer focus: ${f.focus}`)
    lines.push('')
  }
  if (failures.length) {
    lines.push('## Capture failures')
    for (const f of failures) lines.push(`- ${f.route} (${f.device ?? 'n/a'}): ${f.error}`)
    lines.push('')
  }
  if (skippedMenus.length) {
    lines.push('## Menus/dropdowns not captured')
    for (const s of [...new Set(skippedMenus)]) lines.push(`- ${s}`)
  }
  writeFileSync(join(outRoot, 'findings-raw.md'), lines.join('\n'))
}

function writeReadme(outRoot, zipPath) {
  const text = `# kink.social Mobile UX Screenshot Audit

Generated: ${new Date().toISOString()}

## Contents
- \`devices/\` — PNG screenshots by viewport folder
- \`manifest.json\` — metadata for every capture
- \`audit-index.html\` — visual thumbnail index
- \`contact-sheets/\` — per-device HTML contact sheets
- \`findings-raw.md\` — automated rough notes (not fixes)

## Devices
${DEVICES.map((d) => `- ${d.id}: ${d.width}×${d.height}`).join('\n')}

## Safety
- Test/alpha account only; no credentials or storage state in this bundle.
- No private message thread contents targeted intentionally.

## Zip
${zipPath ? `Archive: ${zipPath}` : 'See Desktop zip alongside this folder.'}
`
  writeFileSync(join(outRoot, 'README.md'), text)
}

function writeAuditIndex(outRoot) {
  const byDevice = new Map()
  for (const m of manifest) {
    if (!byDevice.has(m.device)) byDevice.set(m.device, [])
    byDevice.get(m.device).push(m)
  }
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Mobile UX Audit Index</title>
<style>body{font-family:system-ui,sans-serif;margin:16px;background:#111;color:#eee}
h1,h2,h3{color:#f5e6a8} .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
.card{background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:8px;font-size:12px}
.card img{width:100%;height:auto;border-radius:4px;background:#000}
.meta{color:#aaa;margin-top:4px;line-height:1.35}</style></head><body>
<h1>kink.social Mobile UX Audit</h1><p>${manifest.length} screenshots · ${new Date().toISOString()}</p>`
  for (const [device, items] of byDevice) {
    html += `<h2>${device}</h2><div class="grid">`
    for (const m of items) {
      html += `<div class="card"><a href="../${m.file}"><img src="../${m.file}" loading="lazy" alt=""/></a>
<div class="meta"><strong>${m.route}</strong><br/>${m.state}<br/>${m.viewport}<br/><code>${basename(m.file)}</code></div></div>`
    }
    html += `</div>`
  }
  html += '</body></html>'
  writeFileSync(join(outRoot, 'audit-index.html'), html)
}

function writeContactSheets(outRoot) {
  for (const d of DEVICES) {
    const items = manifest.filter((m) => m.device === d.id)
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${d.id} contact sheet</title>
<style>body{font-family:system-ui;margin:12px} .row{display:flex;flex-wrap:wrap;gap:8px}
.item{width:160px;font-size:11px} img{width:160px;height:auto;border:1px solid #ccc}</style></head><body>
<h1>${d.id} (${d.width}×${d.height})</h1><div class="row">`
    for (const m of items) {
      html += `<div class="item"><img src="../${m.file}"/><div>${m.route} · ${m.state}</div></div>`
    }
    html += '</div></body></html>'
    writeFileSync(join(outRoot, 'contact-sheets', `${d.id}.html`), html)
  }
}

function zipFolder(dir) {
  const zipPath = `${dir}.zip`
  if (existsSync(zipPath)) rmSync(zipPath)
  try {
    execSync(`tar -a -cf "${zipPath.replace(/\\/g, '/')}" -C "${dirname(dir).replace(/\\/g, '/')}" "${basename(dir)}"`, {
      stdio: 'inherit',
      shell: true,
    })
  } catch {
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${dir}' -DestinationPath '${zipPath}' -Force"`,
      { stdio: 'inherit' },
    )
  }
  return zipPath
}

async function runDevice(browser, device, engine, ctx, outRoot, storageStatePath, dynamic) {
  {
    const publicContext = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      isMobile: device.mobile,
      hasTouch: device.mobile,
    })
    const publicPage = await publicContext.newPage()
    await capturePublicRoutes(publicPage, ctx, outRoot, device, engine)
    await publicContext.close()
  }

  if (storageStatePath && existsSync(storageStatePath)) {
    const authContext = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      isMobile: device.mobile,
      hasTouch: device.mobile,
      storageState: storageStatePath,
    })
    const authPage = await authContext.newPage()
    await captureSignedInRoutes(authPage, ctx, outRoot, device, engine, dynamic)
    await authContext.close()
  }
}

async function main() {
  const creds = loadCredentials()
  if (!creds.user || !creds.pass) {
    console.error('Set KINK_SOCIAL_AUDIT_USER and KINK_SOCIAL_AUDIT_PASS (or credentials file).')
    process.exit(1)
  }

  const outRoot = outDir()
  const storageStatePath = join(outRoot, '.tmp-storage-state.json')
  const ctx = { baseURL: creds.baseURL }

  console.log(`Output: ${outRoot}`)
  console.log(`Target: ${creds.baseURL}`)

  const browser = await chromium.launch({ headless: true })
  const loginContext = await browser.newContext()
  const loginPage = await loginContext.newPage()
  const ok = await loginViaApi(loginPage.request, creds.baseURL, creds.user, creds.pass)
  if (!ok) {
    console.error('Login failed — public routes only.')
    failures.push({ route: 'auth', error: 'login failed' })
  } else {
    await loginContext.storageState({ path: storageStatePath })
    console.log('Logged in (storage state temp file — excluded from zip)')
  }
  const dynamic = ok ? await discoverUrls(loginPage, creds.baseURL) : {}
  await loginContext.close()

  for (const device of DEVICES) {
    console.log(`Device: ${device.id}`)
    await runDevice(browser, device, 'chromium', ctx, outRoot, ok ? storageStatePath : null, dynamic)
  }

  try {
    const webkitBrowser = await webkit.launch({ headless: true })
    for (const device of DEVICES.filter((d) => d.id.startsWith('mobile-390'))) {
      for (const [signedIn, slugList] of [
        [false, ['landing']],
        [true, WEBKIT_KEY_ROUTES.filter((s) => s !== 'landing')],
      ]) {
        if (!ok && signedIn) continue
        const context = await webkitBrowser.newContext({
          viewport: { width: device.width, height: device.height },
          isMobile: true,
          hasTouch: true,
          storageState: signedIn && ok ? storageStatePath : undefined,
        })
        const page = await context.newPage()
        for (const slug of slugList) {
          const paths = {
            landing: '/',
            home: '/home?mode=discover',
            events: '/events',
            'event-detail': dynamic.eventDetail,
            profile: dynamic.profilePath ?? '/profile',
            messaging: '/messaging',
            'settings-privacy': '/settings/privacy',
          }
          const p = paths[slug]
          if (!p) continue
          try {
            await page.goto(p.startsWith('http') ? p : `${creds.baseURL}${p}`, { waitUntil: 'domcontentloaded' })
            await waitStable(page)
            await shot(page, {
              outRoot,
              device,
              engine: 'webkit',
              routeSlug: slug,
              stateName: 'webkit-top',
              signedIn,
              fileName: `99-webkit-top.png`,
              testDataOnly: true,
            })
          } catch (e) {
            failures.push({ route: slug, device: device.id, engine: 'webkit', error: e.message })
          }
        }
        await context.close()
      }
    }
    await webkitBrowser.close()
  } catch (e) {
    console.warn('WebKit skipped:', e.message)
  }

  await browser.close()

  if (existsSync(storageStatePath)) rmSync(storageStatePath)

  heuristicFindings(manifest, outRoot)
  writeManifest(outRoot)
  writeFindings(outRoot)
  writeAuditIndex(outRoot)
  writeContactSheets(outRoot)
  const zipPath = zipFolder(outRoot)
  writeReadme(outRoot, zipPath)

  console.log(`\nDone: ${manifest.length} screenshots`)
  console.log(`Zip: ${zipPath}`)
  console.log(`Failures: ${failures.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
