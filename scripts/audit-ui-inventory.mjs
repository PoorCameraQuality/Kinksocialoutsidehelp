#!/usr/bin/env node
/**
 * Static UI inventory — scans packages/web for routes and workflow controls.
 * Run: npm run audit:ui-inventory
 * Outputs: docs/audits/ui/generated/routes.json, controls.json, ROUTES_TABLE.md
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const WEB_APP = path.join(ROOT, 'packages/web/src/app')
const WEB_SRC = path.join(ROOT, 'packages/web/src')
const OUT_DIR = path.join(ROOT, 'docs/audits/ui/generated')

const CONTROL_PATTERNS = [
  { type: 'data-testid', re: /data-testid=["']([^"']+)["']/g },
  { type: 'button', re: /<button[^>]*>([^<]{0,80})</g },
  { type: 'link', re: /<Link[^>]*to=["'{]([^"'}]+)["'}][^>]*>([^<]{0,60})</g },
  { type: 'role-tab', re: /role=["']tab["'][^>]*>([^<]{0,60})</g },
]

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, acc)
    else if (/\.(tsx|ts)$/.test(ent.name)) acc.push(p)
  }
  return acc
}

function appPathToRoute(filePath) {
  const rel = path.relative(WEB_APP, filePath).replace(/\\/g, '/')
  if (!rel.endsWith('/page.tsx') && rel !== 'page.tsx') return null
  const withoutPage = rel.replace(/\/?page\.tsx$/, '')
  if (!withoutPage) return '/'
  const segments = withoutPage.split('/').map((seg) => {
    if (seg.startsWith('[') && seg.endsWith(']')) {
      const inner = seg.slice(1, -1)
      return inner.startsWith('...') ? `*${inner.slice(3)}` : `:${inner}`
    }
    return seg
  })
  return '/' + segments.join('/')
}

function classifyRoute(route) {
  if (route.startsWith('/organizer')) return 'organizer'
  if (route.startsWith('/moderation')) return 'admin'
  if (route.startsWith('/settings')) return 'authenticated'
  if (
    ['/home', '/saved', '/connections', '/notifications', '/messaging', '/profile', '/onboarding'].some(
      (p) => route === p || route.startsWith(p + '/'),
    )
  ) {
    return 'authenticated'
  }
  if (route.includes('/register') || route.includes('/apply')) return 'public-attendee'
  if (route.startsWith('/conventions/') && !route.startsWith('/conventions/page')) return 'public'
  if (route.startsWith('/orgs/') && route !== '/orgs/new') return 'public'
  if (['/events/', '/groups/', '/presenters/', '/vendors/', '/education/'].some((p) => route.includes(p))) {
    return 'public'
  }
  return 'public'
}

function scanControls(filePath, content) {
  const rel = path.relative(WEB_SRC, filePath).replace(/\\/g, '/')
  const found = []
  for (const { type, re } of CONTROL_PATTERNS) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(content)) !== null) {
      const label = (m[2] ?? m[1] ?? '').trim().replace(/\s+/g, ' ')
      if (!label || label.length < 2) continue
      if (type === 'button' && /^(div|span|svg)/i.test(label)) continue
      found.push({ type, label: label.slice(0, 80), file: rel })
    }
  }
  return found
}

function buildRoutesTable(routes) {
  const lines = [
    '# Generated route inventory',
    '',
    `Generated: ${new Date().toISOString().slice(0, 10)} — run \`npm run audit:ui-inventory\` to refresh.`,
    '',
    '| Route | Access | Source |',
    '|-------|--------|--------|',
  ]
  for (const r of routes.sort((a, b) => a.path.localeCompare(b.path))) {
    lines.push(`| \`${r.path}\` | ${r.access} | \`${r.source}\` |`)
  }
  lines.push('')
  return lines.join('\n')
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const pageFiles = walk(WEB_APP).filter((f) => f.endsWith('page.tsx'))
  const routes = []
  for (const f of pageFiles) {
    const routePath = appPathToRoute(f)
    if (!routePath) continue
    routes.push({
      path: routePath,
      access: classifyRoute(routePath),
      source: path.relative(ROOT, f).replace(/\\/g, '/'),
    })
  }

  const componentFiles = walk(WEB_SRC).filter((f) => f.endsWith('.tsx'))
  const controlsByFile = {}
  let testIdCount = 0
  const testIdRe = /data-testid=["']([^"']+)["']/g
  for (const f of componentFiles) {
    const content = fs.readFileSync(f, 'utf8')
    const rel = path.relative(WEB_SRC, f).replace(/\\/g, '/')
    const testIds = []
    testIdRe.lastIndex = 0
    let tid
    while ((tid = testIdRe.exec(content)) !== null) {
      testIds.push({ type: 'data-testid', label: tid[1], file: rel })
    }
    testIdCount += testIds.length
    if (testIds.length > 0) controlsByFile[rel] = testIds
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    routeCount: routes.length,
    componentFilesWithControls: Object.keys(controlsByFile).length,
    dataTestIdCount: testIdCount,
    routes,
  }

  fs.writeFileSync(path.join(OUT_DIR, 'routes.json'), JSON.stringify(routes, null, 2))
  fs.writeFileSync(
    path.join(OUT_DIR, 'controls-summary.json'),
    JSON.stringify({ ...summary, controlsByFile }, null, 2),
  )
  fs.writeFileSync(path.join(OUT_DIR, 'ROUTES_TABLE.md'), buildRoutesTable(routes))

  console.log(`UI inventory: ${routes.length} routes, ${testIdCount} data-testid, ${Object.keys(controlsByFile).length} component files scanned`)
  console.log(`Wrote ${path.relative(ROOT, OUT_DIR)}/`)
}

main()
