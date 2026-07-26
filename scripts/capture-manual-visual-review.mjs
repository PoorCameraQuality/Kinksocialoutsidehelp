#!/usr/bin/env node
/**
 * Manual visual review screenshot package — no app changes.
 * Output: docs/audits/ui/screenshots/manual-visual-review/
 * Index: docs/audits/ui/manual-visual-review-index.md
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'
import {
  ROOT,
  VIEWPORTS,
  DEMO_PASSWORD,
  ADMIN_PASSWORD,
  ensureDir,
  writeJson,
} from './audit-ui-shared.mjs'

const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
const OUT_DIR = path.join(ROOT, 'docs/audits/ui/screenshots/manual-visual-review')
const INDEX_MD = path.join(ROOT, 'docs/audits/ui/manual-visual-review-index.md')
const INDEX_JSON = path.join(ROOT, 'docs/audits/ui/generated/manual-visual-review-index.json')
const orgSlug = process.env.E2E_ORG_SLUG ?? 'demo-east-collective'
const convSlug = process.env.E2E_CONV_SLUG ?? 'preview-c2k-weekend'

const MOBILE_VPS = ['360', '390', '430']
const DESKTOP_VP = '1440'
const MAX_FULL_HEIGHT = 5200

/** @type {Array<Record<string, unknown>>} */
const indexRows = []

function mdEscape(s) {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

async function login(request, username, password = DEMO_PASSWORD) {
  const res = await request.post(`${base}/api/auth/session`, {
    data: { username, password },
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok()) throw new Error(`Login failed for ${username}: ${res.status()}`)
}

async function setOnboardingComplete(request, complete) {
  const getRes = await request.get(`${base}/api/settings/me`)
  if (!getRes.ok()) return false
  const data = await getRes.json()
  const feed = { ...(data.feed ?? {}), onboardingCompletedAt: complete ? new Date().toISOString() : null }
  const patch = await request.patch(`${base}/api/settings/me`, {
    data: { feed },
    headers: { 'Content-Type': 'application/json' },
  })
  return patch.ok()
}

async function resolveIds(request) {
  let groupId = null
  let eventId = null
  try {
    await login(request, 'RopeDreamer')
    const gRes = await request.get(`${base}/api/v1/me/groups`)
    if (gRes.ok()) {
      const data = await gRes.json()
      const first = Array.isArray(data) ? data[0] : data?.groups?.[0] ?? data?.items?.[0]
      groupId = first?.id ?? first?.groupId ?? null
    }
    const eRes = await request.get(`${base}/api/v1/events?limit=5`)
    if (eRes.ok()) {
      const data = await eRes.json()
      const items = Array.isArray(data) ? data : data?.events ?? data?.items ?? []
      eventId = items[0]?.id ?? null
    }
  } catch {
    /* demo ids optional */
  }
  return { groupId: 'g1', eventId: '1' }
}

async function setupPersona(context, persona) {
  await context.clearCookies()
  if (persona === 'guest') return
  const password =
    persona === 'mod-admin' ? ADMIN_PASSWORD
    : DEMO_PASSWORD
  const username = persona === 'mod-admin' ? 'Brax' : 'RopeDreamer'
  await login(context.request, username, password)
  if (persona === 'new-member') {
    await setOnboardingComplete(context.request, false)
  } else if (persona !== 'guest') {
    await setOnboardingComplete(context.request, true)
  }
}

async function goto(page, url) {
  let lastErr
  for (let i = 0; i < 2; i++) {
    try {
      await page.goto(`${base}${url}`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      await page.waitForTimeout(400)
      return
    } catch (err) {
      lastErr = err
      await page.waitForTimeout(1500)
    }
  }
  throw lastErr
}

async function scrollTop(page) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)
}

function record(row) {
  indexRows.push(row)
}

async function shot(page, filename, meta) {
  const filePath = path.join(OUT_DIR, filename)
  await page.screenshot({ path: filePath, fullPage: false })
  record({
    filename,
    route: meta.route,
    persona: meta.persona,
    viewport: meta.viewport,
    type: meta.type,
    note: meta.note ?? '',
    knownIssue: meta.knownIssue ?? '',
  })
  console.log('wrote', filename)
}

async function shotFull(page, filename, meta) {
  const filePath = path.join(OUT_DIR, filename)
  await page.screenshot({ path: filePath, fullPage: true })
  record({ filename, ...meta })
  console.log('wrote', filename)
}

async function captureTop(page, vpTag, persona, slug, meta) {
  await scrollTop(page)
  await shot(page, `${vpTag}-${persona}-${slug}-top.png`, { ...meta, viewport: vpTag, persona, type: 'top' })
}

async function captureFullSmart(page, vpTag, persona, slug, meta) {
  await scrollTop(page)
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  if (height <= MAX_FULL_HEIGHT) {
    await shotFull(page, `${vpTag}-${persona}-${slug}-full.png`, { ...meta, viewport: vpTag, persona, type: 'full' })
    return
  }
  await shot(page, `${vpTag}-${persona}-${slug}-top.png`, {
    ...meta,
    viewport: vpTag,
    persona,
    type: 'top',
    note: `${meta.note ?? ''} (section: top — page too tall for single full capture)`.trim(),
  })
  const mid = Math.max(0, Math.floor(height / 2 - (VIEWPORTS[vpTag]?.height ?? 800) / 2))
  await page.evaluate((y) => window.scrollTo(0, y), mid)
  await page.waitForTimeout(250)
  await shot(page, `${vpTag}-${persona}-${slug}-middle.png`, {
    ...meta,
    viewport: vpTag,
    persona,
    type: 'middle',
    note: `${meta.note ?? ''} mid-scroll section`.trim(),
  })
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(250)
  await shot(page, `${vpTag}-${persona}-${slug}-bottom.png`, {
    ...meta,
    viewport: vpTag,
    persona,
    type: 'bottom',
    note: `${meta.note ?? ''} bottom/action area`.trim(),
  })
}

async function runCaptureSet(page, context, ids, spec) {
  const { route, persona, viewports, slug, note, fullPage, setup, knownIssue } = spec
  await setupPersona(context, persona)
  if (setup) await setup(page, ids)

  for (const vpTag of viewports) {
    await page.setViewportSize(VIEWPORTS[vpTag])
    if (route) await goto(page, route)
    if (spec.afterGoto) await spec.afterGoto(page)
    await captureTop(page, vpTag, persona, slug, { route: route ?? slug, note, knownIssue })
    if (fullPage) await captureFullSmart(page, vpTag, persona, slug, { route: route ?? slug, note, knownIssue })
  }
}

function writeIndexMarkdown() {
  const lines = [
    '# Manual Visual Review — Screenshot Index',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    'Package for human visual design review after mobile foundation, template, organizer, and visual polish passes.',
    '',
    `Screenshots directory: [\`screenshots/manual-visual-review/\`](screenshots/manual-visual-review/)`,
    '',
    '| filename | route | persona | viewport | type | note | known issue |',
    '|----------|-------|---------|----------|------|------|-------------|',
  ]
  for (const r of indexRows) {
    lines.push(
      `| ${mdEscape(r.filename)} | ${mdEscape(r.route)} | ${mdEscape(r.persona)} | ${r.viewport} | ${r.type} | ${mdEscape(r.note)} | ${mdEscape(r.knownIssue)} |`,
    )
  }
  lines.push('', `**Total captures:** ${indexRows.length}`, '')
  fs.writeFileSync(INDEX_MD, lines.join('\n'))
  fs.copyFileSync(INDEX_MD, path.join(OUT_DIR, 'manual-visual-review-index.md'))
  writeJson(INDEX_JSON, { generatedAt: new Date().toISOString(), count: indexRows.length, rows: indexRows })
}

async function main() {
  ensureDir(OUT_DIR)
  let browser = await chromium.launch({ headless: true })
  let context = await browser.newContext()
  let page = await context.newPage()
  const ids = await resolveIds(context.request)

  const eventPath = `/events/${ids.eventId}`
  const groupPath = `/groups/${ids.groupId}`

  /** @type {Array<object>} */
  const plan = [
    // —— Public & auth ——
    { route: '/', persona: 'guest', viewports: MOBILE_VPS, slug: 'landing', note: 'Landing signup default', fullPage: true },
    { route: '/', persona: 'guest', viewports: [DESKTOP_VP], slug: 'landing', note: 'Landing desktop', fullPage: true },
    {
      route: '/',
      persona: 'guest',
      viewports: MOBILE_VPS,
      slug: 'landing-login',
      note: 'Login tab',
      afterGoto: async (p) => {
        await p.getByRole('tab', { name: 'Log in' }).click()
      },
    },
    {
      route: '/',
      persona: 'guest',
      viewports: MOBILE_VPS,
      slug: 'landing-register-policies',
      note: 'Signup policy + reassurance block',
      afterGoto: async (p) => {
        await p.getByRole('tab', { name: 'Join free' }).click()
        await p.evaluate(() => {
          const el = document.querySelector('.auth-body')
          el?.scrollIntoView({ block: 'center' })
        })
      },
    },
    { route: '/terms', persona: 'guest', viewports: MOBILE_VPS, slug: 'terms', note: 'Terms page', fullPage: true },
    { route: '/home', persona: 'guest', viewports: MOBILE_VPS, slug: 'login-wall-home', note: 'Protected route login wall / redirect' },

    // —— Core member ——
    { route: '/home', persona: 'member', viewports: MOBILE_VPS, slug: 'home-feed', note: 'Home feed with bottom nav + composer', fullPage: true },
    { route: '/home', persona: 'member', viewports: [DESKTOP_VP], slug: 'home-feed', note: 'Home feed desktop', fullPage: true },
    {
      route: '/home',
      persona: 'member',
      viewports: MOBILE_VPS,
      slug: 'create-sheet',
      note: 'Create FAB sheet open',
      afterGoto: async (p) => {
        const fab = p.getByRole('button', { name: 'Create' })
        if (await fab.isVisible().catch(() => false)) await fab.click()
        else record({ filename: '(skipped)', route: '/home', persona: 'member', viewport: '390', type: 'sheet', note: 'Create FAB not visible', knownIssue: 'FAB hidden — check viewport/auth' })
      },
    },
    { route: '/explore', persona: 'member', viewports: MOBILE_VPS, slug: 'explore', note: 'Explore directory', fullPage: true },
    {
      route: '/explore',
      persona: 'member',
      viewports: MOBILE_VPS,
      slug: 'explore-filter-sheet',
      note: 'FilterSheet open',
      afterGoto: async (p) => {
        const btn = p.getByRole('button', { name: /^Filters/ })
        if (await btn.isVisible().catch(() => false)) await btn.click()
      },
    },
    { route: '/events', persona: 'member', viewports: MOBILE_VPS, slug: 'events-list', note: 'Events directory', fullPage: true },
    {
      route: '/events',
      persona: 'member',
      viewports: MOBILE_VPS,
      slug: 'events-filter-sheet',
      note: 'Events FilterSheet',
      afterGoto: async (p) => {
        const btn = p.getByRole('button', { name: /^Filters/ })
        if (await btn.isVisible().catch(() => false)) await btn.click()
      },
    },
    { route: eventPath, persona: 'member', viewports: MOBILE_VPS, slug: 'event-detail', note: 'Event detail hero + RSVP', fullPage: true },
    { route: eventPath, persona: 'member', viewports: [DESKTOP_VP], slug: 'event-detail', note: 'Event detail desktop', fullPage: true },
    { route: '/messaging', persona: 'member', viewports: MOBILE_VPS, slug: 'messages-inbox', note: 'Messages inbox', fullPage: false },
    {
      route: '/messaging',
      persona: 'member',
      viewports: MOBILE_VPS,
      slug: 'message-thread',
      note: 'Message thread with trust context',
      afterGoto: async (p) => {
        const row = p.locator('[role="listitem"], a[href*="messaging"]').first()
        if (await row.isVisible().catch(() => false)) await row.click()
        await p.waitForTimeout(500)
      },
    },
    { route: '/profile', persona: 'member', viewports: MOBILE_VPS, slug: 'me-profile-hub', note: 'Me tab — account hub + profile story', fullPage: true },
    { route: '/profile/Brax', persona: 'member', viewports: MOBILE_VPS, slug: 'public-profile', note: 'Public profile view', fullPage: true },
    {
      route: '/profile/Brax',
      persona: 'member',
      viewports: MOBILE_VPS,
      slug: 'profile-report-menu',
      note: 'Report profile affordance',
      afterGoto: async (p) => {
        const report = p.getByRole('button', { name: /report profile/i })
        if (await report.isVisible().catch(() => false)) await report.click()
      },
    },
    { route: '/profile/edit', persona: 'member', viewports: MOBILE_VPS, slug: 'profile-edit', note: 'Profile edit / studio', fullPage: true },
    { route: '/home', persona: 'new-member', viewports: MOBILE_VPS, slug: 'home-new-member', note: 'New member home (onboarding incomplete)', fullPage: true },

    // —— Community ——
    { route: '/groups', persona: 'member', viewports: MOBILE_VPS, slug: 'groups-directory', note: 'Groups directory', fullPage: true },
    { route: groupPath, persona: 'member', viewports: MOBILE_VPS, slug: 'group-detail', note: 'Group community hub', fullPage: true },
    { route: `/orgs/${orgSlug}`, persona: 'member', viewports: MOBILE_VPS, slug: 'org-detail', note: 'Organization hub', fullPage: true },
    { route: '/orgs', persona: 'member', viewports: MOBILE_VPS, slug: 'orgs-directory', note: 'Organizations directory', fullPage: true },
    { route: '/orgs/new', persona: 'organizer', viewports: MOBILE_VPS, slug: 'org-create', note: 'Organization creation wizard', fullPage: true },
    { route: `/organizer/orgs/${orgSlug}`, persona: 'organizer', viewports: MOBILE_VPS, slug: 'org-organizer-dashboard', note: 'Org organizer console home', fullPage: true },

    // —— Group / event creation wizards ——
    {
      route: '/groups?create=group',
      persona: 'member',
      viewports: MOBILE_VPS,
      slug: 'group-create-step-1',
      note: 'Group creation step 1 — basics',
    },
    {
      route: '/groups?create=group',
      persona: 'member',
      viewports: MOBILE_VPS,
      slug: 'group-create-step-2',
      note: 'Group creation step 2 — community rules',
      afterGoto: async (p) => {
        await p.getByLabel(/^Name/i).fill('Visual Review Group')
        await p.getByRole('button', { name: 'Continue' }).click().catch(() => {})
        await p.waitForTimeout(300)
      },
    },
    {
      route: '/groups?create=group',
      persona: 'member',
      viewports: MOBILE_VPS,
      slug: 'group-create-step-3',
      note: 'Group creation step 3 — review',
      afterGoto: async (p) => {
        await p.getByLabel(/^Name/i).fill('Visual Review Group')
        await p.getByRole('button', { name: 'Continue' }).click().catch(() => {})
        await p.waitForTimeout(200)
        await p.getByRole('button', { name: 'Continue' }).click().catch(() => {})
        await p.waitForTimeout(300)
      },
    },
    {
      route: '/events?create=event',
      persona: 'member',
      viewports: MOBILE_VPS,
      slug: 'event-create-step-1',
      note: 'Event creation step 1',
    },
    {
      route: '/events?create=event',
      persona: 'member',
      viewports: MOBILE_VPS,
      slug: 'event-create-step-2',
      note: 'Event creation step 2',
      afterGoto: async (p) => {
        await p.getByTestId('create-event-next').click().catch(() => {})
      },
    },
    {
      route: '/events?create=event',
      persona: 'member',
      viewports: MOBILE_VPS,
      slug: 'event-create-step-3',
      note: 'Event creation step 3',
      afterGoto: async (p) => {
        await p.getByTestId('create-event-next').click().catch(() => {})
        await p.waitForTimeout(200)
        await p.getByTestId('create-event-next').click().catch(() => {})
      },
    },
    {
      route: '/events?create=event',
      persona: 'member',
      viewports: MOBILE_VPS,
      slug: 'event-create-step-4',
      note: 'Event creation review / publish step',
      afterGoto: async (p) => {
        for (let i = 0; i < 3; i++) {
          await p.getByTestId('create-event-next').click().catch(() => {})
          await p.waitForTimeout(200)
        }
      },
    },

    // —— Organizer ——
    { route: '/organizer', persona: 'organizer', viewports: MOBILE_VPS, slug: 'organizer-dashboard', note: 'Organizer home dashboard', fullPage: true },
    { route: '/organizer', persona: 'organizer', viewports: [DESKTOP_VP], slug: 'organizer-dashboard', note: 'Organizer dashboard desktop', fullPage: true },
    {
      route: `/organizer/orgs/${orgSlug}/conventions/${convSlug}`,
      persona: 'organizer',
      viewports: MOBILE_VPS,
      slug: 'convention-organizer-dashboard',
      note: 'Convention organizer dashboard',
      fullPage: true,
      knownIssue: 'May timeout if convention seed missing',
    },

    // —— Safety & trust ——
    {
      route: '/profile/Brax',
      persona: 'member',
      viewports: MOBILE_VPS,
      slug: 'report-flow-step-1',
      note: 'Report modal — reason selection',
      afterGoto: async (p) => {
        const report = p.getByRole('button', { name: /report profile/i })
        if (await report.isVisible().catch(() => false)) await report.click()
      },
    },
    {
      route: '/profile/Brax',
      persona: 'member',
      viewports: ['390'],
      slug: 'report-flow-review',
      note: 'Report modal — filled note ready to submit',
      afterGoto: async (p) => {
        const report = p.getByRole('button', { name: /report profile/i })
        if (await report.isVisible().catch(() => false)) await report.click()
        await p.waitForTimeout(200)
        const note = p.locator('textarea').first()
        if (await note.isVisible().catch(() => false)) await note.fill('Visual review capture — test note only.')
      },
    },
    { route: '/settings/account', persona: 'member', viewports: MOBILE_VPS, slug: 'settings-account', note: 'Account settings', fullPage: true },
    {
      route: `/organizer/orgs/${orgSlug}`,
      persona: 'organizer',
      viewports: MOBILE_VPS,
      slug: 'org-management',
      note: 'Organization management console',
      fullPage: true,
    },
    {
      route: groupPath,
      persona: 'organizer',
      viewports: MOBILE_VPS,
      slug: 'group-management',
      note: 'Group page with organizer affordances if member',
      fullPage: true,
    },
    { route: '/policies', persona: 'guest', viewports: MOBILE_VPS, slug: 'policies-hub', note: 'Policies hub', fullPage: true },
    { route: '/settings/privacy', persona: 'member', viewports: MOBILE_VPS, slug: 'privacy-settings', note: 'Privacy and visibility settings', fullPage: true },
    { route: '/settings/blocked', persona: 'member', viewports: MOBILE_VPS, slug: 'safety-blocked', note: 'Blocked accounts / safety settings', fullPage: true },
    {
      route: '/home',
      persona: 'member',
      viewports: MOBILE_VPS,
      slug: 'feed-post-report',
      note: 'Report on feed post (overflow menu)',
      afterGoto: async (p) => {
        const report = p.getByRole('button', { name: /^Report/i }).first()
        if (await report.isVisible().catch(() => false)) {
          await report.click()
          return
        }
        const menu = p.getByRole('button', { name: /more|copy link|menu/i }).first()
        if (await menu.isVisible().catch(() => false)) await menu.click()
      },
    },
    { route: '/moderation/dashboard', persona: 'mod-admin', viewports: MOBILE_VPS, slug: 'moderation-queue', note: 'Moderation dashboard', fullPage: true },
    { route: '/moderation/dashboard', persona: 'mod-admin', viewports: [DESKTOP_VP], slug: 'moderation-queue', note: 'Moderation desktop', fullPage: true },

    // —— Empty / edge states ——
    {
      route: '/events?q=zzzznonexistent999visualreview',
      persona: 'member',
      viewports: MOBILE_VPS,
      slug: 'empty-events-search',
      note: 'No events found empty state',
    },
    {
      route: '/groups?q=zzzznonexistent999visualreview',
      persona: 'member',
      viewports: MOBILE_VPS,
      slug: 'empty-groups-search',
      note: 'No groups found empty state',
    },
    {
      route: '/people?q=zzzznonexistent999visualreview',
      persona: 'member',
      viewports: MOBILE_VPS,
      slug: 'empty-people-search',
      note: 'No search results — people',
    },
  ]

  for (const spec of plan) {
    try {
      await runCaptureSet(page, context, ids, spec)
    } catch (err) {
      console.warn('capture failed', spec.slug, err.message)
      if (String(err.message).includes('has been closed')) {
        await browser.close().catch(() => {})
        const relaunch = await chromium.launch({ headless: true })
        browser = relaunch
        context = await browser.newContext()
        page = await context.newPage()
      }
      for (const vpTag of spec.viewports) {
        record({
          filename: `${vpTag}-${spec.persona}-${spec.slug}-FAILED.txt`,
          route: spec.route ?? spec.slug,
          persona: spec.persona,
          viewport: vpTag,
          type: 'error',
          note: 'Capture failed',
          knownIssue: String(err.message).slice(0, 120),
        })
      }
    }
  }

  await browser.close()
  writeIndexMarkdown()
  console.log(`\nDone: ${indexRows.length} index entries → ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
