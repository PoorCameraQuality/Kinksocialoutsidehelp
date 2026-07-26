#!/usr/bin/env node
/**
 * Enriched route inventory from router.tsx + static analysis.
 * Output: docs/audits/ui/generated/routes-enriched.json, docs/UI_ROUTE_INVENTORY.md
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  ROOT,
  WEB_SRC,
  WEB_APP,
  OUT_DIR,
  DOCS_DIR,
  readText,
  writeJson,
  walk,
  appPathToRoute,
  isPublicWebPath,
  isOnboardingExempt,
  BACKEND_LANGUAGE_PATTERNS,
  DISCOVER_PATHS,
  FOCUSED_PERSONAL_PREFIXES,
  mdEscape,
  countBy,
  normalizeRoutePath,
} from './audit-ui-shared.mjs'

const ROUTER_FILE = path.join(WEB_SRC, 'router.tsx')

function parseImportMap(content) {
  const map = new Map()
  const re = /^import\s+(\w+)\s+from\s+['"](\.\/[^'"]+)['"]/gm
  let m
  while ((m = re.exec(content)) !== null) {
    map.set(m[1], m[2].replace(/^\.\//, ''))
  }
  return map
}

function extractElementInfo(snippet, importMap) {
  const nav = snippet.match(/<Navigate\s+to=["']([^"']+)["']/)
  if (nav) {
    return { kind: 'redirect', redirectTo: nav[1], component: 'Navigate', source: null }
  }
  const el = snippet.match(/element:\s*<(\w+)/)
  if (!el) return { kind: 'unknown', component: null, source: null }
  const name = el[1]
  if (name === 'Navigate') {
    const to = snippet.match(/to=["']([^"']+)["']/)
    return { kind: 'redirect', redirectTo: to?.[1] ?? null, component: name, source: null }
  }
  const rel = importMap.get(name)
  const source = rel ? `packages/web/src/${rel.replace(/\.tsx?$/, '')}${rel.endsWith('.tsx') ? '' : '.tsx'}` : null
  return { kind: 'page', component: name, source: source ?? name }
}

function parseRouteObjects(content, importMap) {
  const start = content.indexOf('createBrowserRouter([')
  if (start < 0) throw new Error('createBrowserRouter not found')
  const routes = []
  let i = start + 'createBrowserRouter('.length
  let depth = 0
  let objStart = -1
  let layoutStack = []

  function flushRoute(objText, parentPath, layoutChain) {
    const pathMatch = objText.match(/\bpath:\s*['"]([^'"]*)['"]/)
    const isIndex = /\bindex:\s*true/.test(objText)
    const hasChildren = /\bchildren:\s*\[/.test(objText)
    const elementInfo = extractElementInfo(objText, importMap)

    let routePath
    if (pathMatch) {
      const seg = pathMatch[1]
      routePath = seg.startsWith('/') ? seg : normalizeRoutePath([...parentPath, seg].filter(Boolean))
    } else if (isIndex) {
      routePath = normalizeRoutePath(parentPath)
    } else {
      return
    }

    const layouts = [...layoutChain]
    if (elementInfo.component === 'RootLayout') layouts.push('RootLayout')
    else if (elementInfo.component === 'ModerationShell') layouts.push('ModerationShell')
    else if (elementInfo.component === 'SettingsLayout') layouts.push('SettingsLayout')
    else if (elementInfo.component === 'ProfileEditLayout') layouts.push('ProfileEditLayout')
    else if (elementInfo.component === 'AppProviders' && routePath.includes('/door')) {
      layouts.push('AppProvidersOnly')
    }

    routes.push({
      path: routePath,
      kind: elementInfo.kind,
      redirectTo: elementInfo.redirectTo ?? null,
      component: elementInfo.component,
      source: elementInfo.source,
      layout: layouts.length ? layouts.join(' → ') : 'RootLayout',
      hasChildren,
    })

    if (hasChildren && elementInfo.kind === 'page') {
      const childLayout = [...layoutChain]
      if (['RootLayout', 'ModerationShell', 'SettingsLayout', 'ProfileEditLayout'].includes(elementInfo.component)) {
        childLayout.push(elementInfo.component)
      }
      const childStart = objText.indexOf('children: [')
      if (childStart >= 0) {
        parseChildren(objText.slice(childStart + 'children: ['.length), routePath === '/' ? [] : routePath.split('/').filter(Boolean), childLayout)
      }
    }
  }

  function parseChildren(text, parentSegments, layoutChain) {
    let depth = 0
    let objStart = -1
    for (let j = 0; j < text.length; j++) {
      const ch = text[j]
      if (ch === '{') {
        if (depth === 0) objStart = j
        depth++
      } else if (ch === '}') {
        depth--
        if (depth === 0 && objStart >= 0) {
          flushRoute(text.slice(objStart, j + 1), parentSegments, layoutChain)
          objStart = -1
        }
      } else if (ch === ']' && depth === 0) {
        break
      }
    }
  }

  // top-level array
  for (; i < content.length; i++) {
    const ch = content[i]
    if (ch === '[') {
      depth++
      break
    }
  }
  i++
  for (; i < content.length; i++) {
    const ch = content[i]
    if (ch === '{') {
      if (depth === 1) objStart = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 1 && objStart >= 0) {
        const objText = content.slice(objStart, i + 1)
        flushRoute(objText, [], [])
        if (/\bchildren:\s*\[/.test(objText)) {
          const pathMatch = objText.match(/\bpath:\s*['"]([^'"]*)['"]/)
          const parentSegs = pathMatch && pathMatch[1] !== '/' ? pathMatch[1].replace(/^\//, '').split('/') : []
          const layoutChain = []
          const el = objText.match(/element:\s*<(\w+)/)
          if (el?.[1] === 'RootLayout') layoutChain.push('RootLayout')
          const childStart = objText.indexOf('children: [')
          if (childStart >= 0) {
            parseChildren(objText.slice(childStart + 'children: ['.length), parentSegs, layoutChain)
          }
        }
        objStart = -1
      }
    } else if (ch === ']' && depth === 1) {
      break
    }
  }

  return routes
}

function classifyAccess(routePath, kind) {
  const tags = new Set()
  if (kind === 'redirect') {
    tags.add('redirect')
    return [...tags]
  }
  if (isPublicWebPath(routePath)) tags.add('public')
  else tags.add('auth')

  if (routePath.startsWith('/onboarding') || routePath === '/profile/complete') tags.add('onboarding')
  if (isOnboardingExempt(routePath)) tags.add('onboarding-exempt')
  if (!isPublicWebPath(routePath) && !isOnboardingExempt(routePath)) tags.add('member')

  if (routePath.startsWith('/organizer')) tags.add('organizer')
  if (routePath.startsWith('/moderation')) {
    tags.add('moderator')
    if (['/moderation/admin', '/moderation/audit'].some((p) => routePath.startsWith(p))) tags.add('admin')
    if (['/moderation/legal', '/moderation/dmca', '/moderation/contact'].some((p) => routePath.startsWith(p))) {
      tags.add('legal')
    }
  }
  if (routePath.startsWith('/admin')) tags.add('system')

  const legalPaths = [
    '/terms',
    '/privacy',
    '/guidelines',
    '/policies',
    '/dmca',
    '/ncii',
    '/minor-safety',
    '/law-enforcement',
    '/adult-content-consent',
    '/vendor-organizer-terms',
  ]
  if (legalPaths.some((p) => routePath === p || routePath.startsWith(`${p}/`))) tags.add('legal')

  return [...tags]
}

function classifyArchetype(route, source) {
  if (route.kind === 'redirect') return 'redirect'
  const p = route.path
  const comp = (route.component ?? '').toLowerCase()
  const src = (source ?? '').toLowerCase()

  if (p === '*' || comp === 'notfoundpage') return 'system'
  if (p.startsWith('/onboarding') || comp.includes('onboarding') || comp.includes('wizard')) return 'wizard'
  if (p.startsWith('/settings') || p.startsWith('/profile/edit')) return 'settings'
  if (p.startsWith('/moderation') || p.startsWith('/admin') || p.startsWith('/organizer')) return 'dashboard'
  if (
    comp.includes('legal') ||
    comp.includes('policy') ||
    comp.includes('terms') ||
    comp.includes('privacy') ||
    comp.includes('guidelines') ||
    src.includes('/policies/')
  ) {
    return 'policy'
  }
  if (p.startsWith('/media') || comp.includes('media')) return 'media'
  if (p === '/home' || comp.includes('home')) return 'feed'
  if (
    comp.includes('discover') ||
    comp.includes('directory') ||
    DISCOVER_PATHS.has(p) ||
    p === '/explore' ||
    p === '/people'
  ) {
    return 'directory'
  }
  if (
    p.includes('/:') &&
    !p.startsWith('/organizer') &&
    !p.startsWith('/moderation') &&
    !p.startsWith('/settings') &&
    !p.includes('/register') &&
    !p.includes('/apply')
  ) {
    return 'detail'
  }
  if (p.includes('/register') || p.includes('/apply') || p.includes('/new')) return 'wizard'
  if (p === '/support' || p === '/contact' || p === '/about') return 'policy'
  return 'detail'
}

function mobileLayoutFlags(routePath) {
  const flags = []
  if (DISCOVER_PATHS.has(routePath)) flags.push('discover-3col')
  if (routePath === '/home') flags.push('feed-3col')
  if (FOCUSED_PERSONAL_PREFIXES.some((p) => routePath === p || routePath.startsWith(`${p}/`))) {
    flags.push('focused-personal')
  }
  if (routePath.startsWith('/organizer')) flags.push('organizer-shell')
  if (routePath.startsWith('/moderation')) flags.push('moderation-shell')
  return flags
}

function resolveSourceFile(route) {
  if (route.source) {
    const full = path.join(WEB_SRC, route.source.replace('packages/web/src/', ''))
    if (fs.existsSync(full)) return full
    if (fs.existsSync(`${full}.tsx`)) return `${full}.tsx`
  }
  if (route.component && route.component !== 'Navigate') {
    const guess = walk(WEB_APP).find((f) => {
      const base = path.basename(f, '.tsx')
      return base.toLowerCase() === route.component.replace(/Page$/, '').toLowerCase() + 'page' ||
        f.includes(route.component.replace(/Page$/, '').toLowerCase())
    })
    if (guess) return guess
  }
  return null
}

function scanBackendLanguage(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return []
  const content = readText(filePath)
  const hits = []
  for (const { id, re } of BACKEND_LANGUAGE_PATTERNS) {
    if (re.test(content)) hits.push(id)
    re.lastIndex = 0
  }
  return hits
}

function inferInPageShell(route, sourceFile) {
  if (!sourceFile) return null
  const content = readText(sourceFile)
  if (/OrganizerAppShell/.test(content)) return 'OrganizerAppShell'
  if (/CommunityHubShell|GroupCommunityShell|OrgCommunityShell/.test(content)) return 'CommunityHubShell'
  if (/ConventionAttendeeHubShell/.test(content)) return 'ConventionAttendeeHubShell'
  if (/PersonalUtilityPageShell/.test(content)) return 'PersonalUtilityPageShell'
  if (/EducationDiscoverShell/.test(content)) return 'EducationDiscoverShell'
  if (/MemberOnboardingWizard/.test(content)) return 'MemberOnboardingWizard'
  return null
}

function classifyOnboardingGate(route) {
  if (!route.onboardingRedirect || route.kind !== 'page') {
    return null
  }
  const p = route.path

  // Already exempt in code — doc drift if marked gated
  if (isOnboardingExempt(p)) {
    return {
      recommendedClass: 'should_not_gate',
      rationale: 'Already in onboardingPathsExempt — inventory flag is stale',
    }
  }

  if (
    p.startsWith('/moderation') ||
    p.startsWith('/admin') ||
    p.startsWith('/organizer') ||
    p.includes('/register') ||
    p.includes('/apply') ||
    p.startsWith('/media/submit') ||
    p.startsWith('/settings/payment') ||
    p.startsWith('/profile/edit/privacy')
  ) {
    return {
      recommendedClass: 'hard_block',
      rationale: 'Legal/safety, staff tools, or account integrity action',
    }
  }

  const readOnlyPrefixes = [
    '/events',
    '/groups',
    '/orgs',
    '/conventions',
    '/people',
    '/education',
    '/vendors',
    '/presenters',
    '/media',
    '/places',
    '/explore',
    '/tags/',
    '/dungeons',
  ]
  if (readOnlyPrefixes.some((prefix) => p === prefix || p.startsWith(`${prefix}/`) || p.startsWith(prefix))) {
    return {
      recommendedClass: 'read_only_banner',
      rationale: 'Discovery/browse — user should explore value with onboarding banner, not full redirect',
    }
  }

  const setupPrefixes = [
    '/home',
    '/profile',
    '/settings',
    '/messaging',
    '/notifications',
    '/connections',
    '/saved',
    '/activity',
    '/my-posts',
    '/onboarding',
  ]
  if (setupPrefixes.some((prefix) => p === prefix || p.startsWith(`${prefix}/`))) {
    return {
      recommendedClass: 'setup_prompt',
      rationale: 'Personal hub — allow access with inline setup nudges',
    }
  }

  if (['/about', '/contact', '/support', '/accessibility'].includes(p)) {
    return {
      recommendedClass: 'should_not_gate',
      rationale: 'Informational/support — should remain reachable during onboarding',
    }
  }

  return {
    recommendedClass: 'setup_prompt',
    rationale: 'Default — soft gate with contextual prompt unless legal/staff',
  }
}

function buildTemplateMapping(routes) {
  const templates = {
    feed: [],
    directory: [],
    detail: [],
    wizard: [],
    dashboard: [],
    settings: [],
    policy: [],
    media: [],
    redirect: [],
    system: [],
  }
  for (const r of routes) {
    if (templates[r.archetype]) templates[r.archetype].push(r.path)
  }
  return templates
}

function buildMarkdown(routes, orphans, authMismatches, generatedAt) {
  const active = routes.filter((r) => r.kind !== 'redirect' || r.redirectTo)
  const redirects = routes.filter((r) => r.kind === 'redirect')
  const onboardingBlocked = routes.filter(
    (r) => r.onboardingRedirect && r.kind === 'page',
  )
  const uniqueBlocked = [...new Map(onboardingBlocked.map((r) => [r.path, r])).values()]

  const lines = [
    '# UI Route Inventory — kink.social',
    '',
    `Generated: ${generatedAt.slice(0, 10)} via \`npm run audit:ui-architecture\``,
    '',
    '**Source of truth:** `packages/web/src/router.tsx` enriched with AuthGate, OnboardingGate, and static analysis.',
    '',
    '## Summary',
    '',
    `- **Total router entries:** ${routes.length}`,
    `- **Active pages:** ${routes.filter((r) => r.kind === 'page').length}`,
    `- **Redirects:** ${redirects.length}`,
    `- **Orphan page files (not in router):** ${orphans.length}`,
    '',
    '### By access tag',
    '',
    ...Object.entries(
      countBy(
        routes.flatMap((r) => r.access),
        (x) => x,
      ),
    ).map(([k, v]) => `- \`${k}\`: ${v}`),
    '',
    '### By page archetype',
    '',
    ...Object.entries(countBy(routes, (r) => r.archetype)).map(([k, v]) => `- \`${k}\`: ${v}`),
    '',
    '## Full route table',
    '',
    '| Path | Component | Layout | Access | Onboarding redirect | Archetype | Mobile flags | Backend language |',
    '|------|-----------|--------|--------|---------------------|-----------|--------------|------------------|',
  ]

  for (const r of [...routes].sort((a, b) => a.path.localeCompare(b.path))) {
    lines.push(
      `| \`${mdEscape(r.path)}\` | ${mdEscape(r.component ?? '—')} | ${mdEscape(r.layout)} | ${mdEscape(r.access.join(', '))} | ${r.onboardingRedirect ? 'Yes' : 'No'} | ${r.archetype} | ${mdEscape(r.mobileFlags.join(', ') || '—')} | ${mdEscape(r.backendLanguage.join(', ') || '—')} |`,
    )
  }

  lines.push(
    '',
    '## Onboarding redirect list',
    '',
    'Routes that redirect incomplete members to `/onboarding?redirect=…` (auth required, not onboarding-exempt):',
    '',
  )
  if (onboardingBlocked.length === 0) lines.push('_None_')
  else uniqueBlocked.sort((a, b) => a.path.localeCompare(b.path)).forEach((r) => lines.push(`- \`${r.path}\``))

  lines.push(
    '',
    '## OnboardingGate migration classification (planning only — no behavior change)',
    '',
    'Future soft-gate migration targets. **Current behavior:** all rows below redirect to `/onboarding` when `feed.onboardingCompletedAt` is unset.',
    '',
    '| Path | Current gate | Recommended class | Rationale |',
    '|------|--------------|-------------------|-----------|',
  )
  for (const r of uniqueBlocked.sort((a, b) => a.path.localeCompare(b.path))) {
    const cls = r.onboardingGateClass ?? 'setup_prompt'
    lines.push(
      `| \`${mdEscape(r.path)}\` | Yes | ${cls.recommendedClass} | ${mdEscape(cls.rationale)} |`,
    )
  }

  const classCounts = countBy(uniqueBlocked, (r) => r.onboardingGateClass?.recommendedClass ?? 'unknown')
  lines.push('', '### Classification summary', '')
  for (const [k, v] of Object.entries(classCounts)) {
    lines.push(`- \`${k}\`: ${v}`)
  }

  lines.push(
    '',
    '## AuthGate mismatch list',
    '',
    'Routes commonly described as public in marketing/registry but require login at runtime (not in `public-routes.ts`):',
    '',
  )
  if (authMismatches.length === 0) lines.push('_None detected_')
  else authMismatches.forEach((r) => lines.push(`- \`${r.path}\` — ${r.note}`))

  lines.push('', '## Orphan pages (filesystem, not wired in router)', '')
  if (orphans.length === 0) lines.push('_None_')
  else orphans.forEach((o) => lines.push(`- \`${o.path}\` → \`${o.source}\``))

  lines.push('', '## Recommended template mapping (planning only)', '')
  const templates = buildTemplateMapping(routes.filter((r) => r.kind === 'page'))
  for (const [template, paths] of Object.entries(templates)) {
    lines.push(`### ${template}`, '')
    if (paths.length === 0) lines.push('_None_')
    else paths.sort().slice(0, 40).forEach((p) => lines.push(`- \`${p}\``))
    if (paths.length > 40) lines.push(`- _…and ${paths.length - 40} more_`)
    lines.push('')
  }

  return lines.join('\n')
}

function main() {
  const routerContent = readText(ROUTER_FILE)
  const importMap = parseImportMap(routerContent)
  const rawRoutes = parseRouteObjects(routerContent, importMap)

  const enriched = rawRoutes.map((route) => {
    const sourceFile = resolveSourceFile(route)
    const inPageShell = inferInPageShell(route, sourceFile)
    const layout = inPageShell ? `${route.layout} + ${inPageShell}` : route.layout
    const access = classifyAccess(route.path, route.kind)
    const archetype = classifyArchetype(route, sourceFile)
    const mobileFlags = mobileLayoutFlags(route.path)
    const backendLanguage = scanBackendLanguage(sourceFile)
    const onboardingRedirect =
      route.kind === 'page' &&
      !isPublicWebPath(route.path) &&
      !isOnboardingExempt(route.path)
    const onboardingGateClass = classifyOnboardingGate({
      ...route,
      onboardingRedirect,
    })

    return {
      ...route,
      layout,
      access,
      archetype,
      mobileFlags,
      backendLanguage,
      onboardingRedirect,
      onboardingGateClass,
      sourceFile: sourceFile ? path.relative(ROOT, sourceFile).replace(/\\/g, '/') : route.source,
    }
  })

  const routerPaths = new Set(enriched.map((r) => r.path))
  const pageFiles = walk(WEB_APP).filter((f) => f.endsWith('page.tsx'))
  const orphans = []
  for (const f of pageFiles) {
    const p = appPathToRoute(f)
    if (!p) continue
    const normalized = p.replace(/:\w+/g, ':param')
    const inRouter = [...routerPaths].some(
      (rp) => rp === p || rp.replace(/:\w+/g, ':param') === normalized,
    )
    if (!inRouter) {
      orphans.push({ path: p, source: path.relative(ROOT, f).replace(/\\/g, '/') })
    }
  }

  const registryPublicPaths = [
    '/explore',
    '/events',
    '/groups',
    '/education',
    '/vendors',
    '/people',
    '/orgs',
    '/conventions',
    '/about',
    '/dmca',
    '/contact',
    '/media',
  ]
  const authMismatches = registryPublicPaths
    .filter((p) => !isPublicWebPath(p))
    .map((p) => ({
      path: p,
      note: 'Listed as discoverable/public in FEATURE_REGISTRY; AuthGate requires session',
    }))

  const generatedAt = new Date().toISOString()
  writeJson(path.join(OUT_DIR, 'routes-enriched.json'), { generatedAt, routes: enriched, orphans, authMismatches })
  fs.writeFileSync(path.join(DOCS_DIR, 'UI_ROUTE_INVENTORY.md'), buildMarkdown(enriched, orphans, authMismatches, generatedAt))

  console.log(`Route inventory: ${enriched.length} routes, ${orphans.length} orphans → docs/UI_ROUTE_INVENTORY.md`)
}

main()
