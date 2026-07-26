#!/usr/bin/env node
/**
 * Premium Surface System Pass 1 verification — https://kink.social
 * Output: Desktop/kink-social-premium-surface-live-verify-YYYY-MM-DD-HHMM.zip
 *   (set KINK_SOCIAL_AUDIT_LIVE=1 or pass --live to use live-verify prefix)
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

const MOBILE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 900 }

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

function creds() {
  const file = process.env.KINK_SOCIAL_AUDIT_CREDENTIALS_FILE
  if (file && existsSync(file)) {
    const map = Object.fromEntries(
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .filter((l) => l.trim() && !l.startsWith('#'))
        .map((l) => {
          const i = l.indexOf('=')
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
        }),
    )
    return {
      baseURL: (map.KINK_SOCIAL_AUDIT_URL ?? 'https://kink.social').replace(/\/$/, ''),
      user: map.KINK_SOCIAL_AUDIT_USER ?? '',
      pass: map.KINK_SOCIAL_AUDIT_PASS ?? '',
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

async function wait(page) {
  await page.waitForLoadState('networkidle').catch(() => page.waitForLoadState('domcontentloaded').catch(() => {}))
  await page.waitForTimeout(800)
}

function routeSlug(path) {
  const base = path.split('?')[0].replace(/^\//, '').replace(/\//g, '-') || 'root'
  const q = path.includes('?') ? path.split('?')[1].replace(/[^a-z0-9]+/gi, '-') : ''
  return q ? `${base}--${q}` : base
}

async function shot(page, outRoot, ctx, route, state, file) {
  const relDir = join(ctx, routeSlug(route))
  mkdirSync(join(outRoot, relDir), { recursive: true })
  const rel = join(relDir, file).replace(/\\/g, '/')
  try {
    await page.screenshot({ path: join(outRoot, rel), type: 'png' })
    manifest.push({ file: rel, ctx, route, state })
    return true
  } catch (e) {
    failures.push({ route, error: e.message })
    return false
  }
}

async function login(request, baseURL, user, pass) {
  const res = await request.post(`${baseURL}/api/auth/session`, {
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ username: user, password: pass }),
  })
  return res.ok()
}

function zip(dir) {
  const z = `${dir}.zip`
  if (existsSync(z)) rmSync(z)
  try {
    execSync(`tar -a -cf "${z.replace(/\\/g, '/')}" -C "${dirname(dir).replace(/\\/g, '/')}" "${basename(dir)}"`, {
      shell: true,
      stdio: 'inherit',
    })
  } catch {
    execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${dir}' -DestinationPath '${z}' -Force"`, {
      stdio: 'inherit',
    })
  }
  return z
}

async function capture(page, outRoot, ctx, baseURL, spec) {
  for (const { path, state, file, scrollY, action } of spec) {
    await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await wait(page)
    if (action) await action(page)
    if (scrollY) {
      await page.evaluate((y) => window.scrollTo(0, y), scrollY)
      await wait(page)
    }
    await shot(page, outRoot, ctx, path, state, file)
  }
}

async function main() {
  const { baseURL, user, pass } = creds()
  const live = process.env.KINK_SOCIAL_AUDIT_LIVE === '1' || process.argv.includes('--live')
  const prefix = live ? 'kink-social-premium-surface-live-verify' : 'kink-social-premium-surface-pass1'
  const outRoot = join(homedir(), 'Desktop', `${prefix}-${stamp()}`)
  mkdirSync(outRoot, { recursive: true })

  const signedOutMobile = [
    { path: '/', state: 'landing-top', file: '01-top.png' },
    { path: '/?login=1', state: 'login-form', file: '01-form.png' },
  ]

  const signedInMobile = [
    { path: '/home?mode=discover', state: 'home-top', file: '01-top.png' },
    { path: '/home?mode=discover', state: 'home-mid-feed', file: '02-mid-feed.png', scrollY: 700 },
    { path: '/home?mode=discover', state: 'home-composer', file: '03-composer.png', scrollY: 0 },
    { path: '/events', state: 'events-top', file: '01-top.png' },
    { path: '/people', state: 'people-top', file: '01-top.png' },
    { path: '/groups', state: 'groups-top', file: '01-top.png' },
    { path: '/profile', state: 'profile-top', file: '01-top.png' },
    { path: '/messaging', state: 'messaging-top', file: '01-top.png' },
    { path: '/notifications', state: 'notifications-top', file: '01-top.png' },
    { path: '/settings/privacy', state: 'settings-privacy-top', file: '01-top.png' },
    {
      path: '/home?mode=discover',
      state: 'account-sheet',
      file: '04-account-sheet.png',
      action: async (p) => {
        const btn = p.getByRole('button', { name: /account menu/i }).first()
        if (await btn.count()) await btn.click()
      },
    },
    {
      path: '/home?mode=discover',
      state: 'create-sheet',
      file: '05-create-sheet.png',
      action: async (p) => {
        await p.keyboard.press('Escape').catch(() => {})
        const fab = p.getByRole('button', { name: /^create$/i }).first()
        if (await fab.count()) await fab.click()
      },
    },
    {
      path: '/events',
      state: 'filter-sheet',
      file: '02-filter-sheet.png',
      action: async (p) => {
        await p.keyboard.press('Escape').catch(() => {})
        const btn = p.getByRole('button', { name: /^filters(\s|\(|$)/i }).first()
        if (await btn.count()) await btn.click()
      },
    },
  ]

  const signedOutDesktop = [{ path: '/', state: 'landing-top', file: '01-top.png' }]

  const signedInDesktop = [
    { path: '/home?mode=discover', state: 'home-top', file: '01-top.png' },
    { path: '/events', state: 'events-top', file: '01-top.png' },
    { path: '/profile', state: 'profile-top', file: '01-top.png' },
    { path: '/messaging', state: 'messaging-top', file: '01-top.png' },
    { path: '/settings/privacy', state: 'settings-privacy-top', file: '01-top.png' },
  ]

  const browser = await chromium.launch({ headless: true })
  const storagePath = join(outRoot, '.tmp-auth.json')
  let loginOk = false
  if (user && pass) {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    loginOk = await login(page.request, baseURL, user, pass)
    if (loginOk) await ctx.storageState({ path: storagePath })
    await ctx.close()
  }

  {
    const ctx = await browser.newContext({ viewport: MOBILE, isMobile: true, hasTouch: true })
    const page = await ctx.newPage()
    await capture(page, outRoot, 'signed-out-mobile-390', baseURL, signedOutMobile)
    await ctx.close()
  }

  if (loginOk) {
    const ctx = await browser.newContext({
      viewport: MOBILE,
      isMobile: true,
      hasTouch: true,
      storageState: storagePath,
    })
    const page = await ctx.newPage()
    await capture(page, outRoot, 'signed-in-mobile-390', baseURL, signedInMobile)
    await ctx.close()
  }

  {
    const ctx = await browser.newContext({ viewport: DESKTOP })
    const page = await ctx.newPage()
    await capture(page, outRoot, 'signed-out-desktop-1280', baseURL, signedOutDesktop)
    await ctx.close()
  }

  if (loginOk) {
    const ctx = await browser.newContext({ viewport: DESKTOP, storageState: storagePath })
    const page = await ctx.newPage()
    await capture(page, outRoot, 'signed-in-desktop-1280', baseURL, signedInDesktop)
    await ctx.close()
  }

  await browser.close()
  if (existsSync(storagePath)) rmSync(storagePath)

  const findings = `# Premium Surface Pass 1 verify

Target: ${baseURL}
Login: ${loginOk ? 'ok' : 'failed (signed-in skipped)'}

| Question | Review |
|----------|--------|
| More cohesive? | Compare cards/buttons across Home, Events, People |
| Cards more premium? | Shadow depth, borders, hover on desktop |
| CTAs clearer? | Primary buttons on empty states, composer |
| Badges/chips calmer? | Events fast filters, metadata on cards |
| Forms easier to read? | Login form, settings privacy |
| Sheets smoother? | Account, create, filter sheets |
| Mobile more cramped? | Home/Events top viewports — should not add padding |
| Desktop regression? | 1280 Home/Events rails |
| Contrast readable? | Body text on elevated surfaces |
| Reduced motion? | CSS gates in premium-surfaces.css |
| Events layout intact? | Events top hierarchy unchanged |

Failures: ${failures.length}
`
  writeFileSync(join(outRoot, 'findings-raw.md'), findings)
  writeFileSync(
    join(outRoot, 'manifest.json'),
    JSON.stringify({ baseURL, loginOk, count: manifest.length, entries: manifest, failures }, null, 2),
  )
  writeFileSync(
    join(outRoot, 'README.md'),
    `# Premium Surface Pass 1 Verify\n\n${manifest.length} PNGs from ${baseURL}\n`,
  )
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Premium Surface Verify</title><style>body{font-family:system-ui;background:#111;color:#eee;padding:16px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}img{width:100%}.card{background:#1a1a1a;padding:8px;font-size:11px}</style></head><body><h1>Premium Surface Pass 1</h1><div class="grid">`
  for (const m of manifest) {
    html += `<div class="card"><img src="${m.file}"/><div>${m.ctx}<br/>${m.route} · ${m.state}</div></div>`
  }
  html += '</div></body></html>'
  writeFileSync(join(outRoot, 'audit-index.html'), html)

  const zipPath = zip(outRoot)
  const count = readdirSync(outRoot, { recursive: true }).filter((f) => String(f).endsWith('.png')).length
  console.log(`Done: ${count} PNGs`)
  console.log(`Zip: ${zipPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
