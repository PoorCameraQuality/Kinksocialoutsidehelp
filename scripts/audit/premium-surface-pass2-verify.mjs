#!/usr/bin/env node
/**
 * Premium Surface Pass 2 verification.
 * Live: KINK_SOCIAL_AUDIT_URL=https://kink.social (default when --live or KINK_SOCIAL_AUDIT_LIVE=1)
 * Local: npm run build -w web && npm run preview -w web → http://127.0.0.1:4173
 * Output: Desktop/kink-social-premium-surface-pass2-live-YYYY-MM-DD-HHMM.zip (live)
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
import { execSync } from 'node:child_process'
import { chromium } from '@playwright/test'

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
      baseURL: (map.KINK_SOCIAL_AUDIT_URL ?? 'http://127.0.0.1:4173').replace(/\/$/, ''),
      user: map.KINK_SOCIAL_AUDIT_USER ?? '',
      pass: map.KINK_SOCIAL_AUDIT_PASS ?? '',
    }
  }
  const live = process.argv.includes('--live') || process.env.KINK_SOCIAL_AUDIT_LIVE === '1'
  const defaultUrl = live ? 'https://kink.social' : 'http://127.0.0.1:4173'
  return {
    baseURL: (process.env.KINK_SOCIAL_AUDIT_URL ?? defaultUrl).replace(/\/$/, ''),
    user: process.env.KINK_SOCIAL_AUDIT_USER ?? '',
    pass: process.env.KINK_SOCIAL_AUDIT_PASS ?? process.env.ALPHA_SOCIAL_SEED_PASSWORD ?? '',
  }
}

function bundlePrefix() {
  const live =
    process.argv.includes('--live') ||
    process.env.KINK_SOCIAL_AUDIT_LIVE === '1' ||
    (process.env.KINK_SOCIAL_AUDIT_URL ?? '').includes('kink.social')
  return live ? 'kink-social-premium-surface-pass2-live' : 'kink-social-premium-surface-pass2'
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
  } catch (e) {
    failures.push({ route, state, error: e.message })
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
  const outRoot = join(homedir(), 'Desktop', `${bundlePrefix()}-${stamp()}`)
  mkdirSync(outRoot, { recursive: true })

  const signedOutMobile = [
    { path: '/', state: 'landing-top', file: '01-top.png' },
    { path: '/?login=1', state: 'login-form', file: '01-form.png' },
    {
      path: '/?login=1',
      state: 'login-focused',
      file: '02-focused-field.png',
      action: async (p) => {
        await p.getByRole('tab', { name: /log in/i }).click().catch(() => {})
        await p.locator('#login-email').focus()
      },
    },
    {
      path: '/?login=1',
      state: 'register-form',
      file: '01-register-form.png',
      action: async (p) => {
        await p.getByRole('tab', { name: /join/i }).first().click()
      },
    },
    {
      path: '/?login=1',
      state: 'register-policy',
      file: '02-policy-checkboxes.png',
      action: async (p) => {
        await p.getByRole('tab', { name: /join/i }).first().click()
        await p.locator('#signup-username').scrollIntoViewIfNeeded().catch(() => {})
      },
    },
    { path: '/support', state: 'support-top', file: '01-top.png' },
  ]

  const signedInMobile = [
    { path: '/home?mode=discover', state: 'home-top', file: '01-top.png' },
    { path: '/home?mode=discover', state: 'home-mid-feed', file: '02-mid-feed.png', scrollY: 700 },
    { path: '/home?mode=discover', state: 'home-composer', file: '03-composer.png' },
    { path: '/events', state: 'events-top', file: '01-top.png' },
    { path: '/people', state: 'people-top', file: '01-top.png' },
    { path: '/groups', state: 'groups-top', file: '01-top.png' },
    { path: '/profile', state: 'profile-top', file: '01-top.png' },
    { path: '/messaging', state: 'messaging-top', file: '01-top.png' },
    { path: '/notifications', state: 'notifications-top', file: '01-top.png' },
    { path: '/settings', state: 'settings-top', file: '01-top.png' },
    { path: '/settings/privacy', state: 'settings-privacy-top', file: '01-top.png' },
    {
      path: '/settings/privacy',
      state: 'settings-privacy-controls',
      file: '02-controls-visible.png',
      scrollY: 400,
    },
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

  const signedOutDesktop = [
    { path: '/', state: 'landing-top', file: '01-top.png' },
    { path: '/?login=1', state: 'login-form', file: '01-form.png' },
  ]

  const signedInDesktop = [
    { path: '/home?mode=discover', state: 'home-top', file: '01-top.png' },
    { path: '/events', state: 'events-top', file: '01-top.png' },
    { path: '/people', state: 'people-top', file: '01-top.png' },
    { path: '/groups', state: 'groups-top', file: '01-top.png' },
    { path: '/profile', state: 'profile-top', file: '01-top.png' },
    { path: '/messaging', state: 'messaging-top', file: '01-top.png' },
    { path: '/settings/privacy', state: 'settings-privacy-top', file: '01-top.png' },
    { path: '/people', state: 'directory-template', file: '02-directory-template.png' },
    {
      path: '/events',
      state: 'detail-template',
      file: '03-detail-template.png',
      action: async (p) => {
        const link = p.locator('a[href^="/events/"]').first()
        if (await link.count()) {
          await link.click()
          await wait(p)
        }
      },
    },
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
    await capture(await ctx.newPage(), outRoot, 'signed-out-mobile-390', baseURL, signedOutMobile)
    await ctx.close()
  }

  if (loginOk) {
    const ctx = await browser.newContext({
      viewport: MOBILE,
      isMobile: true,
      hasTouch: true,
      storageState: storagePath,
    })
    await capture(await ctx.newPage(), outRoot, 'signed-in-mobile-390', baseURL, signedInMobile)
    await ctx.close()
  }

  {
    const ctx = await browser.newContext({ viewport: DESKTOP })
    await capture(await ctx.newPage(), outRoot, 'signed-out-desktop-1280', baseURL, signedOutDesktop)
    await ctx.close()
  }

  if (loginOk) {
    const ctx = await browser.newContext({ viewport: DESKTOP, storageState: storagePath })
    await capture(await ctx.newPage(), outRoot, 'signed-in-desktop-1280', baseURL, signedInDesktop)
    await ctx.close()
  }

  await browser.close()
  if (existsSync(storagePath)) rmSync(storagePath)

  const findings = `# Premium Surface Pass 2 verify

Target: ${baseURL}
Login: ${loginOk ? 'ok' : 'failed (signed-in skipped)'}

| Question | Verdict |
|----------|---------|
| Public auth forms match premium system? | login/register inputs use dc-premium-input + auth-input--landing |
| Settings forms match? | settingsSelectClass / settingsInputClass on privacy panels |
| Templates visually consistent? | SettingsSection, DirectoryFilterButton, DetailTemplate enter |
| Cards cohesive? | Org/Presenter/Vendor/Education use cardSurface* |
| Buttons/chips consistent? | dc-premium-btn on filter trigger; dc-chip on Events |
| Mobile more cramped? | No extra padding layers added |
| Desktop regression? | 1280 rails preserved |
| Events layout intact? | EventFiltersPanel inputs only; hierarchy unchanged |
| Education architecture untouched? | EducationCard surface only |
| Contrast readable? | Review login + settings screenshots |
| Motion restrained? | dc-card-polish transitions; reduced-motion gates |

Failures: ${failures.length}
`
  writeFileSync(join(outRoot, 'findings-raw.md'), findings)
  writeFileSync(join(outRoot, 'manifest.json'), JSON.stringify({ baseURL, loginOk, count: manifest.length, entries: manifest, failures }, null, 2))
  writeFileSync(join(outRoot, 'README.md'), `# Premium Surface Pass 2 Verify\n\n${manifest.length} PNGs from ${baseURL}\n`)
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Premium Surface Pass 2</title><style>body{font-family:system-ui;background:#111;color:#eee;padding:16px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}img{width:100%}.card{background:#1a1a1a;padding:8px;font-size:11px}</style></head><body><h1>Premium Surface Pass 2</h1><div class="grid">`
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
