#!/usr/bin/env node
/**
 * Self-contained local alpha gate — orchestrates Docker, DB, dev servers, then verify:alpha:auto.
 *
 * Usage: npm run verify:alpha:auto:local
 *
 * Gate is trimmed for speed: one prelaunch pass + alpha-focused E2E (not full Playwright matrix).
 * Full suite: npm run test:e2e. Faster slice: VERIFY_SKIP_PILOT_SMOKES=1 VERIFY_SKIP_SCREENSHOTS=1.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const WEB = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
const API = process.env.API_BASE ?? 'http://127.0.0.1:3001'
const MAILPIT = process.env.MAILPIT_API ?? 'http://127.0.0.1:8025'
const COMPOSE = 'docker compose -f docker-compose.dev.yml'
const LOG_DIR = join(process.cwd(), 'docs', 'audits', 'ui')
const DEV_LOG = join(LOG_DIR, 'verify-alpha-dev.log')

mkdirSync(LOG_DIR, { recursive: true })

/** @type {import('node:child_process').ChildProcess | null} */
let devProc = null
let startedDev = false

function run(cmd, label) {
  console.log(`\n${'='.repeat(72)}\n▶ ${label}\n   ${cmd}\n${'='.repeat(72)}\n`)
  const r = spawnSync(cmd, { shell: true, stdio: 'inherit', cwd: process.cwd(), env: process.env })
  if (r.status !== 0) {
    console.error(`\n✗ FAILED: ${label} (exit ${r.status ?? 1})`)
    process.exit(r.status ?? 1)
  }
  console.log(`\n✓ PASSED: ${label}`)
}

async function fetchOk(url, timeoutMs = 500) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}

async function waitForHttp(label, url, { timeoutMs = 180_000, intervalMs = 1500, predicate } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 5000)
      const res = await fetch(url, { signal: ctrl.signal })
      clearTimeout(t)
      if (res.ok) {
        if (predicate) {
          const body = await res.json()
          if (predicate(body)) {
            console.log(`[ready] ${label} — ${url}`)
            return
          }
        } else {
          console.log(`[ready] ${label} — ${url}`)
          return
        }
      }
    } catch {
      /* retry */
    }
    console.log(`[wait] ${label} not ready yet…`)
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`${label} not ready within ${timeoutMs}ms (${url})`)
}

async function stackReady() {
  const webOk = await fetchOk(`${WEB}/api/health/ready`)
  if (!webOk) return false
  try {
    const res = await fetch(`${WEB}/api/health/ready`)
    const body = await res.json()
    return body.database === 'ok'
  } catch {
    return false
  }
}

function startDev() {
  console.log(`\n▶ Starting dev servers (log: ${DEV_LOG})\n`)
  const logStream = createWriteStream(DEV_LOG, { flags: 'a' })
  logStream.write(`\n--- verify:alpha:auto:local ${new Date().toISOString()} ---\n`)
  devProc = spawn('npm run dev', {
    shell: true,
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  })
  startedDev = true
  devProc.stdout?.pipe(logStream)
  devProc.stderr?.pipe(logStream)
  devProc.on('error', (err) => console.error('[dev] spawn error:', err.message))
}

function stopDev() {
  if (!devProc || !startedDev) return
  console.log('\n▶ Stopping dev servers started by verify:alpha:auto:local\n')
  try {
    if (process.platform === 'win32') {
      spawnSync(`taskkill /PID ${devProc.pid} /T /F`, { shell: true, stdio: 'ignore' })
    } else {
      process.kill(-devProc.pid, 'SIGTERM')
    }
  } catch {
    devProc.kill('SIGTERM')
  }
  devProc = null
  startedDev = false
}

process.on('SIGINT', () => {
  stopDev()
  process.exit(130)
})
process.on('exit', () => stopDev())

async function main() {
  console.log('Alpha automated verification — local orchestrator (verify:alpha:auto:local)\n')

  run(`${COMPOSE} up -d`, 'docker compose up')
  run('npm run db:prepare', 'db:prepare')

  const alreadyUp = await stackReady()
  if (alreadyUp) {
    console.log('\n✓ Dev stack already reachable — reusing existing servers\n')
  } else {
    startDev()
    await waitForHttp('web+api (proxied ready)', `${WEB}/api/health/ready`, {
      predicate: (b) => b.database === 'ok',
    })
  }

  await waitForHttp('mailpit', `${MAILPIT}/api/v1/info`)

  // Direct API health (pilot smokes use API_BASE)
  await waitForHttp('api direct', `${API}/api/health/ready`, {
    predicate: (b) => b.database === 'ok',
  })

  const gateEnv = {
    ...process.env,
    PLAYWRIGHT_SKIP_WEBSERVER: '1',
    PLAYWRIGHT_BASE_URL: WEB,
    API_BASE: API,
    MAILPIT_API: MAILPIT,
  }

  console.log(`\n${'='.repeat(72)}\n▶ verify:alpha:auto (automated gate)\n${'='.repeat(72)}\n`)
  const gate = spawnSync('node scripts/verify-alpha-auto.mjs', {
    shell: true,
    stdio: 'inherit',
    cwd: process.cwd(),
    env: gateEnv,
  })

  stopDev()

  if (gate.status !== 0) {
    console.error(`\n✗ verify:alpha:auto FAILED (exit ${gate.status ?? 1})`)
    console.error(`Dev log: ${DEV_LOG}`)
    process.exit(gate.status ?? 1)
  }

  console.log(`\n${'='.repeat(72)}`)
  console.log('PASS  verify:alpha:auto:local — full automated alpha gate green')
  console.log('='.repeat(72))
  console.log(`Screenshots: docs/audits/ui/screenshots/latest-alpha/`)
  console.log(`Gate log:    docs/audits/ui/verify-alpha-auto.log (if tee used)`)
  console.log(`Human-only:  npm run verify:alpha:manual (subjective pilot acceptance)`)
}

main().catch((err) => {
  console.error(err)
  stopDev()
  process.exit(1)
})
