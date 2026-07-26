#!/usr/bin/env node
/**
 * Generate C2K_PROJECT_CONTEXT_<date>.txt for external AI handoff (GPT, etc.).
 * Excludes .env, secrets, node_modules, dist, and binary blobs.
 *
 * Usage: node scripts/generate-project-context-bundle.mjs
 * Output: docs/handoff/C2K_PROJECT_CONTEXT_<YYYY-MM-DD>.txt
 */

import { execSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const date = new Date().toISOString().slice(0, 10)
const OUT_DIR = path.join(ROOT, 'docs', 'handoff')
const OUT_FILE = path.join(OUT_DIR, `C2K_PROJECT_CONTEXT_${date}.txt`)

const SECTION = (title) => `\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}\n`

function run(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }).trimEnd()
  } catch (e) {
    const out = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '')
    return `[command failed: ${cmd}]\n${out}`.trimEnd()
  }
}

function readFile(rel) {
  const abs = path.join(ROOT, rel)
  if (!fs.existsSync(abs)) return `[missing: ${rel}]`
  return fs.readFileSync(abs, 'utf8')
}

function walkFiles(dir, maxDepth = 6, depth = 0) {
  if (depth > maxDepth) return []
  const skip = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    '.turbo',
    'coverage',
    'playwright-report',
    'test-results',
  ])
  const out = []
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(name.name)) continue
    const abs = path.join(dir, name.name)
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/')
    if (name.isDirectory()) out.push(...walkFiles(abs, maxDepth, depth + 1))
    else out.push(rel)
  }
  return out.sort()
}

function listDocs(maxDepth = 3) {
  const docsRoot = path.join(ROOT, 'docs')
  const out = []
  function walk(d, depth) {
    if (depth > maxDepth) return
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, ent.name)
      const rel = path.relative(ROOT, abs).replace(/\\/g, '/')
      if (ent.isDirectory()) walk(abs, depth + 1)
      else out.push(rel)
    }
  }
  walk(docsRoot, 0)
  return out.sort()
}

function runVerify(cmd, timeoutMs = 600_000) {
  const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', cmd.replace(/^npm run /, '')], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    timeout: timeoutMs,
    maxBuffer: 20 * 1024 * 1024,
  })
  const combined = [r.stdout, r.stderr].filter(Boolean).join('\n')
  const status = r.status === 0 ? 'PASS' : r.error?.code === 'ETIMEDOUT' ? 'TIMEOUT' : 'FAIL'
  return `${status} (exit ${r.status ?? 'n/a'})\n${combined.slice(-8000)}`
}

const docFiles = [
  'docs/LEGAL-PROFILE-TRUST-SAFETY-MASTER-PLAN.md',
  'docs/BACKLOG_QUEUE.md',
  'docs/MASTER_NEXT_STEPS.md',
  'docs/FEATURE_REGISTRY.md',
  'docs/C2K-STRATEGIC-GUIDANCE.md',
  'docs/PROJECT_DECISIONS.md',
  'docs/privacy/LEGAL-RISK-PRINCIPLE.md',
  'docs/privacy/data-inventory.md',
  'docs/privacy/vendor-registry.md',
  'docs/audits/trust-and-safety/T&S-IMPLEMENTATION.md',
]

const packageFiles = [
  'package.json',
  'packages/api/package.json',
  'packages/web/package.json',
  'packages/shared/package.json',
]

const codeExcerpts = [
  'packages/api/src/db/schema.ts',
  'packages/api/src/routes/moderation-ts-admin.ts',
  'packages/api/src/routes/media-assets.ts',
  'packages/api/src/lib/legal-hold.ts',
  'packages/api/src/lib/retention-sweep.ts',
  'packages/api/src/lib/moderation-ts-admin.ts',
  'packages/shared/src/content-policy.ts',
  'packages/shared/src/media-policy-config.ts',
  'packages/shared/src/media-scanner-config.ts',
  'packages/shared/src/retention-policy.ts',
]

const skipVerify = process.argv.includes('--skip-verify')

fs.mkdirSync(OUT_DIR, { recursive: true })

const parts = []
parts.push(`C2K PROJECT CONTEXT BUNDLE`)
parts.push(`Generated: ${new Date().toISOString()}`)
parts.push(`Output: docs/handoff/C2K_PROJECT_CONTEXT_${date}.txt`)
parts.push(`Regenerate: node scripts/generate-project-context-bundle.mjs`)
parts.push(`NOTE: Do not commit .env, secrets, prod dumps, or real moderation evidence.`)

parts.push(SECTION('1. GIT STATUS --short'))
parts.push(run('git status --short'))

parts.push(SECTION('2. GIT BRANCH'))
parts.push(run('git branch --show-current') || '[no branch / not a git repo]')

parts.push(SECTION('3. GIT LOG --oneline -20'))
parts.push(run('git log --oneline -20') || '[no git log]')

parts.push(SECTION('4. GIT LS-FILES (or walk fallback)'))
const ls = run('git ls-files')
parts.push(ls.startsWith('[command failed') ? walkFiles(ROOT).join('\n') : ls)

parts.push(SECTION('5. DOCS INDEX (maxdepth 3)'))
const docsIndex = listDocs(3)
parts.push(docsIndex.join('\n'))
fs.writeFileSync(path.join(OUT_DIR, 'docs-index.txt'), docsIndex.join('\n') + '\n')

for (const rel of docFiles) {
  parts.push(SECTION(`DOC: ${rel}`))
  parts.push(readFile(rel))
}

for (const rel of packageFiles) {
  parts.push(SECTION(`PACKAGE: ${rel}`))
  parts.push(readFile(rel))
}

for (const rel of codeExcerpts) {
  parts.push(SECTION(`CODE: ${rel}`))
  parts.push(readFile(rel))
}

if (!skipVerify) {
  parts.push(SECTION('6. VERIFICATION: verify:trust-safety:unit (fast slice)'))
  parts.push(runVerify('verify:trust-safety:unit', 120_000))
  parts.push(SECTION('7. VERIFICATION: npm test'))
  parts.push(runVerify('test', 300_000))
} else {
  parts.push(SECTION('6–7. VERIFICATION'))
  parts.push('Skipped (--skip-verify). Run manually: verify:trust-safety, verify:prelaunch, test, build')
}

parts.push(SECTION('8. HANDOFF RECAP (summary for GPT)'))
parts.push(`See prior chat recap or docs/PROJECT_DECISIONS.md + LEGAL-PROFILE-TRUST-SAFETY-MASTER-PLAN.md.
Alpha: community_only, explicit off, scanners fail closed, PUBLIC_PREVIEW coercion to logged_in.
Next worker: LEGAL-ALPHA-1 in BACKLOG_QUEUE.md.
Screenshots: docs/audits/trust-and-safety/screenshots/ (capture with dev stack + platform admin).`)

fs.writeFileSync(OUT_FILE, parts.join('\n'))
console.log(`Wrote ${path.relative(ROOT, OUT_FILE)} (${(fs.statSync(OUT_FILE).size / 1024).toFixed(0)} KB)`)
console.log(`Wrote docs/handoff/docs-index.txt (${docsIndex.length} files)`)
