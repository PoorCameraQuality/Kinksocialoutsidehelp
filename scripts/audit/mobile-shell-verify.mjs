#!/usr/bin/env node
/**
 * Targeted mobile shell verification screenshots (Pass 1).
 * Output: Desktop/kink-social-mobile-shell-verify-YYYY-MM-DD-HHMM.zip
 *
 * Usage:
 *   KINK_SOCIAL_AUDIT_URL=http://127.0.0.1:5173
 *   KINK_SOCIAL_AUDIT_USER=...
 *   KINK_SOCIAL_AUDIT_PASS=...
 *   node scripts/audit/mobile-shell-verify.mjs
 */
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  readdirSync,
  statSync,
} from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { chromium } from '@playwright/test'

const __dirname = dirname(fileURLToPath(import.meta.url))

const DEVICES = [
  { id: 'mobile-360', width: 360, height: 800, captures: 'full' },
  { id: 'mobile-390', width: 390, height: 844, captures: 'full' },
  { id: 'mobile-430', width: 430, height: 932, captures: 'partial' },
  { id: 'tablet-768', width: 768, height: 1024, captures: 'tablet' },
  { id: 'desktop-1280', width: 1280, height: 900, captures: 'desktop' },
]

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
      baseURL: (map.KINK_SOCIAL_AUDIT_URL ?? map.URL ?? 'http://127.0.0.1:5173').replace(/\/$/, ''),
      user: map.KINK_SOCIAL_AUDIT_USER ?? map.USER ?? '',
      pass: map.KINK_SOCIAL_AUDIT_PASS ?? map.PASS ?? '',
    }
  }
  return {
    baseURL: (process.env.KINK_SOCIAL_AUDIT_URL ?? 'http://127.0.0.1:5173').replace(/\/$/, ''),
    user: process.env.KINK_SOCIAL_AUDIT_USER ?? '',
    pass: process.env.KINK_SOCIAL_AUDIT_PASS ?? process.env.ALPHA_SOCIAL_SEED_PASSWORD ?? '',
  }
}

const manifest = []
const failures = []

function record(entry) {
  manifest.push(entry)
}

async function waitStable(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await page.waitForTimeout(700)
}

async function shot(page, opts) {
  const { outRoot, device, routeSlug, stateName, signedIn, fileName, notes = '' } = opts
  const relDir = join('devices', device.id, routeSlug)
  mkdirSync(join(outRoot, relDir), { recursive: true })
  const relPath = join(relDir, fileName).replace(/\\/g, '/')
  try {
    await page.screenshot({ path: join(outRoot, relPath), type: 'png' })
    record({
      file: relPath,
      device: device.id,
      route: routeSlug,
      state: stateName,
      signedIn,
      notes,
      timestamp: new Date().toISOString(),
    })
    return true
  } catch (err) {
    failures.push({ route: routeSlug, device: device.id, error: err.message })
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

async function discoverEventDetail(page, baseURL) {
  try {
    await page.goto(`${baseURL}/events`, { waitUntil: 'domcontentloaded' })
    await waitStable(page)
    const href = await page.locator('a[href*="/events/"]').first().getAttribute('href')
    if (href) return href.startsWith('http') ? href : `${baseURL}${href}`
  } catch {
    /* optional */
  }
  return null
}

async function captureSignedOut(page, outRoot, device, baseURL) {
  const base = { outRoot, device, signedIn: false }
  await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' })
  await waitStable(page)
  await shot(page, { ...base, routeSlug: 'landing', stateName: 'top', fileName: '01-top.png' })

  await page.goto(`${baseURL}/?login=1`, { waitUntil: 'domcontentloaded' })
  await waitStable(page)
  await shot(page, { ...base, routeSlug: 'login', stateName: 'form', fileName: '01-form.png' })

  await page.goto(`${baseURL}/?login=1`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('tab', { name: /join/i }).click().catch(() => {})
  await waitStable(page)
  await shot(page, { ...base, routeSlug: 'register', stateName: 'form', fileName: '01-form.png' })

  await page.goto(`${baseURL}/support`, { waitUntil: 'domcontentloaded' })
  await waitStable(page)
  await shot(page, { ...base, routeSlug: 'support-public', stateName: 'top', fileName: '01-top.png' })
}

async function captureSignedIn(page, outRoot, device, baseURL, eventDetail, mode) {
  const base = { outRoot, device, signedIn: true }

  const go = async (slug, path, file, state, scrollY = 0) => {
    await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await waitStable(page)
    if (scrollY) {
      await page.evaluate((y) => window.scrollTo(0, y), scrollY)
      await waitStable(page)
    }
    await shot(page, { ...base, routeSlug: slug, stateName: state, fileName: file })
  }

  if (mode === 'full' || mode === 'partial' || mode === 'tablet' || mode === 'desktop') {
    await go('home', '/home?mode=discover', '01-top.png', 'top')
  }
  if (mode === 'full') {
    await go('home', '/home?mode=discover', '02-mid-scroll.png', 'mid-scroll', 700)
    const accountBtn = page.getByRole('button', { name: /account menu/i }).first()
    if (await accountBtn.count()) {
      await accountBtn.click()
      await waitStable(page)
      await shot(page, { ...base, routeSlug: 'home', stateName: 'account-menu', fileName: '03-account-menu.png' })
      await page.keyboard.press('Escape').catch(() => {})
    }
    const fab = page.getByRole('button', { name: /^create$/i }).first()
    if (await fab.count()) {
      await fab.click()
      await waitStable(page)
      await shot(page, { ...base, routeSlug: 'home', stateName: 'create-menu', fileName: '04-create-menu.png' })
      await page.keyboard.press('Escape').catch(() => {})
    }
  }

  if (mode === 'full' || mode === 'partial' || mode === 'tablet' || mode === 'desktop') {
    await go('events', '/events', '01-top.png', 'top')
  }
  if (mode === 'full' && eventDetail) {
    await page.goto(eventDetail, { waitUntil: 'domcontentloaded' })
    await waitStable(page)
    await page.evaluate(() => window.scrollTo(0, 500))
    await waitStable(page)
    await shot(page, { ...base, routeSlug: 'event-detail', stateName: 'mid-scroll-rsvp', fileName: '01-mid-scroll.png', notes: 'sticky RSVP/status bar' })
  }
  if (mode === 'full') {
    await go('profile', '/profile', '01-mid-scroll.png', 'mid-scroll', 600)
    await go('profile-edit', '/profile/edit', '01-top-save-bar.png', 'top-save-bar')
    await go('settings-privacy', '/settings/privacy', '01-top.png', 'top')
  }
  if (mode === 'partial') {
    await go('settings-privacy', '/settings/privacy', '01-top.png', 'top')
  }
  if (mode === 'tablet') {
    const accountBtn = page.getByRole('button', { name: /account menu/i }).first()
    if (await accountBtn.count()) {
      await accountBtn.click()
      await waitStable(page)
      await shot(page, { ...base, routeSlug: 'home', stateName: 'account-menu', fileName: '02-account-menu.png' })
    }
  }
}

function writeBundleMeta(outRoot, zipPath) {
  writeFileSync(join(outRoot, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), count: manifest.length, entries: manifest }, null, 2))
  const findings = `# Mobile shell verify — Pass 1

## Questions answered
- Bottom nav overlap: check home/events/profile bottom screenshots
- FAB overlap: check home mid-scroll + create menu
- Event sticky bar vs bottom nav: event-detail mid-scroll
- Profile edit save bar: profile-edit top
- Tablet 768 nav clip: tablet-768 home/events top
- Account vs create menus: home 03/04 screenshots
- Settings privacy top viewport: settings-privacy 01-top
- Signed-out context: landing/login/register/support-public (signedIn: false in manifest)

Failures: ${failures.length}
`
  writeFileSync(join(outRoot, 'findings-raw.md'), findings)
  writeFileSync(
    join(outRoot, 'README.md'),
    `# kink.social Mobile Shell Verify (Pass 1)\n\nGenerated: ${new Date().toISOString()}\n\n${manifest.length} screenshots.\n\nArchive: ${zipPath ?? 'pending'}\n`,
  )
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Mobile Shell Verify</title>
<style>body{font-family:system-ui;margin:16px;background:#111;color:#eee}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
.card{background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:8px;font-size:12px}img{width:100%;height:auto;border-radius:4px}</style></head><body>
<h1>Mobile Shell Verify</h1><div class="grid">`
  for (const m of manifest) {
    html += `<div class="card"><img src="${m.file}" alt=""/><div>${m.device} · ${m.route} · ${m.state}<br/>signedIn=${m.signedIn}</div></div>`
  }
  html += '</div></body></html>'
  writeFileSync(join(outRoot, 'audit-index.html'), html)
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

async function main() {
  const creds = loadCredentials()
  const stamp = timestampFolder()
  const outRoot = join(homedir(), 'Desktop', `kink-social-mobile-shell-verify-${stamp}`)
  mkdirSync(outRoot, { recursive: true })
  for (const d of DEVICES) mkdirSync(join(outRoot, 'devices', d.id), { recursive: true })

  const storagePath = join(outRoot, '.tmp-storage-state.json')
  const browser = await chromium.launch({ headless: true })

  let eventDetail = null
  if (creds.user && creds.pass) {
    const loginCtx = await browser.newContext()
    const loginPage = await loginCtx.newPage()
    if (await loginViaApi(loginPage.request, creds.baseURL, creds.user, creds.pass)) {
      await loginCtx.storageState({ path: storagePath })
      eventDetail = await discoverEventDetail(loginPage, creds.baseURL)
      console.log('Authenticated for signed-in captures')
    } else {
      console.warn('Login failed — signed-in captures skipped')
    }
    await loginCtx.close()
  }

  for (const device of DEVICES) {
    {
      const ctx = await browser.newContext({
        viewport: { width: device.width, height: device.height },
        isMobile: device.width < 1024,
        hasTouch: device.width < 1024,
      })
      const page = await ctx.newPage()
      await captureSignedOut(page, outRoot, device, creds.baseURL)
      await ctx.close()
    }
    if (existsSync(storagePath)) {
      const ctx = await browser.newContext({
        viewport: { width: device.width, height: device.height },
        isMobile: device.width < 1024,
        hasTouch: device.width < 1024,
        storageState: storagePath,
      })
      const page = await ctx.newPage()
      await captureSignedIn(page, outRoot, device, creds.baseURL, eventDetail, device.captures)
      await ctx.close()
    }
  }

  await browser.close()
  if (existsSync(storagePath)) rmSync(storagePath)

  const zipPath = zipFolder(outRoot)
  writeBundleMeta(outRoot, zipPath)
  const count = readdirSync(outRoot, { recursive: true }).filter((f) => String(f).endsWith('.png')).length
  console.log(`Done: ${count} PNGs, zip: ${zipPath}`)
  if (failures.length) console.warn('Failures:', failures)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
