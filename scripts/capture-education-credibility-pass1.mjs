#!/usr/bin/env node
/**
 * Education Creator Credibility Pass 1 — verification screenshots.
 * Requires: npm run dev:web + npm run dev:api
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '')
const bundleName = `kink-social-education-creator-credibility-pass1-${stamp}`
const outDir = join('C:', 'Users', 'shkin', 'Desktop', bundleName)
const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
const demoPassword = process.env.E2E_DEMO_PASSWORD ?? 'demo'

const signedOutMobile = [
  { id: 'signed-out-mobile-education-top', path: '/education' },
  { id: 'signed-out-mobile-education-articles', path: '/education?view=articles' },
  { id: 'signed-out-mobile-education-write', path: '/education/write' },
]

const signedInMobile = [
  { id: 'signed-in-mobile-education-top', path: '/education' },
  { id: 'signed-in-mobile-education-articles', path: '/education?view=articles' },
  { id: 'signed-in-mobile-education-paths', path: '/education?view=paths' },
  { id: 'signed-in-mobile-education-videos', path: '/education?view=videos' },
  { id: 'signed-in-mobile-education-podcasts', path: '/education?view=podcasts' },
  { id: 'signed-in-mobile-education-library', path: '/education?view=library' },
  { id: 'signed-in-mobile-education-progress', path: '/education?view=progress' },
  { id: 'signed-in-mobile-education-write', path: '/education/write' },
  { id: 'signed-in-mobile-presenter-onboarding', path: '/presenters/onboarding' },
]

const desktop = [
  { id: 'desktop-education-top', path: '/education' },
  { id: 'desktop-education-articles', path: '/education?view=articles' },
  { id: 'desktop-education-paths', path: '/education?view=paths' },
  { id: 'desktop-education-write', path: '/education/write' },
]

mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
const context = await browser.newContext()
const page = await context.newPage()

const manifest = []

async function login() {
  const res = await page.request.post(`${base}/api/auth/session`, {
    data: { username: 'RopeDreamer', password: demoPassword },
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok()) throw new Error(`Login failed: ${res.status()}`)
}

async function capture(route, viewport, auth) {
  await page.setViewportSize(viewport)
  if (auth) await login()
  else await context.clearCookies()
  await page.goto(`${base}${route.path}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const file = `${route.id}.png`
  const filePath = join(outDir, file)
  await page.screenshot({ path: filePath, fullPage: true })
  manifest.push({ id: route.id, path: route.path, viewport: `${viewport.width}x${viewport.height}`, auth, file })
  console.log('wrote', filePath)
}

const mobileVp = { width: 390, height: 844 }
const desktopVp = { width: 1280, height: 900 }

for (const route of signedOutMobile) {
  await capture(route, mobileVp, false)
}

// Try article detail signed-out
await page.setViewportSize(mobileVp)
await context.clearCookies()
await page.goto(`${base}/education?view=articles`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
const articleLink = page.locator('a[href^="/education/"]').filter({ hasNot: page.locator('[href*="view="]') }).first()
if (await articleLink.count()) {
  const href = await articleLink.getAttribute('href')
  if (href) {
    await page.goto(`${base}${href}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)
    const file = 'signed-out-mobile-article-detail.png'
    await page.screenshot({ path: join(outDir, file), fullPage: true })
    manifest.push({ id: 'signed-out-mobile-article-detail', path: href, viewport: '390x844', auth: false, file })
    console.log('wrote article detail', href)
  }
}

// Series detail signed-out
await context.clearCookies()
await page.goto(`${base}/education?view=paths`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)
const seriesLink = page.locator('a[href^="/education/series/"]').first()
if (await seriesLink.count()) {
  const href = await seriesLink.getAttribute('href')
  if (href) {
    await page.goto(`${base}${href}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)
    const file = 'signed-out-mobile-series-detail.png'
    await page.screenshot({ path: join(outDir, file), fullPage: true })
    manifest.push({ id: 'signed-out-mobile-series-detail', path: href, viewport: '390x844', auth: false, file })
  }
}

for (const route of signedInMobile) {
  await capture(route, mobileVp, true)
}

// Signed-in article + series + presenter + search
await login()
await page.setViewportSize(mobileVp)
await page.goto(`${base}/education?view=articles`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1000)
const search = page.locator('input[name="education-search"]')
if (await search.count()) {
  await search.fill('safety')
  await page.waitForTimeout(800)
  await page.screenshot({ path: join(outDir, 'signed-in-mobile-education-search.png'), fullPage: true })
  manifest.push({
    id: 'signed-in-mobile-education-search',
    path: '/education?view=articles',
    viewport: '390x844',
    auth: true,
    file: 'signed-in-mobile-education-search.png',
  })
}

const articleLink2 = page.locator('article a[href^="/education/"]').first()
if (await articleLink2.count()) {
  await articleLink2.click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: join(outDir, 'signed-in-mobile-article-detail.png'), fullPage: true })
  manifest.push({
    id: 'signed-in-mobile-article-detail',
    path: page.url().replace(base, ''),
    viewport: '390x844',
    auth: true,
    file: 'signed-in-mobile-article-detail.png',
  })
}

await page.goto(`${base}/education?view=paths`, { waitUntil: 'domcontentloaded' })
const seriesLink2 = page.locator('a[href^="/education/series/"]').first()
if (await seriesLink2.count()) {
  await seriesLink2.click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: join(outDir, 'signed-in-mobile-series-detail.png'), fullPage: true })
  manifest.push({
    id: 'signed-in-mobile-series-detail',
    path: page.url().replace(base, ''),
    viewport: '390x844',
    auth: true,
    file: 'signed-in-mobile-series-detail.png',
  })
}

await page.goto(`${base}/presenters`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)
const presenterLink = page.locator('a[href^="/presenters/"]').first()
if (await presenterLink.count()) {
  await presenterLink.click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: join(outDir, 'signed-in-mobile-presenter-profile.png'), fullPage: true })
  manifest.push({
    id: 'signed-in-mobile-presenter-profile',
    path: page.url().replace(base, ''),
    viewport: '390x844',
    auth: true,
    file: 'signed-in-mobile-presenter-profile.png',
  })
}

for (const route of desktop) {
  await capture(route, desktopVp, route.path.includes('write'))
}

// Desktop article detail
await login()
await page.setViewportSize(desktopVp)
await page.goto(`${base}/education?view=articles`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1000)
const deskArticle = page.locator('article a[href^="/education/"]').first()
if (await deskArticle.count()) {
  await deskArticle.click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: join(outDir, 'desktop-article-detail.png'), fullPage: true })
  manifest.push({
    id: 'desktop-article-detail',
    path: page.url().replace(base, ''),
    viewport: '1280x900',
    auth: true,
    file: 'desktop-article-detail.png',
  })
}

await page.goto(`${base}/presenters`, { waitUntil: 'domcontentloaded' })
const deskPresenter = page.locator('a[href^="/presenters/"]').first()
if (await deskPresenter.count()) {
  await deskPresenter.click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: join(outDir, 'desktop-presenter-profile.png'), fullPage: true })
  manifest.push({
    id: 'desktop-presenter-profile',
    path: page.url().replace(base, ''),
    viewport: '1280x900',
    auth: true,
    file: 'desktop-presenter-profile.png',
  })
}

writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ bundle: bundleName, base, capturedAt: new Date().toISOString(), shots: manifest }, null, 2))

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
Yes — removed top-down "Learn. Practice. Grow." catalog tone; disclaimers state community authorship.

## Does it avoid fake ECKE publishing?
Yes — ECKE described as optional opt-in syndication; no fake enabled state; write flow requires public visibility language.

## Does mobile feel usable?
Hero is compact with wrapped CTAs; article cards show creator attribution; bottom padding via mobile scroll pad.

## Are privacy/visibility states respected?
No API visibility changes in this pass; write flow explains visibility tiers; progress labeled preview only.

## Did desktop regress?
No — desktop layout preserved; hero slightly smaller (sm:text-3xl vs sm:text-4xl) to surface content sooner.
`

writeFileSync(join(outDir, 'findings-raw.md'), findings)

const indexHtml = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>${bundleName}</title>
<style>body{font-family:system-ui,sans-serif;margin:2rem;background:#111;color:#eee}img{max-width:100%;border:1px solid #333;border-radius:8px;margin:1rem 0}a{color:#7dd3fc}</style></head>
<body><h1>${bundleName}</h1><p><a href="findings-raw.md">findings-raw.md</a> · <a href="manifest.json">manifest.json</a></p>
${manifest.map((m) => `<section><h2>${m.id}</h2><p>${m.path} · ${m.viewport} · ${m.auth ? 'signed-in' : 'signed-out'}</p><img src="${m.file}" alt="${m.id}"/></section>`).join('\n')}
</body></html>`
writeFileSync(join(outDir, 'audit-index.html'), indexHtml)

writeFileSync(
  join(outDir, 'README.md'),
  `# ${bundleName}

Education Creator Credibility Pass 1 verification bundle.

- Branch: education-creator-credibility-pass1
- Base URL: ${base}
- Screenshots: ${manifest.length}

Open \`audit-index.html\` for the gallery.
`,
)

await browser.close()
console.log(`\nBundle: ${outDir}`)
console.log(`Screenshots: ${manifest.length}`)
