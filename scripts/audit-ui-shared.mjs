#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.join(__dirname, '..')
export const WEB_SRC = path.join(ROOT, 'packages/web/src')
export const WEB_APP = path.join(WEB_SRC, 'app')
export const OUT_DIR = path.join(ROOT, 'docs/audits/ui/generated')
export const SCREENSHOT_DIR = path.join(ROOT, 'docs/audits/ui/screenshots/ui-architecture-audit')
export const DOCS_DIR = path.join(ROOT, 'docs')

export const PUBLIC_EXACT = new Set(['/', '/login', '/terms', '/privacy', '/guidelines'])
export const PUBLIC_PREFIXES = [
  '/forgot-password',
  '/reset-password',
  '/email/unsubscribe',
  '/email/confirm',
  '/policies',
]

export const ONBOARDING_EXEMPT_PREFIXES = [
  '/onboarding',
  '/login',
  '/forgot-password',
  '/reset-password',
  '/terms',
  '/privacy',
  '/guidelines',
  '/policies',
  '/moderation',
  '/admin',
  '/support',
  '/contact',
]

export const BACKEND_LANGUAGE_PATTERNS = [
  { id: 'command-bridge', re: /Command Bridge|command bridge/i },
  { id: 'role-enum', re: /\b(SITE_ADMIN|MODERATOR\+|MODERATOR|OWNER|ADMIN)\b/ },
  { id: 'internal-notes', re: /internal notes?|Internal notes?/i },
  { id: 'ecke', re: /\bECKE\b|eckePublish|ecke-/i },
  { id: 'rule-of-two', re: /rule-of-two|rule of two/i },
  { id: 'prisma-ish', re: /\bPrisma\b|\bDrizzle\b|\bSQL\b/ },
]

export const DISCOVER_PATHS = new Set([
  '/explore',
  '/people',
  '/events',
  '/groups',
  '/conventions',
  '/orgs',
  '/education',
  '/vendors',
  '/presenters',
  '/media',
  '/places',
])

export const FOCUSED_PERSONAL_PREFIXES = [
  '/messaging',
  '/notifications',
  '/connections',
  '/activity',
  '/my-posts',
  '/settings',
  '/saved',
  '/profile/edit',
]

export const VIEWPORTS = {
  '360': { width: 360, height: 800 },
  '390': { width: 390, height: 844 },
  '430': { width: 430, height: 932 },
  '768': { width: 768, height: 1024 },
  '1440': { width: 1440, height: 900 },
}

export const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD ?? 'demo'
export const ADMIN_PASSWORD = process.env.BRAX_ADMIN_PASSWORD ?? 'Airship!2'

export const PERSONAS = {
  guest: { username: null, password: null, onboardingComplete: null },
  'new-member': { username: 'RopeDreamer', password: DEMO_PASSWORD, onboardingComplete: false },
  member: { username: 'RopeDreamer', password: DEMO_PASSWORD, onboardingComplete: true },
  organizer: { username: 'RopeDreamer', password: DEMO_PASSWORD, onboardingComplete: true },
  'mod-admin': { username: 'Brax', password: ADMIN_PASSWORD, onboardingComplete: true },
}

export function passwordForPersona(persona) {
  return PERSONAS[persona]?.password ?? DEMO_PASSWORD
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

export function writeJson(file, data) {
  ensureDir(path.dirname(file))
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

export function readText(file) {
  return fs.readFileSync(file, 'utf8')
}

export function walk(dir, acc = [], filter = () => true) {
  if (!fs.existsSync(dir)) return acc
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, acc, filter)
    else if (filter(p)) acc.push(p)
  }
  return acc
}

export function isPublicWebPath(pathname) {
  if (PUBLIC_EXACT.has(pathname)) return true
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function isOnboardingExempt(pathname) {
  return ONBOARDING_EXEMPT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function normalizeRoutePath(segments) {
  if (segments.length === 0) return '/'
  return `/${segments.join('/')}`.replace(/\/+/g, '/')
}

export function slugify(s) {
  return s
    .replace(/^\//, '')
    .replace(/[?#].*$/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'root'
}

export function mdEscape(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

export function countBy(arr, keyFn) {
  const m = new Map()
  for (const item of arr) {
    const k = keyFn(item)
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return Object.fromEntries([...m.entries()].sort((a, b) => a[0].localeCompare(b[0])))
}

export function appPathToRoute(filePath) {
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
  return normalizeRoutePath(segments)
}
