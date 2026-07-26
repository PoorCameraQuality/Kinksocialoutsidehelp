#!/usr/bin/env node
/**
 * Self-contained T&S-1 + T&S-2 verification — Docker, DB prepare, unit + DB tests, optional E2E.
 *
 * Usage: npm run verify:trust-safety
 *        VERIFY_TS_E2E=1 npm run verify:trust-safety
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const LOG_DIR = join(process.cwd(), 'docs', 'audits', 'trust-and-safety')
const LOG_FILE = join(LOG_DIR, 'verify-trust-safety.log')
const COMPOSE = 'docker compose -f docker-compose.dev.yml'
const runE2e = process.env.VERIFY_TS_E2E === '1'

mkdirSync(LOG_DIR, { recursive: true })

function run(cmd, label) {
  console.log(`\n${'='.repeat(72)}\n▶ ${label}\n   ${cmd}\n${'='.repeat(72)}\n`)
  const r = spawnSync(cmd, {
    shell: true,
    stdio: 'inherit',
    cwd: process.cwd(),
    env: { ...process.env, USE_DATABASE: 'true' },
  })
  if (r.status !== 0) {
    console.error(`\n✗ FAILED: ${label} (exit ${r.status ?? 1})`)
    process.exit(r.status ?? 1)
  }
  console.log(`\n✓ PASSED: ${label}`)
}

console.log('T&S-1 + T&S-2 local verification gate')
console.log(`Log directory: ${LOG_DIR}`)
console.log(`E2E: ${runE2e ? 'enabled (VERIFY_TS_E2E=1)' : 'skipped'}\n`)

run(`${COMPOSE} up -d`, 'docker compose up')
run('npm run db:prepare', 'db:prepare')
run('node scripts/verify-trust-safety.mjs', 'verify:trust-safety (moderation + media unit/DB/E2E)')

spawnSync(
  `echo T&S verify-trust-safety-local PASSED at $(date -Iseconds 2>/dev/null || date) >> "${LOG_FILE.replace(/\\/g, '/')}"`,
  { shell: true, stdio: 'ignore' }
)

console.log(`\n${'='.repeat(72)}`)
console.log('T&S-1 + T&S-2 local gate: ALL STEPS PASSED')
console.log('='.repeat(72))
