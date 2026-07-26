#!/usr/bin/env node
/**
 * Events Mobile UX verification screenshots — Pass 1.
 * Defaults to production: https://kink.social
 * Output: Desktop/kink-social-events-mobile-ux-verify-YYYY-MM-DD-HHMM.zip
 */
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  readdirSync,
} from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { chromium } from '@playwright/test'

const __dirname = dirname(fileURLToPath(import.meta.url))

const DEVICES = [
  { id: 'mobile-360', width: 360, height: 800 },
  { id: 'mobile-390', width: 390, height: 844 },
  { id: 'mobile-430', width: 430, height: 932 },
  { id: 'tablet-768', width: 768, height: 1024 },
  { id: 'desktop-1280', width: 1280, height: 900 },
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

const manifest = []
const failures = []
const notes = []

async function waitStable(page) {
  await page.waitForLoadState('networkidle').catch(() => page.waitForLoadState('domcontentloaded').catch(() => {}))
  await page.waitForTimeout(900)
}

async function shot(page, opts) {
  const { outRoot, device, routeSlug, stateName, signedIn, fileName } = opts
  const ctx = signedIn ? 'signed-in' : 'signed-out'
  const relDir = join(ctx, 'devices', device.id, routeSlug)
  mkdirSync(join(outRoot, relDir), { recursive: true })
  const relPath = join(relDir, fileName).replace(/\\/g, '/')
  try {
    await page.screenshot({ path: join(outRoot, relPath), type: 'png', fullPage: false })
    manifest.push({
      file: relPath,
      device: device.id,
      route: routeSlug,
      state: stateName,
      signedIn,
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
  await page.goto(`${baseURL}/events`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await waitStable(page)
  await page
    .locator('a[href*="/events/"]:not([href$="/events"]):not([href*="/events/create"])')
    .first()
    .waitFor({ timeout: 15000 })
    .catch(() => {})
  const href = await page
    .locator('a[href*="/events/"]:not([href$="/events"]):not([href*="/events/create"])')
    .first()
    .getAttribute('href')
    .catch(() => null)
  if (!href) return null
  return href.startsWith('http') ? href : `${baseURL}${href}`
}

async function openFilters(page) {
  const btn = page.getByRole('button', { name: /^filters(\s|\(|$)/i }).first()
  if (await btn.count()) {
    await btn.click()
    await waitStable(page)
    return true
  }
  return false
}

function writeBundleMeta(outRoot, zipPath, eventDetail, loginOk) {
  writeFileSync(
    join(outRoot, 'manifest.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseURL: loadCredentials().baseURL,
        eventDetail,
        loginOk,
        count: manifest.length,
        entries: manifest,
        failures,
      },
      null,
      2,
    ),
  )
  const findings = `# Events Mobile UX verify — Pass 1

Target: ${loadCredentials().baseURL}
Event detail: ${eventDetail ?? 'not discovered'}
Signed-in login: ${loginOk ? 'ok' : 'failed'}

## Acceptance questions

| Question | Verdict | Evidence |
|----------|---------|----------|
| First event content soon enough on mobile? | Review signed-out/mobile-390/events/01-top and signed-in/mobile-390/events/01-top | First card should peek above fold |
| Filters useful without dominating? | Compare 01-top vs 02-filters-open on mobile-360/390 | Fast chips + Filters sheet |
| Cards scannable at 360px? | signed-in/mobile-360/events/01-top | Date badge, title, location, action |
| Horizontal clipping? | Inspect card left/right edges at 360px | No overflow-x |
| Event detail first viewport? | signed-in/mobile-390/event-detail/01-top | Title, facts block, RSVP bar |
| RSVP/status clear and non-overlapping? | event-detail/02-rsvp-status + 03-mid-scroll | Sticky bar above bottom nav |
| Privacy copy visible but not overwhelming? | event-detail/01-top compact note | Below facts, not in sidebar only |
| Desktop regression? | desktop-1280/events + event-detail | Multi-column rails preserved |
| Signed-out clean? | signed-out/* routes | No session chrome leaks |

Failures: ${failures.length}
${failures.map((f) => `- ${f.device} ${f.route}: ${f.error}`).join('\n') || ''}
`
  writeFileSync(join(outRoot, 'findings-raw.md'), findings)
  writeFileSync(
    join(outRoot, 'README.md'),
    `# Events Mobile UX Verify (Pass 1)

${manifest.length} screenshots from **${loadCredentials().baseURL}**.

## Layout
- \`signed-out/\` — guest context
- \`signed-in/\` — authenticated (\`alpha_social\` when credentials available)

Open \`audit-index.html\` for a grid view.

Zip: \`${zipPath}\`
`,
  )
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Events UX Verify</title><style>body{font-family:system-ui;margin:16px;background:#111;color:#eee}h2{margin-top:2rem}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}.card{background:#1a1a1a;border:1px solid #333;padding:8px;font-size:12px}img{width:100%;border-radius:4px}</style></head><body><h1>Events Mobile UX Verify</h1>`
  for (const ctx of ['signed-out', 'signed-in']) {
    const entries = manifest.filter((m) => m.file.startsWith(ctx))
    if (!entries.length) continue
    html += `<h2>${ctx}</h2><div class="grid">`
    for (const m of entries) {
      html += `<div class="card"><img src="${m.file}" loading="lazy"/><div>${m.device}<br/>${m.route} · ${m.state}</div></div>`
    }
    html += '</div>'
  }
  html += '</body></html>'
  writeFileSync(join(outRoot, 'audit-index.html'), html)
}

function zipFolder(dir) {
  const zipPath = `${dir}.zip`
  if (existsSync(zipPath)) rmSync(zipPath)
  try {
    execSync(
      `tar -a -cf "${zipPath.replace(/\\/g, '/')}" -C "${dirname(dir).replace(/\\/g, '/')}" "${basename(dir)}"`,
      { shell: true, stdio: 'inherit' },
    )
  } catch {
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${dir}' -DestinationPath '${zipPath}' -Force"`,
      { stdio: 'inherit' },
    )
  }
  return zipPath
}

async function captureSignedOut(page, outRoot, device, baseURL, eventDetail) {
  const base = { outRoot, device, signedIn: false }

  if (['mobile-360', 'mobile-390', 'mobile-430', 'desktop-1280'].includes(device.id)) {
    await page.goto(`${baseURL}/events`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await waitStable(page)
    await shot(page, { ...base, routeSlug: 'events', stateName: 'top', fileName: '01-top.png' })
  }

  if (device.id === 'mobile-390' && eventDetail) {
    await page.goto(eventDetail, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await waitStable(page)
    await shot(page, { ...base, routeSlug: 'event-detail', stateName: 'top', fileName: '01-top.png' })
    await page.evaluate(() => window.scrollTo(0, 520))
    await waitStable(page)
    await shot(page, { ...base, routeSlug: 'event-detail', stateName: 'mid-scroll', fileName: '02-mid-scroll.png' })
  }
}

async function captureSignedIn(page, outRoot, device, baseURL, eventDetail) {
  const base = { outRoot, device, signedIn: true }

  if (['mobile-360', 'mobile-390', 'mobile-430', 'tablet-768', 'desktop-1280'].includes(device.id)) {
    await page.goto(`${baseURL}/events`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await waitStable(page)
    await shot(page, { ...base, routeSlug: 'events', stateName: 'top', fileName: '01-top.png' })
  }

  if (['mobile-360', 'mobile-390'].includes(device.id)) {
    await page.goto(`${baseURL}/events`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await waitStable(page)
    if (await openFilters(page)) {
      await shot(page, { ...base, routeSlug: 'events', stateName: 'filters-open', fileName: '02-filters-open.png' })
    }
    await page.keyboard.press('Escape').catch(() => {})
  }

  if (eventDetail) {
    const detailDevices = ['mobile-390', 'tablet-768', 'desktop-1280']
    if (detailDevices.includes(device.id)) {
      await page.goto(eventDetail, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitStable(page)
      await shot(page, { ...base, routeSlug: 'event-detail', stateName: 'top', fileName: '01-top.png' })
      if (device.id === 'mobile-390') {
        await shot(page, { ...base, routeSlug: 'event-detail', stateName: 'rsvp-status', fileName: '02-rsvp-status.png' })
        await page.evaluate(() => window.scrollTo(0, 520))
        await waitStable(page)
        await shot(page, { ...base, routeSlug: 'event-detail', stateName: 'mid-scroll', fileName: '03-mid-scroll.png' })
      }
    }
  }
}

async function main() {
  const creds = loadCredentials()
  const stamp = timestampFolder()
  const outRoot = join(homedir(), 'Desktop', `kink-social-events-mobile-ux-verify-${stamp}`)
  mkdirSync(outRoot, { recursive: true })

  const storagePath = join(outRoot, '.tmp-storage-state.json')
  const browser = await chromium.launch({ headless: true })

  let eventDetail = process.env.KINK_SOCIAL_AUDIT_EVENT_URL?.trim() || null
  let loginOk = false

  if (creds.user && creds.pass) {
    const loginCtx = await browser.newContext()
    const loginPage = await loginCtx.newPage()
    loginOk = await loginViaApi(loginPage.request, creds.baseURL, creds.user, creds.pass)
    if (loginOk) {
      await loginCtx.storageState({ path: storagePath })
      notes.push('API login ok')
    } else {
      notes.push('API login failed — signed-in captures skipped')
    }
    if (!eventDetail) eventDetail = await discoverEventDetail(loginPage, creds.baseURL)
    await loginCtx.close()
  }

  if (!eventDetail) {
    const anon = await browser.newContext()
    const anonPage = await anon.newPage()
    eventDetail = await discoverEventDetail(anonPage, creds.baseURL)
    await anon.close()
  }

  for (const device of DEVICES) {
    {
      const ctx = await browser.newContext({
        viewport: { width: device.width, height: device.height },
        isMobile: device.width < 1024,
        hasTouch: device.width < 1024,
      })
      const page = await ctx.newPage()
      await captureSignedOut(page, outRoot, device, creds.baseURL, eventDetail)
      await ctx.close()
    }
    if (loginOk && existsSync(storagePath)) {
      const ctx = await browser.newContext({
        viewport: { width: device.width, height: device.height },
        isMobile: device.width < 1024,
        hasTouch: device.width < 1024,
        storageState: storagePath,
      })
      const page = await ctx.newPage()
      await captureSignedIn(page, outRoot, device, creds.baseURL, eventDetail)
      await ctx.close()
    }
  }

  await browser.close()
  if (existsSync(storagePath)) rmSync(storagePath)

  const zipPath = zipFolder(outRoot)
  writeBundleMeta(outRoot, zipPath, eventDetail, loginOk)
  const count = readdirSync(outRoot, { recursive: true }).filter((f) => String(f).endsWith('.png')).length
  console.log(`Done: ${count} PNGs from ${creds.baseURL}`)
  console.log(`Zip: ${zipPath}`)
  if (!loginOk) console.warn('Signed-in captures skipped — set KINK_SOCIAL_AUDIT_USER/PASS')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
