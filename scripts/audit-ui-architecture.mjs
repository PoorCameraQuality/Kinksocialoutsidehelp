#!/usr/bin/env node
/**
 * UI architecture audit orchestrator — runs all audit phases and composes risk report.
 * Usage: npm run audit:ui-architecture [-- --skip-screenshots] [-- --skip-runtime] [-- --skip-preflight]
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOCS_DIR, OUT_DIR, readText, writeJson } from './audit-ui-shared.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const args = process.argv.slice(2)
const skipScreenshots = args.includes('--skip-screenshots')
const skipRuntime = args.includes('--skip-runtime')
const skipStatic = args.includes('--skip-static')
const skipPreflight = args.includes('--skip-preflight')

function run(label, script, { failLoud = false } = {}) {
  console.log(`\n=== ${label} ===`)
  const res = spawnSync(process.execPath, [path.join(__dirname, script)], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  })
  if (res.status !== 0) {
    if (failLoud) {
      console.error(`\n${label} FAILED (exit ${res.status}) — aborting audit`)
      process.exit(res.status ?? 1)
    }
    console.warn(`${label} exited with code ${res.status} — continuing`)
  }
  return res.status === 0
}

function loadJson(name) {
  const p = path.join(OUT_DIR, name)
  if (!fs.existsSync(p)) return null
  return JSON.parse(readText(p))
}

function buildRiskReport(data) {
  const { routes, components, mobile, design, screenshots, preflight } = data
  const generatedAt = new Date().toISOString()

  const routeList = routes?.routes ?? []
  const onboardingBlocked = routeList.filter((r) => r.onboardingRedirect && r.kind === 'page').length
  const authMismatches = routes?.authMismatches?.length ?? 0
  const orphans = routes?.orphans?.length ?? 0
  const highDupes = (components?.duplicates ?? []).filter((d) => d.severity === 'high').length
  const missingContract = (components?.contractGaps ?? []).filter((c) => c.status === 'missing').length
  const partialContract = (components?.contractGaps ?? []).filter((c) => c.status === 'partial' || c.status === 'duplicate').length
  const mobileResults = mobile?.results ?? []
  const mobileIssues = mobileResults.flatMap((r) => r.issues ?? [])
  const p1Count = mobileIssues.filter((i) => i.severity === 'P1').length
  const p2Count = mobileIssues.filter((i) => i.severity === 'P2').length
  const screenshotCount = screenshots?.captureCount ?? 0
  const authCaptureCount = screenshots?.authCaptureCount ?? 0
  const skippedCaptures = screenshots?.skippedCount ?? 0
  const loginWallCaptures = screenshots?.loginWallCount ?? 0
  const preflightOk = preflight?.ok ?? null

  const lines = [
    '# UI Redesign Risk Report — kink.social',
    '',
    `Generated: ${generatedAt.slice(0, 10)} via \`npm run audit:ui-architecture\``,
    '',
    'Synthesis of the UI architecture audit packet. **Do not redesign pages individually** — migrate templates and primitives first.',
    '',
    '## Audit packet index',
    '',
    '| Document | Purpose |',
    '|----------|---------|',
    '| [`UI_ROUTE_INVENTORY.md`](UI_ROUTE_INVENTORY.md) | All routes, layouts, access, onboarding gates |',
    '| [`UI_COMPONENT_INVENTORY.md`](UI_COMPONENT_INVENTORY.md) | Shared components, duplicates, contract gaps |',
    '| [`UI_MOBILE_AUDIT.md`](UI_MOBILE_AUDIT.md) | Screenshots + automated mobile issues |',
    '| [`UI_DESIGN_SYSTEM_AUDIT.md`](UI_DESIGN_SYSTEM_AUDIT.md) | Tokens, hardcodes, stale config |',
    '| **This file** | Migration risks and recommended execution order |',
    '',
    '## Executive summary',
    '',
    `- **Preflight (Postgres + auth):** ${preflightOk === null ? 'not run' : preflightOk ? 'passed' : 'FAILED'}`,
    `- **Router entries documented:** ${routeList.length}`,
    `- **Routes blocked by onboarding gate:** ${onboardingBlocked}`,
    `- **AuthGate / registry mismatches:** ${authMismatches}`,
    `- **Orphan page files:** ${orphans}`,
    `- **High-severity component duplications:** ${highDupes}`,
    `- **Proposed contract primitives missing:** ${missingContract}; partial/duplicate: ${partialContract}`,
    `- **Automated mobile issues (P1/P2):** ${p1Count}/${p2Count}`,
    `- **Screenshots captured:** ${screenshotCount} (${authCaptureCount} authenticated; ${skippedCaptures} skipped; ${loginWallCaptures} login-wall)`,
    '',
    '## Top migration risks',
    '',
    '| Risk | Evidence | Why page-by-page redesign fails |',
    '|------|----------|----------------------------------|',
    '| **Dual/triple design stacks** | `--dc-*` + `--c2k-*` + `--pub-*` + dancecard organizer primitives | Visual polish on one page leaves adjacent pages on a different token stack |',
    '| **No unified AppShell** | RootLayout + 8 LeftRails + 3 organizer shells + focused personal shells | Each page reimplements chrome, causing duplicate nav and safe-area bugs |',
    '| **Onboarding global gate** | OnboardingGate redirects ' + onboardingBlocked + ' member routes | Users cannot experience product while onboarding incomplete — blocks contextual onboarding |',
    '| **AuthGate vs public IA** | ' + authMismatches + ' registry/marketing paths require login | Public preview and member IA diverge; landing funnels mislead |',
    '| **116 routes / 5 nav slots** | bottomNav = Home·Explore·Create·Messages·Profile | Features compete for top-level nav without More sheet / role-aware disclosure |',
    '| **Parallel primitives** | ' + highDupes + ' high-severity duplicate groups (Button, Confirm, Panel) | Template migration creates third copies unless primitives consolidate first |',
    '| **Mobile dashboard leakage** | ' + p2Count + ' P2 issues incl. 3-col grids on narrow viewports | Discover pages behave like desktop dashboards on phones |',
    '| **FEATURE_REGISTRY drift** | `/onboarding` is MemberOnboardingWizard; many routes marked public incorrectly | Implementation prompts based on registry alone will ship wrong gates |',
    '',
    '## Mobile nav migration',
    '',
    '**Target primary bottom nav:** Home · Explore · Events · Messages · Me',
    '',
    '| Slot | Current (`site.config.ts`) | Target |',
    '|------|---------------------------|--------|',
    '| 1 | Home | Home |',
    '| 2 | Explore | Explore |',
    '| 3 | **Create** (center) | **Events** |',
    '| 4 | Messages | Messages |',
    '| 5 | Profile | **Me** (profile + More sheet) |',
    '',
    '**Create moves off nav:**',
    '',
    '- FAB on feed and relevant surfaces',
    '- Reuse `CreateMenuDropdown` as contextual sheet',
    '- Page-level CTAs on Events, Groups, Orgs, Posts',
    '',
    '**Me drawer / More sheet:** Groups, Orgs, Education, Vendors, Settings, Safety, Saved, Notifications, organizer entry (role-gated).',
    '',
    'Implementation note: rename Profile → Me is **label/copy only** in this pass; no nav rewire yet.',
    '',
    '## Recommended execution order',
    '',
    '1. **Audit packet** (this pass) — baseline metrics and screenshots',
    '2. **Design system normalization** — `--dc-*` only; retire `--c2k-*` additions; unify Button/Panel/Confirm',
    '3. **Mobile AppShell** — single shell: bottom nav, safe-area, sticky headers, loading states',
    '4. **Role-aware bottom nav** — Home · Explore · Events · Messages · Me + More sheet',
    '5. **Shared page templates** — feed, directory, detail, wizard, dashboard, settings, policy, media',
    '6. **Onboarding repair** — contextual guidance; never mask normal routes indefinitely',
    '7. **Public landing/login/register** — `--pub-*` alignment or bridge to `--dc-*`',
    '8. **Core member surfaces** — Home, Explore, Events, Groups, Profile, Messages',
    '9. **Organizer surfaces** — single OrganizerAppShell path',
    '10. **Moderation and safety** — report/block first-class on mobile cards',
    '11. **PWA polish** — install prompt, offline skeletons, Core Web Vitals',
    '12. **Visual regression** — Playwright screenshot diff on Tier A routes',
    '',
    '## Acceptance criteria by phase',
    '',
    '### Phase 3 — AppShell',
    '- All Tier A routes render without duplicate fixed nav on 360px',
    '- Main content clears bottom nav (`c2k-main-mobile-pb` or successor token)',
    '- Single loading/skeleton pattern per template',
    '',
    '### Phase 5 — Templates',
    '- ≥80% of member routes map to one of 8 templates',
    '- Directories use FilterSheet on mobile, not desktop sidebar',
    '- Wizards have sticky bottom primary action',
    '',
    '### Phase 6 — Onboarding',
    '- New member reaches `/home` without permanent gate',
    '- `/onboarding` skippable where legally safe',
    '- Task prompts replace global redirect for profile photo, privacy, events',
    '',
    '## Issue hotspots (from mobile audit)',
    '',
  ]

  const byRoute = new Map()
  for (const r of mobileResults) {
    if (!r.issues?.length) continue
    const key = r.path
    if (!byRoute.has(key)) byRoute.set(key, [])
    byRoute.get(key).push(...r.issues)
  }
  const sorted = [...byRoute.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 15)
  if (sorted.length === 0) {
    lines.push('_No runtime mobile data — re-run with dev stack up._')
  } else {
    for (const [route, issues] of sorted) {
      lines.push(`- \`${route}\`: ${issues.map((i) => i.problem).slice(0, 3).join('; ')}`)
    }
  }

  lines.push(
    '',
    '## Component consolidation priority',
    '',
    '1. Button (ui vs dancecard)',
    '2. ConfirmDialog + useConfirm',
    '3. Card / Panel / OrganizerPanel',
    '4. TabButton / PillTab / section tabs',
    '5. LeftRail → shared DirectorySidebar or FilterSheet',
    '6. Skeleton / Toast',
    '',
    '## Generated artifacts',
    '',
    '- `docs/audits/ui/generated/routes-enriched.json`',
    '- `docs/audits/ui/generated/components-inventory.json`',
    '- `docs/audits/ui/generated/design-system-audit.json`',
    '- `docs/audits/ui/generated/mobile-issues.json`',
    '- `docs/audits/ui/generated/preflight-report.json`',
    '- `docs/audits/ui/generated/screenshot-manifest.json`',
    '- `docs/audits/ui/screenshots/ui-architecture-audit/*.png`',
    '',
    '## Next step',
    '',
    'Paste the five `docs/UI_*.md` files into your implementation prompt. Cursor should migrate **templates and primitives**, not individual pages.',
    '',
  )

  return lines.join('\n')
}

function main() {
  console.log('UI Architecture Audit — kink.social\n')

  let preflightOk = skipRuntime || skipPreflight

  if (!skipStatic) {
    run('Route inventory', 'audit-ui-route-inventory.mjs')
    run('Component inventory', 'audit-ui-components.mjs')
    run('Design system audit', 'audit-ui-design-system.mjs')
  } else {
    console.log('\n=== Static audits (skipped) ===')
  }

  if (!skipRuntime) {
    if (!skipPreflight) {
      preflightOk = run('Preflight', 'audit-ui-preflight.mjs', { failLoud: true })
    } else {
      console.log('\n=== Preflight (skipped via --skip-preflight) ===')
    }

    if (!skipScreenshots) {
      run('Screenshot capture', 'capture-ui-architecture-screenshots.mjs', { failLoud: true })
    } else {
      console.log('\n=== Screenshot capture (skipped) ===')
    }
    run('Mobile issues audit', 'audit-ui-mobile-issues.mjs', { failLoud: true })
  } else {
    console.log('\n=== Runtime audits (skipped — static only) ===')
  }

  const preflight = loadJson('preflight-report.json')
  const screenshots = loadJson('screenshot-manifest.json')

  const riskMd = buildRiskReport({
    routes: loadJson('routes-enriched.json'),
    components: loadJson('components-inventory.json'),
    mobile: loadJson('mobile-issues.json'),
    design: loadJson('design-system-audit.json'),
    screenshots,
    preflight,
  })

  fs.writeFileSync(path.join(DOCS_DIR, 'UI_REDESIGN_RISK_REPORT.md'), riskMd)

  writeJson(path.join(OUT_DIR, 'audit-manifest.json'), {
    generatedAt: new Date().toISOString(),
    outputs: [
      'docs/UI_ROUTE_INVENTORY.md',
      'docs/UI_COMPONENT_INVENTORY.md',
      'docs/UI_MOBILE_AUDIT.md',
      'docs/UI_DESIGN_SYSTEM_AUDIT.md',
      'docs/UI_REDESIGN_RISK_REPORT.md',
    ],
    skipScreenshots,
    skipRuntime,
    skipPreflight,
    preflightOk: preflight?.ok ?? null,
    authCaptureCount: screenshots?.authCaptureCount ?? null,
  })

  if (!skipRuntime && !skipPreflight && preflight && !preflight.ok) {
    console.error('\n✗ Audit incomplete — preflight failed')
    process.exit(1)
  }

  console.log('\n✓ Audit complete — see docs/UI_*.md')
}

main()
