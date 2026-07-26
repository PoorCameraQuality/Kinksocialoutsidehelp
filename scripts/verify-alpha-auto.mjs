#!/usr/bin/env node
/**
 * Fully automated alpha verification — no manual QA steps.
 * Assumes Docker, DB seed, dev servers, and Mailpit are already running.
 * Local one-command proof: npm run verify:alpha:auto:local
 * CI: start services first, set PLAYWRIGHT_SKIP_WEBSERVER=1, then run this script.
 *
 * Speed notes (vs older gate):
 * - Single verify:prelaunch (typecheck + test + build) — no duplicate compile passes.
 * - test:e2e:alpha-gate — route smokes, alpha flows, door, moderation E2E only (not full suite).
 * - Full Playwright matrix: npm run test:e2e (workflows, permissions, media-ts, etc.).
 *
 * Optional skips:
 * - VERIFY_SKIP_SCREENSHOTS=1
 * - VERIFY_SKIP_PILOT_SMOKES=1
 * - VERIFY_SKIP_E2E=1
 */
import { spawnSync } from 'node:child_process'

const skipScreenshots = process.env.VERIFY_SKIP_SCREENSHOTS === '1'
const skipPilotSmokes = process.env.VERIFY_SKIP_PILOT_SMOKES === '1'
const skipE2e = process.env.VERIFY_SKIP_E2E === '1'

/** @type {{ name: string; cmd: string }[]} */
const steps = [{ name: 'verify:prelaunch', cmd: 'npm run verify:prelaunch' }]

if (!skipE2e) {
  steps.push({ name: 'test:e2e:alpha-gate', cmd: 'npm run test:e2e:alpha-gate' })
}

if (!skipScreenshots) {
  steps.push({ name: 'capture-alpha-screenshots', cmd: 'node scripts/capture-alpha-screenshots.mjs' })
}

if (!skipPilotSmokes) {
  steps.push(
    { name: 'pilot-readiness-smoke', cmd: 'node scripts/pilot-readiness-smoke.mjs' },
    { name: 'smoke-greenfield-registration', cmd: 'node scripts/smoke-greenfield-registration.mjs' },
    { name: 'smoke-reports', cmd: 'node scripts/smoke-reports.mjs' },
    { name: 'smoke-organizer-tab-walk', cmd: 'node scripts/smoke-organizer-tab-walk.mjs' },
    { name: 'smoke-attendee-dancecard', cmd: 'node scripts/smoke-attendee-dancecard.mjs' },
    { name: 'audit-command-bridge', cmd: 'node scripts/audit-command-bridge.mjs' },
    { name: 'smoke-scope-email-double-optin', cmd: 'node scripts/smoke-scope-email-double-optin.mjs' },
    { name: 'smoke-transactional-mail', cmd: 'node scripts/smoke-transactional-mail.mjs' },
  )
}

const results = []

function runStep(step) {
  console.log(`\n${'='.repeat(72)}\n▶ ${step.name}\n   ${step.cmd}\n${'='.repeat(72)}\n`)
  const r = spawnSync(step.cmd, { shell: true, stdio: 'inherit', cwd: process.cwd(), env: process.env })
  const ok = r.status === 0
  results.push({ name: step.name, ok, status: r.status ?? 1 })
  if (!ok) {
    console.error(`\n✗ FAILED: ${step.name} (exit ${r.status ?? 1})`)
    return false
  }
  console.log(`\n✓ PASSED: ${step.name}`)
  return true
}

console.log('Alpha automated verification (verify:alpha:auto)')
console.log(`Steps: ${steps.length}`)
if (skipE2e) console.log('E2E: skipped (VERIFY_SKIP_E2E=1)')
if (skipScreenshots) console.log('Screenshots: skipped (VERIFY_SKIP_SCREENSHOTS=1)')
if (skipPilotSmokes) console.log('Pilot smokes: skipped (VERIFY_SKIP_PILOT_SMOKES=1)')
console.log('Full E2E matrix: npm run test:e2e (not part of this gate)\n')

let stoppedAt = null
for (const step of steps) {
  if (!runStep(step)) {
    stoppedAt = step.name
    break
  }
}

const passed = results.filter((r) => r.ok).length
console.log(`\n${'='.repeat(72)}\nSUMMARY\n${'='.repeat(72)}`)
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`)
}
console.log(`\n${passed}/${steps.length} steps passed`)
if (stoppedAt) console.log(`Stopped at: ${stoppedAt}`)
console.log('='.repeat(72))

if (results.some((r) => !r.ok)) process.exit(1)
