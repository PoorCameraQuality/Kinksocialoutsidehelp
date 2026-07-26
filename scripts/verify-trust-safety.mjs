#!/usr/bin/env node
/**
 * T&S-1 + T&S-2 verification gate — moderation-ts + media tests + optional Playwright.
 *
 * Unit tests always run (no DB required; media/shared tests skip in-file until modules land).
 * DB tests run when USE_DATABASE=true.
 * E2E: set VERIFY_TS_E2E=1 and have dev stack + db:prepare running.
 *
 * Usage:
 *   npm run verify:trust-safety:unit
 *   USE_DATABASE=true npm run verify:trust-safety:unit
 *   VERIFY_TS_E2E=1 USE_DATABASE=true npm run verify:trust-safety:local
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const apiTestDir = join(root, 'packages/api/src')
const moderationE2eSpec = join(root, 'e2e/moderation-ts.spec.ts')
const mediaE2eSpec = join(root, 'e2e/media-ts.spec.ts')
const runE2e = process.env.VERIFY_TS_E2E === '1'
const runDbTests = process.env.USE_DATABASE === 'true'

/** @param {string} needle @param {string[]} roots @returns {string[]} */
function discoverTests(needle, roots) {
  /** @type {string[]} */
  const files = []
  const walk = (dir) => {
    if (!existsSync(dir)) return
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, name.name)
      if (name.isDirectory()) {
        if (name.name === 'node_modules' || name.name === 'dist') continue
        walk(full)
      } else if (name.name.includes(needle) && name.name.endsWith('.test.ts')) {
        files.push(full)
      }
    }
  }
  for (const dir of roots) walk(dir)
  return [...new Set(files)].sort()
}

/** @returns {string[]} */
function discoverModerationTsTests() {
  return discoverTests('moderation-ts', [apiTestDir, join(root, 'packages/api/src/test')])
}

/** @returns {string[]} */
function discoverMediaTests() {
  return discoverTests('media', [
    join(root, 'packages/shared/src'),
    apiTestDir,
    join(root, 'packages/api/src/test'),
  ])
}

/** @type {{ name: string; cmd: string }[]} */
const steps = []

const unitFiles = discoverModerationTsTests()
if (unitFiles.length === 0) {
  console.error('No *moderation-ts*.test.ts files found under packages/api/src')
  process.exit(1)
}

const unitPaths = unitFiles.map((f) => f.replace(/\\/g, '/')).join(' ')
const unitTestFlags = runDbTests ? '--test-force-exit' : ''
steps.push({
  name: 'moderation-ts-unit',
  cmd: `node --import tsx/esm --test ${unitTestFlags} ${unitPaths}`.replace(/\s+/g, ' ').trim(),
})

const mediaFiles = discoverMediaTests()
if (mediaFiles.length === 0) {
  console.error('No *media*.test.ts files found under packages/shared/src or packages/api/src')
  process.exit(1)
}

const mediaPaths = mediaFiles.map((f) => f.replace(/\\/g, '/')).join(' ')
const mediaTestFlags = runDbTests ? '--test-force-exit' : ''
steps.push({
  name: 'media-ts-tests',
  cmd: `node --import tsx/esm --test ${mediaTestFlags} ${mediaPaths}`.replace(/\s+/g, ' ').trim(),
})

const moderationDbTestPaths =
  'packages/api/src/test/moderation-ts-intake.test.ts packages/api/src/test/moderation-ts-admin.test.ts packages/api/src/test/moderation-scoped.test.ts packages/api/src/test/legal-alpha.test.ts'
if (runDbTests) {
  steps.push({
    name: 'moderation-ts-db',
    cmd: `node --import tsx/esm --test --test-force-exit ${moderationDbTestPaths}`,
  })
}

const intakeTest = join(apiTestDir, 'lib/moderation-report-intake.test.ts')
if (existsSync(intakeTest)) {
  steps.push({
    name: 'moderation-report-intake',
    cmd: 'node --import tsx/esm --test packages/api/src/lib/moderation-report-intake.test.ts',
  })
}

if (runE2e) {
  if (!existsSync(moderationE2eSpec)) {
    console.error(`VERIFY_TS_E2E=1 but missing ${moderationE2eSpec}`)
    process.exit(1)
  }
  if (!existsSync(mediaE2eSpec)) {
    console.error(`VERIFY_TS_E2E=1 but missing ${mediaE2eSpec}`)
    process.exit(1)
  }
  steps.push({
    name: 'moderation-ts-e2e',
    cmd: 'npx playwright test e2e/moderation-ts.spec.ts',
  })
  steps.push({
    name: 'media-ts-e2e',
    cmd: 'npx playwright test e2e/media-ts.spec.ts',
  })
}

/** @type {{ name: string; ok: boolean; status: number | null }[]} */
const results = []

function runStep(step) {
  console.log(`\n${'='.repeat(72)}\n▶ ${step.name}\n   ${step.cmd}\n${'='.repeat(72)}\n`)
  const r = spawnSync(step.cmd, {
    shell: true,
    stdio: 'inherit',
    cwd: root,
    env: process.env,
  })
  const ok = r.status === 0
  results.push({ name: step.name, ok, status: r.status ?? 1 })
  if (!ok) {
    console.error(`\n✗ FAILED: ${step.name} (exit ${r.status ?? 1})`)
    return false
  }
  console.log(`\n✓ PASSED: ${step.name}`)
  return true
}

console.log('Trust & Safety verification (T&S-1 + T&S-2 gate)')
console.log(`Moderation unit test files: ${unitFiles.length}`)
console.log(`Media test files: ${mediaFiles.length}`)
for (const f of mediaFiles) console.log(`  - ${f.replace(/\\/g, '/')}`)
console.log(
  `DB tests: ${runDbTests ? 'enabled (USE_DATABASE=true)' : 'skipped — set USE_DATABASE=true or run verify:trust-safety:local'}`
)
console.log(`E2E: ${runE2e ? 'enabled (VERIFY_TS_E2E=1)' : 'skipped — set VERIFY_TS_E2E=1 with dev stack up'}\n`)

let stoppedAt = null
for (const step of steps) {
  if (!runStep(step)) {
    stoppedAt = step.name
    break
  }
}

const passed = results.filter((r) => r.ok).length
console.log(`\n${'='.repeat(72)}`)
console.log('SUMMARY')
console.log('='.repeat(72))
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`)
}
console.log(`\n${passed}/${steps.length} steps passed`)
if (stoppedAt) {
  console.log(`Stopped at: ${stoppedAt}`)
  process.exit(1)
}
console.log('='.repeat(72))
