#!/usr/bin/env node
/**
 * Prelaunch Wave 1 gate — typecheck, API tests, production build.
 * E2E and script smokes remain in `npm run verify:alpha` (local/staging).
 */
import { spawnSync } from 'node:child_process'

/** @type {{ name: string; cmd: string }[]} */
const steps = [
  { name: 'typecheck', cmd: 'npm run typecheck' },
  { name: 'test', cmd: 'npm test' },
  { name: 'build', cmd: 'npm run build' },
]

/** @type {{ name: string; ok: boolean; status: number | null }[]} */
const results = []

function runStep(step) {
  console.log(`\n${'='.repeat(72)}\n▶ ${step.name}\n   ${step.cmd}\n${'='.repeat(72)}\n`)
  const r = spawnSync(step.cmd, {
    shell: true,
    stdio: 'inherit',
    cwd: process.cwd(),
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

console.log('Prelaunch verification (Wave 1 gate)')
console.log(`Steps: ${steps.length}`)
console.log('E2E: not included — run `npm run verify:alpha` locally or on staging.\n')

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
