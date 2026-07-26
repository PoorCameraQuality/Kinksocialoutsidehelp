/**
 * Fail CI when new legacy Tailwind `*-c2k-*` color utilities appear in UI source.
 * Allows scrollbar helper, token definition CSS, and mock image seed strings.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '../src')

const SKIP_FILES = new Set([
  'globals.css',
  'dancecard-parity.css',
  'mock-seeds.ts',
  'mock-home-surface.ts',
])

const SKIP_DIRS = new Set(['node_modules', 'dist'])

/** Tailwind color utilities we migrated to dc-* */
const FORBIDDEN =
  /\b(?:bg|text|border(?:-[lrtbxy]+)?|ring(?:-offset)?|from|to|via|accent|outline|placeholder|decoration|divide)-c2k-(?!no-scrollbar)/g

/** Allowed non-color c2k-* class fragments */
const ALLOWED_CLASS = /\bc2k-no-scrollbar\b/

function scanFile(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/')
  if (SKIP_FILES.has(path.basename(filePath))) return []
  const lines = fs.readFileSync(filePath, 'utf8').split('\n')
  const hits = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue
    const matches = [...line.matchAll(FORBIDDEN)]
    for (const m of matches) {
      if (ALLOWED_CLASS.test(m[0])) continue
      hits.push({ rel, line: i + 1, match: m[0], text: line.trim().slice(0, 120) })
    }
  }
  return hits
}

function walk(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, out)
    else if (/\.(tsx|ts)$/.test(ent.name)) out.push(...scanFile(p))
  }
}

const violations = []
walk(ROOT, violations)

if (violations.length) {
  console.error(`Found ${violations.length} legacy c2k Tailwind color class(es):\n`)
  for (const v of violations.slice(0, 40)) {
    console.error(`  ${v.rel}:${v.line}  ${v.match}`)
    console.error(`    ${v.text}\n`)
  }
  if (violations.length > 40) {
    console.error(`  ... and ${violations.length - 40} more`)
  }
  console.error('Use dc-* tokens (see docs/C2K-DESIGN-SYSTEM.md) or add a justified allowlist entry.')
  process.exit(1)
}

console.log('No legacy c2k Tailwind color classes in packages/web/src')
