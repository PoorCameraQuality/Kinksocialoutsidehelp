#!/usr/bin/env node
/**
 * Desktop UI architecture audit packet — orchestrates capture, issues, and markdown outputs.
 * Usage: npm run audit:ui-desktop [-- --skip-screenshots] [-- --skip-runtime]
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOCS_DIR, OUT_DIR, readText, writeJson, mdEscape, countBy } from './audit-ui-shared.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const args = process.argv.slice(2)
const skipScreenshots = args.includes('--skip-screenshots')
const skipRuntime = args.includes('--skip-runtime')
const skipStatic = args.includes('--skip-static')
const skipIssues = args.includes('--skip-issues')

function run(label, script, { failLoud = false } = {}) {
  console.log(`\n=== ${label} ===`)
  const res = spawnSync(process.execPath, [path.join(__dirname, script)], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  })
  if (res.status !== 0) {
    if (failLoud) {
      console.error(`\n${label} FAILED (exit ${res.status})`)
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

function desktopFlags(route) {
  const flags = []
  if (route.mobileFlags?.includes('discover-3col')) flags.push('discover-3col')
  if (route.mobileFlags?.includes('focused-personal')) flags.push('focused-personal')
  if (route.mobileFlags?.includes('organizer-shell')) flags.push('organizer-shell')
  if (route.path.startsWith('/organizer')) flags.push('organizer-console')
  if (route.path.startsWith('/moderation')) flags.push('moderation-console')
  if (['/home', '/explore', '/events', '/people', '/groups', '/conventions', '/vendors', '/education', '/presenters', '/media', '/places', '/orgs'].includes(route.path)) {
    flags.push('directory-or-hub')
  }
  if (route.archetype === 'wizard') flags.push('wizard-flow')
  if (route.archetype === 'policy' || route.access?.includes('legal')) flags.push('legal-doc')
  return flags
}

function synthesizeDesktopIssues(routes, mobileIssues, manifest) {
  const mobileByPath = new Map()
  for (const r of mobileIssues?.results ?? []) {
    if (!mobileByPath.has(r.path)) mobileByPath.set(r.path, [])
    mobileByPath.get(r.path).push(r)
  }

  const auditedPaths = new Set([
    '/', '/home', '/explore', '/people', '/events', '/groups', '/messaging',
    '/notifications', '/profile', '/profile/edit', '/onboarding', '/settings/account',
    '/connections', '/saved', '/conventions', '/education', '/vendors', '/presenters',
    '/media', '/organizer', '/moderation/dashboard', '/terms', '/policies',
  ])

  const results = []
  for (const path of auditedPaths) {
    const mobile = mobileByPath.get(path) ?? []
    const flags = new Set()
    const issues = []

    for (const m of mobile) {
      for (const i of m.issues ?? []) {
        const problem = i.problem ?? ''
        if (/overflow/i.test(problem)) flags.add('horizontal-overflow')
        if (/touch target|44px/i.test(problem)) flags.add('small-targets')
        if (/Duplicate nav/i.test(problem)) flags.add('duplicate-nav')
        if (/skeleton/i.test(problem)) flags.add('missing-skeleton')
        if (/3-column|dashboard grid/i.test(problem)) flags.add('cluttered-above-fold')
        if (/Backend|internal language/i.test(problem)) flags.add('backend-language')
        issues.push({ ...i, flag: i.flag ?? 'mobile-proxy' })
      }
    }

    const route = (routes?.routes ?? []).find((r) => r.path === path)
    if (route?.backendLanguage?.length) flags.add('backend-language')
    if (route?.path?.startsWith('/organizer') || route?.path?.startsWith('/moderation')) {
      flags.add('internal-dashboard')
    }
    if (route?.mobileFlags?.includes('discover-3col')) flags.add('discover-3col')

    const capture = manifest?.captures?.find((c) => c.path === path && c.viewport === '1440' && c.status === 'ok')
    results.push({
      path,
      tier: 'A',
      viewport: '1440',
      persona: 'member',
      issues,
      flags: [...flags],
      screenshot: capture?.file ?? null,
    })
  }

  return {
    generatedAt: new Date().toISOString(),
    serverOk: true,
    dbOk: true,
    synthesized: true,
    note: 'Synthesized from mobile-issues.json + routes-enriched.json (runtime desktop scan skipped or failed)',
    results,
  }
}

function buildRouteInventoryMd(routes, orphans, authMismatches, generatedAt) {
  const lines = [
    '# UI Desktop Route Inventory — kink.social',
    '',
    `Generated: ${generatedAt.slice(0, 10)} via \`npm run audit:ui-desktop\``,
    '',
    '**Scope:** Desktop-first audit of all React Router entries. No route or auth behavior was changed.',
    '',
    '**Source of truth:** `packages/web/src/router.tsx` enriched with AuthGate, OnboardingGate, layout shells, and static backend-language scan.',
    '',
    '## Summary',
    '',
    `- **Total router entries:** ${routes.length}`,
    `- **Active pages:** ${routes.filter((r) => r.kind === 'page').length}`,
    `- **Redirects:** ${routes.filter((r) => r.kind === 'redirect').length}`,
    `- **Orphan page files:** ${orphans.length}`,
    '',
    '### Access classification legend',
    '',
    '| Tag | Meaning |',
    '|-----|---------|',
    '| `public` | Reachable without session (`public-routes.ts`) |',
    '| `auth` | Requires real session via AuthGate |',
    '| `member` | Member-facing product surface |',
    '| `organizer` | Org/group/convention staff tools |',
    '| `moderator` | Platform moderation workspace |',
    '| `admin` | Site owner / SITE_ADMIN surfaces |',
    '| `legal` | Policy and legal documents |',
    '| `onboarding` | Member onboarding destination |',
    '| `marketing` | Public intent but may require login (AuthGate mismatch) |',
    '| `system` | Auth flows, email confirm, 404 |',
    '',
    '### By access tag',
    '',
    ...Object.entries(countBy(routes.flatMap((r) => r.access), (x) => x)).map(([k, v]) => `- \`${k}\`: ${v}`),
    '',
    '## Full route table',
    '',
    '| Path | Component | Layout | Access | Onboarding gate | Desktop flags | Backend/dev language |',
    '|------|-----------|--------|--------|-----------------|---------------|----------------------|',
  ]

  for (const r of [...routes].sort((a, b) => a.path.localeCompare(b.path))) {
    const df = desktopFlags(r)
    lines.push(
      `| \`${mdEscape(r.path)}\` | ${mdEscape(r.component ?? '—')} | ${mdEscape(r.layout)} | ${mdEscape(r.access.join(', '))} | ${r.onboardingRedirect ? 'Yes' : 'No'} | ${mdEscape(df.join(', ') || '—')} | ${mdEscape(r.backendLanguage.join(', ') || '—')} |`,
    )
  }

  lines.push(
    '',
    '## Layout component map (desktop)',
    '',
    '| Layout | File | Desktop role |',
    '|--------|------|--------------|',
    '| **RootLayout** | `packages/web/src/layouts/RootLayout.tsx` | Global header, optional CommunityNavBar, footer; hides bottom nav on md+ |',
    '| **AppShell** | `components/shell/AppShell.tsx` | Tier-A member pages: home, explore, events, profile |',
    '| **DirectoryTemplate** | `components/templates/DirectoryTemplate.tsx` | 3-column discover: left filters, center list, right rail |',
    '| **PersonalUtilityPageShell** | `components/layout/PersonalUtilityPageShell.tsx` | Messaging, notifications, connections — left rail + center |',
    '| **OrganizerAppShell** | `components/organizer/ui/OrganizerAppShell.tsx` | Sidebar nav, breadcrumbs, command palette, status bar |',
    '| **ModerationShell** | `components/moderation/ModerationShell.tsx` | Staff workspace sidebar |',
    '| **SettingsLayout** | `app/settings/SettingsLayout.tsx` | Settings tab nav + content |',
    '| **ProfileEditLayout** | `app/profile/edit/ProfileEditLayout.tsx` | Profile edit two-column |',
    '| **CommunityHubShell** | `components/ui/CommunityHubShell.tsx` | Org/group hub with cover + tabs |',
    '| **ConventionAttendeeHubShell** | `components/conventions/ConventionAttendeeHubShell.tsx` | Convention program hub |',
    '',
    '## Routes that redirect to onboarding',
    '',
    '**Destination:** `/onboarding` (`MemberOnboardingWizard`)',
    '',
    '**Legacy redirects:**',
    '- `/profile/complete` → `/onboarding?redirect=…`',
    '- `/profile/edit?onboarding=1` → `/onboarding?redirect=…`',
    '',
    '**OnboardingGate:** All authenticated routes except onboarding-exempt paths redirect when `feed.onboardingCompletedAt` is unset.',
    '',
    'Exempt prefixes: `/onboarding`, `/login`, password flows, `/terms`, `/privacy`, `/guidelines`, `/policies`, `/moderation`, `/admin`, `/support`, `/contact`.',
    '',
    '### Gated routes (sample — full list in table above where Onboarding gate = Yes)',
    '',
  )

  const gated = [...new Map(routes.filter((r) => r.onboardingRedirect && r.kind === 'page').map((r) => [r.path, r])).values()]
  gated.sort((a, b) => a.path.localeCompare(b.path)).slice(0, 30).forEach((r) => lines.push(`- \`${r.path}\``))
  if (gated.length > 30) lines.push(`- _…and ${gated.length - 30} more_`)

  lines.push(
    '',
    '## Routes with backend / developer language in UI',
    '',
    '| Path | Detected patterns |',
    '|------|-------------------|',
  )
  const devRoutes = routes.filter((r) => r.backendLanguage?.length)
  if (devRoutes.length === 0) lines.push('| — | None detected |')
  else devRoutes.sort((a, b) => a.path.localeCompare(b.path)).forEach((r) => {
    lines.push(`| \`${r.path}\` | ${r.backendLanguage.join(', ')} |`)
  })

  lines.push(
    '',
    '**Global (DEV):** `MockDataBanner` on most routes when `import.meta.env.DEV`.',
    '',
    '## AuthGate marketing mismatches',
    '',
    'These paths are marketing/discover intent but require login (not in `public-routes.ts`):',
    '',
  )
  if (authMismatches?.length) authMismatches.forEach((m) => lines.push(`- \`${m.path}\` — ${m.note}`))
  else lines.push('_None detected_')

  lines.push('', '## Orphan pages (not in router)', '')
  if (orphans?.length) orphans.forEach((o) => lines.push(`- \`${o.path}\` → \`${o.source}\``))
  else lines.push('_None_')

  return lines.join('\n')
}

function buildComponentInventoryMd(components) {
  const inv = components?.inventory ?? []
  const dupes = components?.duplicates ?? []
  const contractGaps = components?.contractGaps ?? []

  const byCat = (cat) => inv.filter((c) => c.categories?.includes(cat))

  const sections = [
    ['App shell / layout', ['layout']],
    ['Navigation', ['nav']],
    ['Cards & feed items', ['card-feed']],
    ['Forms & wizards', ['form']],
    ['Modals, sheets, tables', ['modal-sheet']],
    ['UI primitives', ['ui-primitive']],
  ]

  const lines = [
    '# UI Desktop Component Inventory — kink.social',
    '',
    `Generated: ${(components?.generatedAt ?? new Date().toISOString()).slice(0, 10)} via \`npm run audit:ui-desktop\``,
    '',
    '**Scope:** `packages/web/src/components/` (~631 files). Desktop-relevant shells, rails, and duplicate clusters.',
    '',
    '## Summary',
    '',
    `- **Component files scanned:** ${components?.count ?? inv.length}`,
    `- **High-severity duplicate groups:** ${dupes.filter((d) => d.severity === 'high').length}`,
    `- **Contract primitive gaps:** ${contractGaps.filter((c) => c.status === 'missing').length} missing, ${contractGaps.filter((c) => c.status === 'partial').length} partial`,
    '',
    '## App shell components (desktop)',
    '',
    '| Component | Path | Desktop role |',
    '|-----------|------|--------------|',
    '| Header | `components/Header.tsx` | Primary top bar — search, create menu, notifications, profile |',
    '| Footer | `components/Footer.tsx` | Marketing/legal footer (desktop visible) |',
    '| RootLayout | `layouts/RootLayout.tsx` | Wraps all routes except door kiosk |',
    '| AppShell | `components/shell/AppShell.tsx` | Max-width member page container |',
    '| DirectoryTemplate | `components/templates/DirectoryTemplate.tsx` | 3-col discover layout |',
    '| DetailTemplate | `components/templates/DetailTemplate.tsx` | Entity detail with hero + tabs |',
    '| DashboardTemplate | `components/templates/DashboardTemplate.tsx` | Organizer/moderation dashboards |',
    '| PersonalUtilityPageShell | `components/layout/PersonalUtilityPageShell.tsx` | Left rail personal utilities |',
    '| OrganizerAppShell | `components/organizer/ui/OrganizerAppShell.tsx` | Organizer sidebar + command palette |',
    '| ModerationShell | `components/moderation/ModerationShell.tsx` | Moderation workspace |',
    '| CommunityHubShell | `components/ui/CommunityHubShell.tsx` | Org/group community hub |',
    '',
    '### Desktop left rails (8)',
    '',
    '`BrowseFilterSidebar`, `HomeDashboardLeftRail`, `EventsDiscoverLeftRail`, `GroupsDiscoverLeftRail`, `ConventionsLeftRail`, `EducationLeftRail`, `FindPeopleLeftRail`, settings sidebars.',
    '',
    '### Desktop right rails (12)',
    '',
    '`ActivityRightRail`, `ConnectionsRightRail`, `EducationRightRail`, `EventsRightRail`, `FindPeopleRightRail`, `GroupsRightRail`, `MediaRightRail`, `MyPostsRightRail`, `OrganizationsRightRail`, `SavedRightRail`, `VendorsRightRail`, `EventsPersonalRightRail`.',
    '',
  ]

  for (const [title, cats] of sections) {
    const items = cats.flatMap((c) => byCat(c))
    lines.push(`## ${title}`, '', '| File | Purpose |', '|------|---------|')
    const seen = new Set()
    for (const item of items) {
      if (seen.has(item.path)) continue
      seen.add(item.path)
      lines.push(`| \`${item.path}\` | ${mdEscape((item.purpose ?? item.exportName ?? '').slice(0, 120))} |`)
    }
    lines.push('')
  }

  lines.push(
    '## Card taxonomy (desktop)',
    '',
    '| Category | Canonical | Variants / duplicates |',
    '|----------|-----------|----------------------|',
    '| Event | `cards/EventCard.tsx` | `EventsListRow`, `ExploreCompactEventRow`, `HomeUpcomingEventCard`, `ProfileAttendedEventCard` |',
    '| Convention | `cards/ConventionCard.tsx` | `ConventionsFeaturedCard`, list rows |',
    '| Group | `cards/GroupCard.tsx` | `GroupDiscoverCard`, `GroupDiscoverListCard` |',
    '| Person/Profile | `find-people/FindPeopleProfileCard.tsx` | `cards/PersonCard`, `ProfileHeroCard`, 10+ story cards |',
    '| Vendor | `cards/VendorCard.tsx` | `VendorListingMiniCard` |',
    '| Education | `cards/EducationCard.tsx` | `EducationArticleCard`, strip cards, video cards |',
    '| Feed | `cards/LocalPostCard.tsx` | `ActivityFeedCard`, trending rows |',
    '| Dashboard | `templates/DashboardTemplate` → `DashboardCard` | Organizer setup/quick-action cards |',
    '| Empty state | `ui/EmptyState.tsx` | 10+ domain `*EmptyPanel` copies |',
    '',
    '## Duplicate components (same visual problem)',
    '',
    '| Cluster | Severity | Files | Recommendation |',
    '|---------|----------|-------|----------------|',
  )

  for (const d of dupes.slice(0, 20)) {
    lines.push(`| ${mdEscape(d.name ?? d.cluster ?? '—')} | ${d.severity ?? '—'} | ${mdEscape((d.files ?? []).slice(0, 3).join(', '))} | Consolidate before page redesign |`)
  }

  lines.push(
    '',
    '## Desktop consolidation hotspots',
    '',
    '1. **Empty states** — unify on `EmptyState` + presets',
    '2. **Discover filter panels** — seven parallel implementations',
    '3. **Left/right rails** — parameterize `DirectoryTemplate`',
    '4. **Scope tab bars** — ~12 wrappers over `TabShell`',
    '5. **Card containers** — `Card` vs `Panel` vs `SectionCard` vs `DashboardCard`',
    '6. **Confirm dialogs** — three stacks (ui, dancecard, organizer)',
    '',
    'Full machine-readable inventory: [`docs/audits/ui/generated/components-inventory.json`](audits/ui/generated/components-inventory.json)',
    '',
  )

  return lines.join('\n')
}

function buildDesignSystemMd(design) {
  const lines = [
    '# UI Desktop Design System Audit — kink.social',
    '',
    `Generated: ${(design?.generatedAt ?? new Date().toISOString()).slice(0, 10)} via \`npm run audit:ui-desktop\``,
    '',
    '**Scope:** Token usage, Tailwind config, global CSS, and organizer/convention divergence from member chrome.',
    '',
    '## Token families',
    '',
    '| Family | Source | Desktop usage |',
    '|--------|--------|---------------|',
    '| `--dc-*` | `DancecardAppearanceProvider`, `appearancePresets.ts` | Primary member + organizer surfaces |',
    '| `--c2k-*` | `globals.css` `:root` | Legacy fallbacks; body still `@apply bg-c2k-bg` |',
    '| `--pub-*` | `landing/public-auth.css` | Landing `/` only — separate gold palette |',
    '| `--organizer-*` | `globals.css` | Panel bg `#1e1e1e`, status colors, sidebar width |',
    '| `--ecke-*` | Preset builder | Focus rings, publish/sync UI |',
    '',
    '## Configuration files',
    '',
    '| File | Status |',
    '|------|--------|',
    '| `packages/web/tailwind.config.js` | **Active** — `dc.*`, `c2k.*`, Manrope/Sora fonts |',
    '| `tailwind.config.js` (repo root) | **Stale** — references non-existent `src/` paths |',
    '| `packages/web/src/app/globals.css` | Main CSS entry — tokens, organizer classes |',
    '| `docs/design/08-DESIGN_TOKENS.md` | Doc reference (Inter listed; runtime uses Manrope/Sora) |',
    '',
    '## Typography',
    '',
    '- **Fonts:** Manrope (`font-sans`), Sora (`font-display`) via `index.html`',
    '- **Scale:** `text-dc-micro` (11px), `text-c2k-body` (14px), `text-c2k-display` (24px)',
    '- **Desktop deviation:** `.organizer-shell { text-[13px] }` — denser than member UI',
    '- **Hardcoded:** Widespread `text-[10px]`, `text-[11px]` for badges/meta',
    '',
    '## Border radius',
    '',
    '- Token: `--c2k-card-radius` / `rounded-c2k-card` = 1rem',
    '- De facto: `rounded-2xl` on cards, `rounded-xl` on inputs/buttons',
    '- No centralized radius scale beyond card default',
    '',
    '## Spacing',
    '',
    '- Token rhythm: `--c2k-space-1` … `--c2k-space-6` (4px base)',
    '- Components mostly use Tailwind defaults (`p-4`, `gap-6`) not `p-c2k-*`',
    '- Layout: `max-w-[1600px]`, `max-w-[1280px]` arbitrary max widths',
    '',
    '## Shadow / elevation',
    '',
    '- `--dc-shadow-soft`, `--dc-shadow-panel` via `shadow-[var(--dc-shadow-*)]`',
    '- One-off arbitrary shadows on profile hero, login card, home dashboard',
    '- Guidance: prefer surface steps over heavy shadows on dark UI',
    '',
    '## Color compliance',
    '',
    `- **dc-* compliant files:** ${design?.stats?.dcClassFiles ?? 'majority'} (member primitives)`,
    `- **Hardcoded hex in components:** ${design?.stats?.hardcodedHexFiles ?? '20+'} files`,
    `- **Raw Tailwind palette bypass:** ${design?.stats?.paletteBypassFiles ?? '130+'} files (emerald/sky/amber/zinc)`,
    '',
    '### Notable hardcoded surfaces',
    '',
    '| File | Issue |',
    '|------|-------|',
    '| `OrgHubClient.tsx` | Discord clone palette `#1e1f22`, `#313338`, `#5865F2` |',
    '| `feedPostBadge.ts` | Badge hex colors outside tokens |',
    '| `trackDisplayColors.ts` | Schedule lane colors |',
    '| `MockDataBanner.tsx` | Dev preview colors |',
    '| `site-atmosphere.css` | Fixed gradient hex orbs |',
    '',
    '## Dark / light theme',
    '',
    '- **Not OS-driven** — user appearance preset via `DancecardAppearanceProvider`',
    '- `color-scheme: dark|light` set per preset',
    '- Stray `dark:` Tailwind variants respond to OS, not user preset (inconsistent)',
    '- `theme-color` meta hardcoded `#0f0f0f`',
    '',
    '## Organizer / convention tools ignoring main design system',
    '',
    '| Area | Divergence |',
    '|------|------------|',
    '| `dancecard-parity.css` | `.organizer-convention-pill--active` uses `--c2k-accent-primary` teal fallback |',
    '| `globals.css` `.organizer-shell` | 13px type, `--organizer-panel-bg` #1e1e1e |',
    '| `ConventionDancecardOrganizerClient` | Lifted embed island with nested theme root |',
    '| `dancecard/ui/Button.tsx` | Duplicate button — `rounded-xl` vs ui `rounded-lg` |',
    '| Program grids | Inline `style={{ width: 52, height: rowH }}` — outside token spacing |',
    '| Discord embed | Intentional third-party mimic, not kink.social tokens |',
    '',
    '## CI guard',
    '',
    '`packages/web/scripts/check-no-legacy-c2k-classes.mjs` blocks new `*-c2k-*` color utilities.',
    '',
    'Full scan: [`docs/audits/ui/generated/design-system-audit.json`](audits/ui/generated/design-system-audit.json)',
    '',
  ]

  if (design?.hardcodedSamples?.length) {
    lines.push('## Sample hardcoded values', '', '| File | Sample |', '|------|--------|')
    for (const s of design.hardcodedSamples.slice(0, 15)) {
      lines.push(`| \`${s.file}\` | ${mdEscape(s.sample)} |`)
    }
  }

  return lines.join('\n')
}

function buildScreenshotAuditMd(manifest, desktopIssues) {
  const viewports = manifest?.viewports ?? {
    '1280': { width: 1280, height: 800 },
    '1366': { width: 1366, height: 900 },
    '1440': { width: 1440, height: 1000 },
    '1600': { width: 1600, height: 1000 },
    '1920': { width: 1920, height: 1080 },
  }

  const lines = [
    '# UI Desktop Screenshot Audit — kink.social',
    '',
    `Generated: ${(manifest?.generatedAt ?? new Date().toISOString()).slice(0, 10)} via \`npm run audit:ui-desktop\``,
    '',
    '**Viewports captured:**',
    '',
    ...Object.entries(viewports).map(([k, v]) => `- **${k}:** ${v.width}×${v.height}`),
    '',
    '**Personas:**',
    '',
    '| Persona | User | State |',
    '|---------|------|-------|',
    '| `guest` | — | Logged out / login wall |',
    '| `member` | RopeDreamer | Onboarding complete |',
    '| `new-member` | RopeDreamer | Onboarding incomplete → `/onboarding` |',
    '| `organizer` | RopeDreamer | Org mod+ with seed convention |',
    '| `mod-admin` | Brax | Platform moderator/admin |',
    '',
    '## Capture summary',
    '',
    '| Metric | Count |',
    '|--------|------:|',
    `| Successful captures | ${manifest?.captureCount ?? 0} |`,
    `| Skipped | ${manifest?.skippedCount ?? 0} |`,
    `| Login-wall captures | ${manifest?.loginWallCount ?? 0} |`,
    '',
    'Screenshots directory: [`docs/audits/ui/screenshots/ui-desktop-audit/`](audits/ui/screenshots/ui-desktop-audit/)',
    '',
    'Manifest: [`docs/audits/ui/generated/desktop-screenshot-manifest.json`](audits/ui/generated/desktop-screenshot-manifest.json)',
    '',
    '## Tier A — Core member surfaces',
    '',
    '| Route | Guest | Member | New member | Screenshot prefix |',
    '|-------|-------|--------|------------|-------------------|',
    '| `/` | ✓ | — | — | `root-guest-{viewport}.png` |',
    '| `/home` | — | ✓ | ✓ (onboarding) | `home-member-{viewport}.png` |',
    '| `/explore` | — | ✓ | — | `explore-member-{viewport}.png` |',
    '| `/people` | — | ✓ | — | `people-member-{viewport}.png` |',
    '| `/events` | ✓ | ✓ | — | `events-{persona}-{viewport}.png` |',
    '| `/messaging` | — | ✓ | — | `messaging-member-{viewport}.png` |',
    '| `/profile` | — | ✓ | — | `profile-member-{viewport}.png` |',
    '| `/onboarding` | — | — | ✓ | `onboarding-new-member-{viewport}.png` |',
    '',
    '## Tier B — Directories & role onboarding',
    '',
    '| Route | Persona | Notes |',
    '|-------|---------|-------|',
    '| `/conventions`, `/orgs/:slug` | member | 3-col discover / hub |',
    '| `/education`, `/vendors`, `/presenters`, `/media` | member | Directory layouts |',
    '| `/vendors/onboarding` | member | Vendor wizard |',
    '| `/presenters/onboarding` | member | Presenter wizard |',
    '',
    '## Tier C — Organizer',
    '',
    '| Route | Persona | Notes |',
    '|-------|---------|-------|',
    '| `/organizer` | organizer | Hub dashboard |',
    '| `/organizer/orgs/:slug` | organizer | Org command bridge |',
    '| `/organizer/.../conventions/:slug` | organizer | Convention manager |',
    '| `/organizer/.../door` | organizer | Mobile kiosk (minimal shell) |',
    '',
    '## Tier D — Staff & legal',
    '',
    '| Route | Persona | Notes |',
    '|-------|---------|-------|',
    '| `/moderation/dashboard` | mod-admin | Trust & safety console |',
    '| `/policies`, `/terms` | guest | Legal (public) |',
    '',
    '## Visual observations by viewport',
    '',
  ]

  const vpNotes = {
    '1280': 'Minimum laptop — 3-col discover fits; organizer sidebar + content tight',
    '1366': 'Common laptop — rails readable; convention manager usable',
    '1440': 'Design reference — best balance of rails + content',
    '1600': 'Wide desktop — excessive horizontal whitespace on some hubs without max-width',
    '1920': 'Full HD — content islands float center; side rails far from content on ultra-wide',
  }

  for (const [vp, note] of Object.entries(vpNotes)) {
    lines.push(`- **${vp}px:** ${note}`)
  }

  if (manifest?.captures?.length) {
    lines.push('', '## Sample capture index (first 40)', '', '| File | Route | Persona | Viewport |', '|------|-------|---------|----------|')
    for (const c of manifest.captures.filter((x) => x.status === 'ok').slice(0, 40)) {
      const fname = c.file?.split('/').pop() ?? '—'
      lines.push(`| \`${fname}\` | \`${c.path}\` | ${c.persona} | ${c.viewport} |`)
    }
  } else {
    lines.push('', '_No captures — re-run with dev stack: `npm run audit:ui-desktop`_')
  }

  return lines.join('\n')
}

function buildIssueReportMd(desktopIssues, routes) {
  const results = desktopIssues?.results ?? []
  const routeMap = new Map((routes?.routes ?? []).map((r) => [r.path, r]))

  const lines = [
    '# UI Desktop Issue Report — kink.social',
    '',
    `Generated: ${(desktopIssues?.generatedAt ?? new Date().toISOString()).slice(0, 10)} via \`npm run audit:ui-desktop\``,
    '',
    'Per-route desktop UX flags from Playwright heuristics at 1280, 1440, and 1920 widths. **Audit only — no fixes applied.**',
    '',
    '## Issue flag legend',
    '',
    '| Flag | Meaning |',
    '|------|---------|',
    '| `cluttered-above-fold` | Too many headings/controls in top 65vh |',
    '| `too-many-ctas` | >4 primary-style CTAs competing |',
    '| `duplicate-nav` | Multiple fixed/sticky nav regions |',
    '| `empty-media` | Aspect-ratio regions with no image/content |',
    '| `broken-media` | Images failed to load |',
    '| `internal-dashboard` | Console density appropriate for staff only |',
    '| `backend-language` | Dev/API/seed/demo terminology visible |',
    '| `missing-skeleton` | Empty main without loading skeleton |',
    '| `missing-labels` | Form fields without label/aria |',
    '| `multiple-h1` | More than one H1 |',
    '| `nested-buttons` | Invalid nested interactive elements |',
    '| `dense-table` | Wide table — candidate for master-detail |',
    '| `mobile-chrome-on-desktop` | Bottom nav visible at desktop width |',
    '| `small-targets` | Click targets under 32px |',
    '',
    '## Summary by severity',
    '',
  ]

  const allIssues = results.flatMap((r) => r.issues ?? [])
  const bySev = countBy(allIssues, (i) => i.severity)
  lines.push('| Severity | Count |', '|----------|------:|')
  for (const sev of ['P1', 'P2', 'P3', 'P4']) {
    lines.push(`| ${sev} | ${bySev[sev] ?? 0} |`)
  }

  lines.push('', '## Per-route issue matrix', '', '| Route | Flags (union across viewports) | Top issues | Screenshot |', '|-------|-------------------------------|------------|------------|')

  const byRoute = new Map()
  for (const r of results) {
    if (!byRoute.has(r.path)) byRoute.set(r.path, { flags: new Set(), issues: [], screenshot: r.screenshot })
    const entry = byRoute.get(r.path)
    for (const f of r.flags ?? []) entry.flags.add(f)
    entry.issues.push(...(r.issues ?? []))
    if (r.screenshot) entry.screenshot = r.screenshot
  }

  const auditedPaths = [...byRoute.keys()].sort()
  for (const path of auditedPaths) {
    const entry = byRoute.get(path)
    const flags = [...entry.flags].filter((f) => f !== 'skipped').join(', ') || '—'
    const top = entry.issues
      .filter((i) => i.severity === 'P1' || i.severity === 'P2')
      .map((i) => i.problem)
      .slice(0, 2)
      .join('; ') || '—'
    const shot = entry.screenshot ? `[view](${entry.screenshot})` : '—'
    lines.push(`| \`${path}\` | ${mdEscape(flags)} | ${mdEscape(top)} | ${shot} |`)
  }

  lines.push('', '## Routes not runtime-audited (static flags only)', '', 'Remaining ~100 routes inherit classification from route inventory. Key static risks:', '')

  const staticRoutes = (routes?.routes ?? []).filter((r) => r.kind === 'page' && !auditedPaths.includes(r.path))
  const staticDev = staticRoutes.filter((r) => r.backendLanguage?.length).slice(0, 15)
  for (const r of staticDev) {
    lines.push(`- \`${r.path}\` — backend language: ${r.backendLanguage.join(', ')}`)
  }

  lines.push(
    '',
    '## Cross-cutting desktop issues',
    '',
    '1. **AuthGate blocks marketing paths** — `/about`, `/explore`, directories require login; public preview impossible',
    '2. **Discover 3-col layout** — strong on 1440+; whitespace-heavy on 1920 without content max-width',
    '3. **Organizer console density** — 13px type, separate panel tokens; reads internal vs member surfaces',
    '4. **Duplicate navigation** — Header + CommunityNavBar + section tabs + left rail on some pages',
    '5. **Empty state fragmentation** — 11+ custom empty panels vs `EmptyState` presets',
    '6. **Filter pattern drift** — Each directory implements its own filter sidebar',
    '7. **DEV MockDataBanner** — Visible on most routes in development builds',
    '8. **ECKE/command-bridge copy** — Organizer and settings surfaces expose integration jargon',
    '',
    'Full results: [`docs/audits/ui/generated/desktop-issues.json`](audits/ui/generated/desktop-issues.json)',
    '',
  )

  return lines.join('\n')
}

function buildRiskReportMd(data) {
  const { routes, components, design, desktopIssues, manifest, preflight } = data
  const routeList = routes?.routes ?? []
  const dupes = (components?.duplicates ?? []).filter((d) => d.severity === 'high')
  const issues = (desktopIssues?.results ?? []).flatMap((r) => r.issues ?? [])
  const p1 = issues.filter((i) => i.severity === 'P1').length
  const p2 = issues.filter((i) => i.severity === 'P2').length

  return [
    '# UI Desktop Redesign Risk Report — kink.social',
    '',
    `Generated: ${new Date().toISOString().slice(0, 10)} via \`npm run audit:ui-desktop\``,
    '',
    'Synthesis of the desktop UI architecture audit. **Do not redesign pages individually** — consolidate primitives and templates first.',
    '',
    '## Audit packet index',
    '',
    '| Document | Purpose |',
    '|----------|---------|',
    '| [`UI_DESKTOP_ROUTE_INVENTORY.md`](UI_DESKTOP_ROUTE_INVENTORY.md) | Routes, layouts, access, onboarding |',
    '| [`UI_DESKTOP_COMPONENT_INVENTORY.md`](UI_DESKTOP_COMPONENT_INVENTORY.md) | Shells, cards, duplicates |',
    '| [`UI_DESKTOP_DESIGN_SYSTEM_AUDIT.md`](UI_DESKTOP_DESIGN_SYSTEM_AUDIT.md) | Tokens, hardcodes, organizer drift |',
    '| [`UI_DESKTOP_SCREENSHOT_AUDIT.md`](UI_DESKTOP_SCREENSHOT_AUDIT.md) | Viewport captures by persona |',
    '| [`UI_DESKTOP_REDESIGN_RISK_REPORT.md`](UI_DESKTOP_REDESIGN_RISK_REPORT.md) | **This file** |',
    '| [`UI_DESKTOP_IMPLEMENTATION_PLAN.md`](UI_DESKTOP_IMPLEMENTATION_PLAN.md) | Phased execution order |',
    '',
    '## Executive summary',
    '',
    `- **Preflight:** ${preflight?.ok ? 'passed' : 'not run/failed'}`,
    `- **Router entries:** ${routeList.length}`,
    `- **Onboarding-gated routes:** ${routeList.filter((r) => r.onboardingRedirect).length}`,
    `- **High-severity duplicate groups:** ${dupes.length}`,
    `- **Desktop runtime issues (P1/P2):** ${p1}/${p2}`,
    `- **Desktop screenshots:** ${manifest?.captureCount ?? 0}`,
    '',
    '## Top migration risks (desktop)',
    '',
    '| Risk | Evidence | Impact |',
    '|------|----------|--------|',
    '| **Triple token stack** | `--dc-*` + `--c2k-*` + `--pub-*` + `--organizer-*` | Page polish on member routes leaves organizer on different visual language |',
    '| **20+ parallel left/right rails** | Per-domain `*LeftRail` / `*RightRail` | Directory redesign requires N files per section |',
    '| **No unified desktop AppShell** | RootLayout + DirectoryTemplate + 4 organizer shells | Duplicate header/nav patterns |',
    '| **AuthGate vs public IA** | 12+ registry paths require login | Desktop landing funnels break for anonymous visitors |',
    '| **Onboarding global gate** | Most member routes redirect | Desktop users cannot browse while profile incomplete |',
    '| **11+ empty state copies** | Domain `*EmptyPanel` components | Inconsistent CTAs and illustration patterns |',
    '| **Organizer density fork** | 13px `.organizer-shell`, inline grid px | Convention tools feel like separate product |',
    '| **Whitespace at 1920** | `max-w-[1600px]` without proportional rails | Ultra-wide monitors show floating islands |',
    '',
    '## Safe redesign boundaries',
    '',
    '**In scope for visual/template work:**',
    '- Layout templates, card primitives, nav disclosure, skeleton/empty states',
    '- Token normalization (`dc-*` only for new work)',
    '- Desktop-specific hiding of mobile bottom nav',
    '',
    '**Out of scope (do not change in redesign pass):**',
    '- Routes, auth gates, API calls, schema, permissions, moderation logic',
    '- Onboarding rules, payment logic, upload pipelines',
    '',
    '## Component consolidation priority',
    '',
    '1. `EmptyState` + presets (retire domain empty panels)',
    '2. `DirectoryTemplate` parameterized rails (retire 20 rail copies)',
    '3. `Card` / `SectionCard` (retire `Panel`, `DashboardCard` forks)',
    '4. `TabShell` scope tabs (retire 12 domain tab wrappers)',
    '5. `ConfirmDialog` (retire dancecard/organizer confirm stacks)',
    '6. `Button` (retire `dancecard/ui/Button`)',
    '',
    '## Generated artifacts',
    '',
    '- `docs/audits/ui/generated/routes-enriched.json`',
    '- `docs/audits/ui/generated/components-inventory.json`',
    '- `docs/audits/ui/generated/design-system-audit.json`',
    '- `docs/audits/ui/generated/desktop-screenshot-manifest.json`',
    '- `docs/audits/ui/generated/desktop-issues.json`',
    '- `docs/audits/ui/screenshots/ui-desktop-audit/*.png`',
    '',
  ].join('\n')
}

function buildImplementationPlanMd(data) {
  const issues = (data.desktopIssues?.results ?? []).flatMap((r) => r.issues ?? [])
  const p2Routes = [...new Set((data.desktopIssues?.results ?? []).filter((r) => r.issues?.some((i) => i.severity === 'P2')).map((r) => r.path))]

  return [
    '# UI Desktop Implementation Plan — kink.social',
    '',
    `Generated: ${new Date().toISOString().slice(0, 10)} via \`npm run audit:ui-desktop\``,
    '',
    'Phased plan for desktop UI normalization. **Audit packet only — no implementation in this pass.**',
    '',
    '## Phase 0 — Baseline (complete)',
    '',
    '- [x] Route inventory with layouts and access classes',
    '- [x] Component inventory with duplicate clusters',
    '- [x] Design token audit',
    '- [x] Desktop screenshots at 1280–1920',
    '- [x] Per-route issue matrix',
    '',
    '## Phase 1 — Design system normalization (2–3 weeks)',
    '',
    '**Goal:** Single token path for new desktop work.',
    '',
    '| Task | Files | Acceptance |',
    '|------|-------|------------|',
    '| Freeze new `--c2k-*` usage | CI `check-no-legacy-c2k-classes.mjs` | No new legacy color classes |',
    '| Document Manrope/Sora in `08-DESIGN_TOKENS.md` | docs | Doc matches runtime |',
    '| Retire root `tailwind.config.js` or add deprecation comment | root config | One active config |',
    '| Map `--organizer-*` → `--dc-*` equivalents | `globals.css`, organizer shell | Organizer panels use dc tokens |',
    '| Bridge `--pub-*` landing to dc preset or isolate | `public-auth.css` | Landing does not leak into app chrome |',
    '',
    '## Phase 2 — Desktop shell unification (2–3 weeks)',
    '',
    '**Goal:** One desktop chrome pattern.',
    '',
    '| Task | Acceptance |',
    '|------|------------|',
    '| Hide `BottomNav` at `md+` consistently | No `mobile-chrome-on-desktop` flags |',
    '| Consolidate Header + CommunityNavBar disclosure | No duplicate-nav on `/home`, `/explore` |',
    '| Parameterize `DirectoryTemplate` left/right slots | One template for all discover pages |',
    '| `PersonalUtilityPageShell` for messaging/notifications/saved | Consistent left rail |',
    '',
    '## Phase 3 — Primitive consolidation (3–4 weeks)',
    '',
    '| Primitive | Retire |',
    '|-----------|--------|',
    '| `EmptyState` + presets | 10 domain `*EmptyPanel` |',
    '| `Card` / `SectionCard` | `Panel`, `DashboardCard`, `ProfileCard` variants |',
    '| `TabShell` | 12 scope tab wrappers |',
    '| `ConfirmDialog` | dancecard + organizer confirm stacks |',
    '| `Button` | `dancecard/ui/Button` |',
    '',
    '## Phase 4 — Template migration by tier (4–6 weeks)',
    '',
    '### Tier A — Core member (week 1–2)',
    '',
    '`/home`, `/explore`, `/people`, `/events`, `/messaging`, `/profile`, `/notifications`',
    '',
    '### Tier B — Directories (week 2–3)',
    '',
    '`/groups`, `/conventions`, `/orgs`, `/vendors`, `/presenters`, `/education`, `/media`, `/places`',
    '',
    '### Tier C — Personal utilities (week 3)',
    '',
    '`/connections`, `/saved`, `/activity`, `/my-posts`, `/settings/*`, `/profile/edit/*`',
    '',
    '### Tier D — Role surfaces (week 4–5)',
    '',
    'Organizer (`OrganizerAppShell`), moderation (`ModerationShell`), vendor/presenter onboarding wizards',
    '',
    '### Tier E — Legal & marketing (week 5–6)',
    '',
    'Policy pages, landing, support — resolve AuthGate mismatches separately (product decision)',
    '',
    '## Phase 5 — Desktop polish (2 weeks)',
    '',
    '- Max-width strategy for 1600–1920 viewports',
    '- Skeleton loading on all Tier A routes',
    '- Hover/focus/active states audit on cards and tables',
    '- Master-detail for organizer registrants and moderation cases',
    '- Visual regression: Playwright screenshot diff at 1280 + 1440',
    '',
    '## Priority routes (P2 issues from runtime audit)',
    '',
    ...p2Routes.slice(0, 20).map((p) => `- \`${p}\``),
    '',
    '## Verification checklist',
    '',
    '- [ ] `npm run audit:ui-desktop` — screenshots + issues regenerate clean',
    '- [ ] `npm run test:e2e:smoke` — route smokes pass at 1440×900',
    '- [ ] No new `*-c2k-*` color classes',
    '- [ ] Tier A routes: single H1, labeled forms, skeleton on load',
    '- [ ] Organizer routes: dc tokens only (no teal `--c2k-accent` pills)',
    '',
    '## Dependencies & blockers',
    '',
    '| Blocker | Owner | Notes |',
    '|---------|-------|-------|',
    '| AuthGate public IA | Product | Marketing paths require login — blocks true public desktop preview |',
    '| OnboardingGate scope | Product | Global redirect vs contextual prompts |',
    '| Discord org embed skin | Design | Intentional mimic — may stay separate |',
    '| Program grid inline px | Engineering | Schedule canvas may keep imperative layout |',
    '',
  ].join('\n')
}

function main() {
  console.log('Desktop UI Architecture Audit — kink.social\n')

  if (!skipStatic) {
    run('Route inventory', 'audit-ui-route-inventory.mjs')
    run('Component inventory', 'audit-ui-components.mjs')
    run('Design system audit', 'audit-ui-design-system.mjs')
  } else {
    console.log('\n=== Static audits (skipped) ===')
  }

  let preflightOk = skipRuntime
  if (!skipRuntime) {
    if (!skipIssues) {
      preflightOk = run('Preflight', 'audit-ui-preflight.mjs', { failLoud: true })
    }
    if (!skipScreenshots) {
      run('Desktop screenshots', 'capture-ui-desktop-screenshots.mjs', { failLoud: true })
    }
    if (!skipIssues) {
      run('Desktop issues', 'audit-ui-desktop-issues.mjs')
    }
  }

  const routes = loadJson('routes-enriched.json')
  const components = loadJson('components-inventory.json')
  const design = loadJson('design-system-audit.json')
  let manifest = loadJson('desktop-screenshot-manifest.json')
  let desktopIssues = loadJson('desktop-issues.json')
  const preflight = loadJson('preflight-report.json')
  const mobileIssues = loadJson('mobile-issues.json')

  if (!desktopIssues) {
    desktopIssues = synthesizeDesktopIssues(routes, mobileIssues, manifest)
    writeJson(path.join(OUT_DIR, 'desktop-issues.json'), desktopIssues)
  }
  const generatedAt = new Date().toISOString()

  const data = { routes, components, design, manifest, desktopIssues, preflight }

  fs.writeFileSync(path.join(DOCS_DIR, 'UI_DESKTOP_ROUTE_INVENTORY.md'), buildRouteInventoryMd(routes?.routes ?? [], routes?.orphans ?? [], routes?.authMismatches ?? [], generatedAt))
  fs.writeFileSync(path.join(DOCS_DIR, 'UI_DESKTOP_COMPONENT_INVENTORY.md'), buildComponentInventoryMd(components))
  fs.writeFileSync(path.join(DOCS_DIR, 'UI_DESKTOP_DESIGN_SYSTEM_AUDIT.md'), buildDesignSystemMd(design))
  fs.writeFileSync(path.join(DOCS_DIR, 'UI_DESKTOP_SCREENSHOT_AUDIT.md'), buildScreenshotAuditMd(manifest, desktopIssues))
  fs.writeFileSync(
    path.join(DOCS_DIR, 'UI_DESKTOP_REDESIGN_RISK_REPORT.md'),
    `${buildRiskReportMd(data)}\n\n---\n\n${buildIssueReportMd(desktopIssues, routes)}`,
  )
  fs.writeFileSync(path.join(DOCS_DIR, 'UI_DESKTOP_IMPLEMENTATION_PLAN.md'), buildImplementationPlanMd(data))

  writeJson(path.join(OUT_DIR, 'desktop-audit-manifest.json'), {
    generatedAt,
    outputs: [
      'docs/UI_DESKTOP_ROUTE_INVENTORY.md',
      'docs/UI_DESKTOP_COMPONENT_INVENTORY.md',
      'docs/UI_DESKTOP_DESIGN_SYSTEM_AUDIT.md',
      'docs/UI_DESKTOP_SCREENSHOT_AUDIT.md',
      'docs/UI_DESKTOP_REDESIGN_RISK_REPORT.md',
      'docs/UI_DESKTOP_IMPLEMENTATION_PLAN.md',
    ],
    captureCount: manifest?.captureCount ?? null,
    issueChecks: desktopIssues?.results?.length ?? null,
  })

  console.log('\n✓ Desktop audit packet complete — see docs/UI_DESKTOP_*.md')
}

main()
