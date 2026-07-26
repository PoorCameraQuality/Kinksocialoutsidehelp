#!/usr/bin/env node
/**
 * Component inventory — categorize shared UI, detect duplicates, map contract gaps.
 * Output: docs/audits/ui/generated/components-inventory.json, docs/UI_COMPONENT_INVENTORY.md
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  ROOT,
  WEB_SRC,
  OUT_DIR,
  DOCS_DIR,
  readText,
  writeJson,
  walk,
  mdEscape,
  countBy,
} from './audit-ui-shared.mjs'

const COMPONENTS_DIR = path.join(WEB_SRC, 'components')
const LAYOUTS_DIR = path.join(WEB_SRC, 'layouts')

const CONTRACT_COMPONENTS = [
  { name: 'AppShell', patterns: [/AppShell/, /RootLayout/] },
  { name: 'MobileBottomNav', patterns: [/BottomNav/] },
  { name: 'DesktopTopNav', patterns: [/Header\.tsx/, /PublicNav/] },
  { name: 'PageHeader', patterns: [/PageHeader/, /SectionHeader/, /ExploreHubHeader/] },
  { name: 'MobileActionBar', patterns: [/StickySubmit/, /MobileActionBar/, /save-bar/i] },
  { name: 'SectionCard', patterns: [/SectionCard/, /FeatureCard/] },
  { name: 'EntityCard', patterns: [/PersonCard/, /OrgCard/, /GroupCard/] },
  { name: 'FeedCard', patterns: [/LocalPostCard/, /ActivityFeedCard/] },
  { name: 'ProfilePreviewCard', patterns: [/ProfilePreview/, /FindPeopleProfileCard/] },
  { name: 'EventCard', patterns: [/EventCard/] },
  { name: 'GroupCard', patterns: [/GroupCard/, /GroupDiscoverCard/] },
  { name: 'OrgCard', patterns: [/OrgCard/, /OrgDirectoryCard/] },
  { name: 'TrustSafetyBadge', patterns: [/TrustRing/, /TrustSafety/, /trust tier/i] },
  { name: 'PrivacyVisibilityChip', patterns: [/PrivacyVisibility/, /visibility chip/i] },
  { name: 'ReportButton', patterns: [/ReportButton/, /ContentReport/, /PlatformReport/, /TsReport/] },
  { name: 'BlockUserButton', patterns: [/BlockUser/, /blocked/i] },
  { name: 'SearchFilterBar', patterns: [/SearchFilter/, /ExploreFilters/, /FindPeopleFilters/] },
  { name: 'FilterSheet', patterns: [/FilterSheet/, /FiltersPanel/] },
  { name: 'Tabs', patterns: [/TabShell/, /TabButton/, /PillTab/, /SectionTabs/] },
  { name: 'BottomSheet', patterns: [/BottomSheet/, /sheet-mobile/, /Dialog.*sheet/i] },
  { name: 'OverflowMenu', patterns: [/OverflowMenu/, /CopyLinkOverflow/] },
  { name: 'WizardShell', patterns: [/WizardShell/, /OnboardingShell/, /CreateFlowWizard/, /WizardUi/] },
  { name: 'StepProgress', patterns: [/StepProgress/, /stepper/i] },
  { name: 'StickySubmitBar', patterns: [/StickySubmit/, /sticky.*bottom/i] },
  { name: 'EmptyState', patterns: [/EmptyState/] },
  { name: 'SkeletonCard', patterns: [/Skeleton/, /C2kSkeleton/, /DancecardSkeleton/] },
  { name: 'UploadDropzone', patterns: [/UploadDropzone/, /PhotoUpload/, /UploadDrop/] },
  { name: 'MediaSafetyNotice', patterns: [/MediaSafety/, /MediaAttestation/, /content warning/i] },
  { name: 'AdvancedDisclosure', patterns: [/AdvancedDisclosure/, /Advanced.*section/i] },
]

const DUPLICATE_GROUPS = [
  {
    id: 'button',
    severity: 'high',
    files: ['components/ui/Button.tsx', 'components/dancecard/ui/Button.tsx'],
    note: 'Twin Button implementations with different size APIs',
  },
  {
    id: 'confirm-dialog',
    severity: 'high',
    files: [
      'components/ui/ConfirmDialog.tsx',
      'hooks/useConfirm.tsx',
      'components/dancecard/organizer/ui/OrganizerConfirmDialog.tsx',
      'components/dancecard/organizer/ui/useConfirmDialog.tsx',
    ],
    note: 'Parallel confirm dialog stacks',
  },
  {
    id: 'card-panel',
    severity: 'high',
    files: [
      'components/ui/Card.tsx',
      'components/dancecard/ui/Panel.tsx',
      'components/ui/ContentPanel.tsx',
      'components/organizer/ui/OrganizerPanel.tsx',
    ],
    note: 'Card vs Panel vs OrganizerPanel containers',
  },
  {
    id: 'left-rails',
    severity: 'medium',
    glob: '**/*LeftRail.tsx',
    note: 'Per-vertical discover/personal left rails (8+ files)',
  },
  {
    id: 'settings-sidebars',
    severity: 'medium',
    glob: '**/Settings*Sidebar.tsx',
    note: 'Repeated settings sub-nav sidebars',
  },
  {
    id: 'organizer-shells',
    severity: 'high',
    files: [
      'components/organizer/ui/OrganizerAppShell.tsx',
      'components/dancecard/organizer/shell/OrganizerEventShell.tsx',
      'layouts/OrganizerScopeShell.tsx',
    ],
    note: 'Three organizer layout systems',
  },
  {
    id: 'skeleton',
    severity: 'medium',
    files: [
      'components/ui/skeleton/C2kSkeleton.tsx',
      'components/dancecard/organizer/ui/DancecardSkeleton.tsx',
    ],
    note: 'Twin skeleton libraries',
  },
  {
    id: 'toast',
    severity: 'low',
    files: [
      'components/ui/AppToast.tsx',
      'components/dancecard/ui/Toast.tsx',
      'components/dancecard/organizer/ui/OrganizerToast.tsx',
    ],
    note: 'Toast re-exports / aliases',
  },
  {
    id: 'community-hub',
    severity: 'medium',
    files: ['components/group/GroupCommunityShell.tsx', 'components/org/OrgCommunityShell.tsx'],
    note: 'Near-identical org/group hub wrappers',
  },
  {
    id: 'public-nav',
    severity: 'low',
    files: ['components/landing/PublicNav.tsx', 'components/landing/MobilePublicNav.tsx'],
    note: 'Twin public landing headers',
  },
  {
    id: 'feed-composers',
    severity: 'medium',
    files: [
      'components/home/HomeFeedRichComposer.tsx',
      'components/home/HomeFeedMockComposer.tsx',
      'components/home/HomeMobileComposer.tsx',
    ],
    note: 'Three feed composer implementations',
  },
  {
    id: 'group-discover-cards',
    severity: 'medium',
    files: ['components/groups/GroupDiscoverCard.tsx', 'components/groups/GroupDiscoverListCard.tsx'],
    note: 'Grid vs list card for same entity',
  },
  {
    id: 'tab-systems',
    severity: 'medium',
    files: [
      'components/ui/TabButton.tsx',
      'components/dancecard/ui/PillTab.tsx',
      'components/groups/GroupsSectionTabs.tsx',
      'components/dancecard/organizer/ui/OrganizerSectionTabs.tsx',
    ],
    note: 'Multiple tab button implementations',
  },
]

const CONSOLIDATION_PLANS = [
  {
    id: 'button',
    canonical: 'components/ui/Button.tsx',
    deprecate: ['components/dancecard/ui/Button.tsx'],
    risk: 'high',
    importPattern: 'components/ui/Button',
    api: '`variant` primary|secondary|ghost|danger; `size` sm|md|lg; mobile min-h-11',
  },
  {
    id: 'confirm-dialog',
    canonical: 'components/ui/ConfirmDialog.tsx + hooks/useConfirm.tsx',
    deprecate: ['components/dancecard/organizer/ui/OrganizerConfirmDialog.tsx', 'useConfirmDialog.tsx'],
    risk: 'high',
    importPattern: 'ConfirmDialog',
    api: 'Promise-based confirm via `useConfirm()`; single portal + focus trap',
  },
  {
    id: 'card-panel',
    canonical: 'components/ui/Card.tsx',
    deprecate: ['components/dancecard/ui/Panel.tsx', 'components/organizer/ui/OrganizerPanel.tsx'],
    risk: 'high',
    importPattern: 'components/ui/Card',
    api: 'Elevated surface with `dc-*` tokens; optional title/footer slots',
  },
  {
    id: 'organizer-shells',
    canonical: 'components/organizer/ui/OrganizerAppShell.tsx',
    deprecate: ['components/dancecard/organizer/shell/OrganizerEventShell.tsx', 'layouts/OrganizerScopeShell.tsx'],
    risk: 'high',
    importPattern: 'OrganizerAppShell',
    api: 'Single organizer frame: sidebar, breadcrumbs, command palette, mobile tab collapse',
  },
  {
    id: 'left-rails',
    canonical: 'NEW: DirectorySidebar or FilterSheet',
    deprecate: ['**/*LeftRail.tsx'],
    risk: 'medium',
    importPattern: 'LeftRail',
    api: 'Desktop sidebar + mobile bottom sheet from one filter state hook',
  },
  {
    id: 'tab-systems',
    canonical: 'components/ui/TabShell.tsx + TabButton.tsx',
    deprecate: ['components/dancecard/ui/PillTab.tsx', 'GroupsSectionTabs', 'OrganizerSectionTabs'],
    risk: 'medium',
    importPattern: 'TabShell',
    api: 'Pill tabs with keyboard roving; scrollable on mobile',
  },
  {
    id: 'form-controls',
    canonical: 'components/ui/FormField.tsx + TextInput.tsx',
    deprecate: ['DatetimeLocalField (organizer-only)', 'inline raw inputs in panels'],
    risk: 'medium',
    importPattern: 'FormField',
    api: 'Label + hint + error; 44px touch targets',
  },
  {
    id: 'modals-sheets',
    canonical: 'components/ui/Dialog.tsx',
    deprecate: ['OrganizerConfirmDialog portal', 'feature-specific modals without Dialog base'],
    risk: 'medium',
    importPattern: 'components/ui/Dialog',
    api: 'centered modal + mobile bottom sheet modes; wizard layout slot',
  },
]

const PRIMITIVE_READINESS = [
  { name: 'AppShell', status: 'missing', nearest: 'layouts/RootLayout.tsx', note: 'No unified mobile frame; chrome split across Header, CommunityNavBar, BottomNav' },
  { name: 'MobileBottomNav', status: 'exists_usable', nearest: 'components/BottomNav.tsx', note: 'Works but Create slot should become FAB/sheet' },
  { name: 'MobileActionBar', status: 'missing', nearest: '—', note: 'Critical for forms, wizards, moderation — no shared sticky submit' },
  { name: 'PageHeader', status: 'exists_not_mobile_ready', nearest: 'components/ui/SectionHeader.tsx', note: 'No sticky/safe-area contract' },
  { name: 'SectionCard', status: 'exists_usable', nearest: 'components/ui/primitives/layout.tsx', note: 'SectionCard + FeatureCard in primitives' },
  { name: 'EntityCard', status: 'exists_duplicated', nearest: 'components/cards/*', note: 'Per-entity cards; grid/list twins for groups' },
  { name: 'FeedCard', status: 'exists_usable', nearest: 'components/cards/LocalPostCard.tsx', note: 'Report/mute access varies by surface' },
  { name: 'WizardShell', status: 'exists_not_mobile_ready', nearest: 'OnboardingShell, CreateFlowWizardUi', note: 'No shared sticky bottom primary action' },
  { name: 'StickySubmitBar', status: 'missing', nearest: '—', note: 'Profile edit save bar is page-local only' },
  { name: 'BottomSheet', status: 'exists_usable', nearest: 'components/ui/Dialog.tsx', note: 'Dialog supports sheet mode' },
  { name: 'FilterSheet', status: 'exists_not_mobile_ready', nearest: '*FiltersPanel.tsx', note: 'Desktop panels; not bottom sheets on mobile' },
  { name: 'EmptyState', status: 'exists_usable', nearest: 'components/ui/EmptyState.tsx', note: '' },
  { name: 'SkeletonCard', status: 'exists_duplicated', nearest: 'C2kSkeleton + DancecardSkeleton', note: 'Twin skeleton systems' },
  { name: 'ReportButton', status: 'exists_usable', nearest: 'ContentReportDialog, PlatformReportForm', note: 'Not on every feed card consistently' },
  { name: 'BlockUserButton', status: 'exists_not_mobile_ready', nearest: 'settings/blocked', note: 'Settings-only; not inline on profiles everywhere' },
  { name: 'PrivacyVisibilityChip', status: 'partial', nearest: 'profile edit panels', note: 'No shared chip component' },
  { name: 'TrustSafetyBadge', status: 'exists_usable', nearest: 'TrustRing, Badge', note: '' },
]

function countImportPattern(pattern) {
  let count = 0
  const files = []
  for (const f of walk(WEB_SRC, [], (p) => p.endsWith('.tsx') || p.endsWith('.ts'))) {
    const content = readText(f)
    if (content.includes(pattern)) {
      count++
      files.push(relPath(f))
    }
  }
  return { count, files: files.slice(0, 8) }
}

function buildConsolidationPlans() {
  return CONSOLIDATION_PLANS.map((plan) => {
    const { count, files } = countImportPattern(plan.importPattern)
    let deprecateFiles = plan.deprecate
    if (plan.deprecate.some((d) => d.includes('*'))) {
      deprecateFiles = resolveGlobPattern(plan.deprecate.find((d) => d.includes('*')) ?? '')
    }
    return { ...plan, importCount: count, sampleFiles: files, deprecateFiles }
  })
}

function statusLabel(s) {
  const map = {
    missing: 'Missing',
    exists_usable: 'Exists and usable',
    exists_duplicated: 'Exists but duplicated',
    exists_not_mobile_ready: 'Exists but not mobile-ready',
    partial: 'Partial',
  }
  return map[s] ?? s
}

function relPath(abs) {
  return path.relative(WEB_SRC, abs).replace(/\\/g, '/')
}

function categorizeFile(rel) {
  const base = path.basename(rel, path.extname(rel))
  const categories = []

  if (rel.startsWith('layouts/') || /Shell|Layout/.test(base)) categories.push('layout')
  if (/Nav|Header|BottomNav|CommunityNavBar|LeftRail|Sidebar/.test(base)) categories.push('nav')
  if (/Form|FormField|TextInput|Combobox|Wizard|Panel/.test(base) && !/Card/.test(base)) {
    categories.push('form')
  }
  if (/Card|Feed|ListRow|List\.tsx/.test(base) || rel.includes('components/cards/')) {
    categories.push('card-feed')
  }
  if (/Dialog|Modal|Drawer|Sheet|Confirm/.test(base)) categories.push('modal-sheet')
  if (rel.startsWith('components/ui/')) categories.push('ui-primitive')

  if (categories.length === 0) categories.push('domain')
  return categories
}

function firstLinePurpose(content) {
  const comment = content.match(/^\/\*\*[\s\S]*?\*\/|^\/\/.*$/m)
  if (comment) return comment[0].replace(/^\/\*\*?\s?|\s?\*\/$/g, '').split('\n')[0].trim().slice(0, 120)
  const exportFn = content.match(/export default function (\w+)/)
  if (exportFn) return `${exportFn[1]} component`
  return '—'
}

function resolveGlobPattern(glob) {
  const results = []
  const parts = glob.replace(/\*\*/g, '').split('/').filter(Boolean)
  const suffix = parts[parts.length - 1].replace('*', '')
  for (const f of walk(WEB_SRC)) {
    const rel = relPath(f)
    if (rel.includes(suffix) && f.endsWith('.tsx')) results.push(rel)
  }
  return results
}

function mapContractGaps(allFiles) {
  const relFiles = allFiles.map(relPath)
  return CONTRACT_COMPONENTS.map(({ name, patterns }) => {
    const matches = relFiles.filter((rel) => patterns.some((p) => p.test(rel) || p.test(readText(path.join(WEB_SRC, rel)).slice(0, 500))))
    let status = 'missing'
    if (matches.length === 1) status = 'exists'
    else if (matches.length > 1) status = 'duplicate'
    else if (matches.length === 0) {
      // partial: related but not exact
      const partial = relFiles.filter((rel) => {
        const key = name.replace(/([A-Z])/g, ' $1').trim().split(' ')[0].toLowerCase()
        return rel.toLowerCase().includes(key)
      })
      if (partial.length) status = 'partial'
    }
    return { name, status, matches: matches.slice(0, 5) }
  })
}

function buildDuplicateMatrix() {
  const rows = []
  for (const group of DUPLICATE_GROUPS) {
    let files = group.files?.map((f) => f.replace(/^components\//, '')) ?? []
    if (group.glob) {
      files = resolveGlobPattern(group.glob)
    }
    const existing = files.filter((f) => fs.existsSync(path.join(WEB_SRC, f)))
    rows.push({
      id: group.id,
      severity: group.severity,
      note: group.note,
      files: existing,
      fileCount: existing.length,
    })
  }
  return rows
}

function buildMarkdown(inventory, duplicates, contractGaps, consolidationPlans, primitiveReadiness, generatedAt) {
  const byCategory = {}
  for (const item of inventory) {
    for (const cat of item.categories) {
      if (!byCategory[cat]) byCategory[cat] = []
      byCategory[cat].push(item)
    }
  }

  const lines = [
    '# UI Component Inventory — kink.social',
    '',
    `Generated: ${generatedAt.slice(0, 10)} via \`npm run audit:ui-architecture\``,
    '',
    '**Scope:** `packages/web/src/components/`, `packages/web/src/layouts/`, and `app/**/layout.tsx`.',
    '',
    '## Summary',
    '',
    `- **Component files scanned:** ${inventory.length}`,
    ...Object.entries(countBy(inventory.flatMap((i) => i.categories), (x) => x)).map(
      ([k, v]) => `- **${k}:** ${v} file assignments`,
    ),
    '',
    '## Layout components',
    '',
    '| File | Purpose |',
    '|------|---------|',
    ...(byCategory.layout ?? [])
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((i) => `| \`${i.path}\` | ${mdEscape(i.purpose)} |`),
    '',
    '## Nav components',
    '',
    '| File | Purpose |',
    '|------|---------|',
    ...(byCategory.nav ?? [])
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((i) => `| \`${i.path}\` | ${mdEscape(i.purpose)} |`),
    '',
    '## Form components',
    '',
    '| File | Purpose |',
    '|------|---------|',
    ...(byCategory.form ?? [])
      .sort((a, b) => a.path.localeCompare(b.path))
      .slice(0, 80)
      .map((i) => `| \`${i.path}\` | ${mdEscape(i.purpose)} |`),
    ...(byCategory.form?.length > 80 ? [`| _…and ${byCategory.form.length - 80} more_ | |`] : []),
    '',
    '## Card / list / feed components',
    '',
    '| File | Purpose |',
    '|------|---------|',
    ...(byCategory['card-feed'] ?? [])
      .sort((a, b) => a.path.localeCompare(b.path))
      .slice(0, 80)
      .map((i) => `| \`${i.path}\` | ${mdEscape(i.purpose)} |`),
    '',
    '## Modal / sheet / dialog components',
    '',
    '| File | Purpose |',
    '|------|---------|',
    ...(byCategory['modal-sheet'] ?? [])
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((i) => `| \`${i.path}\` | ${mdEscape(i.purpose)} |`),
    '',
    '## UI primitives (`components/ui/`)',
    '',
    '| File | Purpose |',
    '|------|---------|',
    ...(byCategory['ui-primitive'] ?? [])
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((i) => `| \`${i.path}\` | ${mdEscape(i.purpose)} |`),
    '',
    '## Duplication matrix',
    '',
    '| Group | Severity | Files | Notes |',
    '|-------|----------|-------|-------|',
    ...duplicates.map(
      (d) =>
        `| ${d.id} | ${d.severity} | ${d.fileCount} | ${mdEscape(d.note)} — ${d.files.slice(0, 3).map((f) => `\`${f}\``).join(', ')}${d.files.length > 3 ? '…' : ''} |`,
    ),
    '',
    '## Component consolidation plan',
    '',
    '| Family | Canonical | Deprecate | Risk | Import refs | Replacement API |',
    '|--------|-----------|-----------|------|-------------|-----------------|',
    ...consolidationPlans.map(
      (p) =>
        `| ${p.id} | ${mdEscape(p.canonical)} | ${p.deprecateFiles.slice(0, 2).map((f) => `\`${f}\``).join(', ')}${p.deprecateFiles.length > 2 ? '…' : ''} | ${p.risk} | ~${p.importCount} | ${mdEscape(p.api)} |`,
    ),
    '',
    '## Contract primitives — readiness matrix',
    '',
    '| Primitive | Status | Nearest file | Notes |',
    '|-----------|--------|--------------|-------|',
    ...primitiveReadiness.map(
      (p) => `| ${p.name} | **${statusLabel(p.status)}** | \`${p.nearest}\` | ${mdEscape(p.note)} |`,
    ),
    '',
    '## Proposed contract gap table (legacy)',
    '',
    '| Primitive | Status | Nearest existing file(s) |',
    '|-----------|--------|--------------------------|',
    ...contractGaps.map(
      (c) => `| ${c.name} | **${c.status}** | ${c.matches.length ? c.matches.map((m) => `\`${m}\``).join(', ') : '—'} |`,
    ),
    '',
    '## Architecture notes',
    '',
    '- **Primary shared layer:** `components/ui/` — intended design system entry point.',
    '- **Parallel stack:** `components/dancecard/` and `components/organizer/` maintain duplicate primitives (Button, Panel, confirm, skeleton).',
    '- **Consolidation priority:** Button → ConfirmDialog → Panel/Card → Tabs → LeftRails before page template migration.',
    '',
  ]

  return lines.join('\n')
}

function main() {
  const tsxFiles = [
    ...walk(COMPONENTS_DIR, [], (p) => p.endsWith('.tsx')),
    ...walk(LAYOUTS_DIR, [], (p) => p.endsWith('.tsx')),
    ...walk(path.join(WEB_SRC, 'app'), [], (p) => p.endsWith('layout.tsx')),
  ]

  const inventory = tsxFiles.map((abs) => {
    const rel = relPath(abs)
    const content = readText(abs)
    return {
      path: rel,
      categories: categorizeFile(rel),
      purpose: firstLinePurpose(content),
      exportName: content.match(/export default function (\w+)/)?.[1] ?? null,
    }
  })

  const duplicates = buildDuplicateMatrix()
  const consolidationPlans = buildConsolidationPlans()
  const contractGaps = mapContractGaps(tsxFiles)
  const generatedAt = new Date().toISOString()

  writeJson(path.join(OUT_DIR, 'components-inventory.json'), {
    generatedAt,
    count: inventory.length,
    inventory,
    duplicates,
    consolidationPlans,
    primitiveReadiness: PRIMITIVE_READINESS,
    contractGaps,
  })

  fs.writeFileSync(
    path.join(DOCS_DIR, 'UI_COMPONENT_INVENTORY.md'),
    buildMarkdown(inventory, duplicates, contractGaps, consolidationPlans, PRIMITIVE_READINESS, generatedAt),
  )

  console.log(`Component inventory: ${inventory.length} files → docs/UI_COMPONENT_INVENTORY.md`)
}

main()
