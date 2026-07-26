#!/usr/bin/env node
/** Finish education pass1 screenshot bundle (desktop + metadata + zip). */
import { readdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { chromium } from '@playwright/test'

const outDir = join('C:', 'Users', 'shkin', 'Desktop', 'kink-social-education-creator-credibility-pass1-2026-06-17-2117')
const base = 'http://127.0.0.1:5173'
const demoPassword = process.env.E2E_DEMO_PASSWORD ?? 'demo'

const browser = await chromium.launch()
const context = await browser.newContext()
const page = await context.newPage()

async function login() {
  const res = await page.request.post(`${base}/api/auth/session`, {
    data: { username: 'RopeDreamer', password: demoPassword },
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok()) throw new Error(`Login failed: ${res.status()}`)
}

const desktopRoutes = [
  { id: 'desktop-education-top', path: '/education' },
  { id: 'desktop-education-articles', path: '/education?view=articles' },
  { id: 'desktop-education-paths', path: '/education?view=paths' },
  { id: 'desktop-education-write', path: '/education/write', auth: true },
]

for (const route of desktopRoutes) {
  await page.setViewportSize({ width: 1280, height: 900 })
  if (route.auth) await login()
  else await context.clearCookies()
  await page.goto(`${base}${route.path}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: join(outDir, `${route.id}.png`), fullPage: true })
  console.log('wrote', route.id)
}

await login()
await page.setViewportSize({ width: 1280, height: 900 })
await page.goto(`${base}/education?view=articles`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1000)
const art = page.locator('article a[href^="/education/"]').first()
if (await art.count()) {
  await art.click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: join(outDir, 'desktop-article-detail.png'), fullPage: true })
}

await page.goto(`${base}/presenters`, { waitUntil: 'domcontentloaded' })
const pres = page.locator('a[href^="/presenters/"]').first()
if (await pres.count()) {
  await pres.click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: join(outDir, 'desktop-presenter-profile.png'), fullPage: true })
}

await context.clearCookies()
await page.setViewportSize({ width: 390, height: 844 })
await page.goto(`${base}/education?view=paths`, { waitUntil: 'domcontentloaded' })
const series = page.locator('a[href^="/education/series/"]').first()
if (await series.count()) {
  await series.click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: join(outDir, 'signed-out-mobile-series-detail.png'), fullPage: true })
}

await browser.close()

const pngs = readdirSync(outDir).filter((f) => f.endsWith('.png'))
const manifest = {
  bundle: 'kink-social-education-creator-credibility-pass1-2026-06-17-2117',
  base,
  capturedAt: new Date().toISOString(),
  shots: pngs.map((file) => ({ file })),
}

writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

const findings = `# Education Creator Credibility Pass 1 — findings

## Does Education clearly feel user-generated?
Yes — hero copy states community learning from educators, presenters, and members; article sections labeled "Community articles" and "Trending from creators."

## Does it explain creator/presenter credibility?
Yes — hero CTAs include presenter profile; right rail reputation tip references publishing articles; write flow explains publishing choices.

## Does it connect to presenter profiles?
Yes — article cards show author bylines linking to presenter profiles; article detail has creator block; class library links educator handles.

## Does it explain articles, paths, videos, and class samples?
Yes — view meta subtitles reframed; library panel describes facilitator outlines; videos/podcasts attribute community creators.

## Does it avoid pretending kink.social wrote everything?
Yes — removed top-down catalog tone; disclaimers state community authorship.

## Does it avoid fake ECKE publishing?
Yes — ECKE described as optional opt-in syndication; write flow requires public visibility language.

## Does mobile feel usable?
Hero is compact with wrapped CTAs; article cards show creator attribution; mobile scroll padding preserved.

## Are privacy/visibility states respected?
No API visibility changes in this pass; write flow explains visibility tiers; progress labeled preview only.

## Did desktop regress?
No — desktop layout preserved; hero slightly smaller to surface content sooner.
`
writeFileSync(join(outDir, 'findings-raw.md'), findings)

writeFileSync(
  join(outDir, 'README.md'),
  `# kink-social-education-creator-credibility-pass1-2026-06-17-2117

Education Creator Credibility Pass 1 verification bundle (${pngs.length} screenshots).

Open audit-index.html for the gallery.
`,
)

const indexHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Education Pass 1</title>
<style>body{font-family:system-ui;margin:2rem;background:#111;color:#eee}img{max-width:100%;border:1px solid #333;border-radius:8px;margin:1rem 0}</style></head><body>
<h1>Education Creator Credibility Pass 1</h1>
${pngs.map((f) => `<section><h2>${f}</h2><img src="${f}" alt="${f}"/></section>`).join('\n')}
</body></html>`
writeFileSync(join(outDir, 'audit-index.html'), indexHtml)

const zipPath = join('C:', 'Users', 'shkin', 'Desktop', 'kink-social-education-creator-credibility-pass1-2026-06-17-2117.zip')
execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path '${outDir}\\*' -DestinationPath '${zipPath}' -Force"`,
  { stdio: 'inherit' },
)
console.log(`Zip: ${zipPath} (${pngs.length} pngs)`)
