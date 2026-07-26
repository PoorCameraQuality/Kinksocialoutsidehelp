#!/usr/bin/env node
/**
 * T&S-2 media verification gate — discovers *media*.test.ts and optional Playwright.
 *
 * Unit tests always run (skipped in-file when modules are not ready).
 * DB tests run when USE_DATABASE=true.
 * E2E: set VERIFY_TS_E2E=1 and have dev stack + db:prepare running.
 *
 * Usage:
 *   npm run verify:trust-safety:media
 *   USE_DATABASE=true npm run verify:trust-safety:media
 *   VERIFY_TS_E2E=1 USE_DATABASE=true npm run verify:trust-safety:media
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const e2eSpec = join(root, 'e2e/media-ts.spec.ts')
const runE2e = process.env.VERIFY_TS_E2E === '1'
const runDbTests = process.env.USE_DATABASE === 'true'

/** @param {string[]} roots @returns {string[]} */
function discoverMediaTests(roots) {
  /** @type {string[]} */
  const files = []
  const walk = (dir) => {
    if (!existsSync(dir)) return
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, name.name)
      if (name.isDirectory()) {
        if (name.name === 'node_modules' || name.name === 'dist') continue
        walk(full)
      } else if (name.name.includes('media') && name.name.endsWith('.test.ts')) {
        files.push(full)
      }
    }
  }
  for (const dir of roots) walk(dir)
  return [...new Set(files)].sort()
}

const searchRoots = [
  join(root, 'packages/shared/src'),
  join(root, 'packages/api/src'),
  join(root, 'packages/api/src/test'),
]

const mediaTestFiles = discoverMediaTests(searchRoots)

/** @type {{ name: string; cmd: string }[]} */
const steps = []

if (mediaTestFiles.length === 0) {
  console.error('No *media*.test.ts files found under packages/shared/src or packages/api/src')
  process.exit(1)
}

const unitPaths = mediaTestFiles.map((f) => f.replace(/\\/g, '/')).join(' ')
const unitFlags = runDbTests ? '--test-force-exit' : ''
steps.push({
  name: 'media-ts-unit',
  cmd: `node --import tsx/esm --test ${unitFlags} ${unitPaths}`.replace(/\s+/g, ' ').trim(),
})

if (runE2e) {
  if (!existsSync(e2eSpec)) {
    console.error(`VERIFY_TS_E2E=1 but missing ${e2eSpec}`)
    process.exit(1)
  }
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

console.log('Trust & Safety verification (T&S-2 media gate)')
console.log(`Media test files: ${mediaTestFiles.length}`)
for (const f of mediaTestFiles) console.log(`  - ${f.replace(/\\/g, '/')}`)
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
