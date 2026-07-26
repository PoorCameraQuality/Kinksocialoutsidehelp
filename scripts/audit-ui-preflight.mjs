#!/usr/bin/env node
/**
 * UI architecture audit preflight — fails loudly if runtime deps or auth are broken.
 * Usage: npm run audit:ui-preflight
 */
import net from 'node:net'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'docs/audits/ui/generated')

const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
const apiBase = process.env.AUDIT_API_BASE_URL ?? base
const demoPassword = process.env.E2E_DEMO_PASSWORD ?? 'demo'
const adminPassword = process.env.BRAX_ADMIN_PASSWORD ?? 'Airship!2'
const pgHost = process.env.PGHOST ?? '127.0.0.1'
const pgPort = parseInt(process.env.PGPORT ?? '6432', 10)

const checks = []

function fail(name, detail) {
  checks.push({ name, ok: false, detail })
  return false
}

function pass(name, detail = 'ok') {
  checks.push({ name, ok: true, detail })
  return true
}

function pingTcp(host, port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port })
    const timer = setTimeout(() => {
      socket.destroy()
      resolve(false)
    }, timeoutMs)
    socket.on('connect', () => {
      clearTimeout(timer)
      socket.destroy()
      resolve(true)
    })
    socket.on('error', () => {
      clearTimeout(timer)
      resolve(false)
    })
  })
}

async function fetchJson(url, init) {
  const res = await fetch(url, init)
  let body = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { res, body }
}

async function main() {
  console.log('UI audit preflight\n')

  if (await pingTcp(pgHost, pgPort)) {
    pass('postgres_tcp', `${pgHost}:${pgPort}`)
  } else {
    fail(
      'postgres_tcp',
      `Postgres not reachable at ${pgHost}:${pgPort}. Run: docker compose -f docker-compose.dev.yml up -d && npm run db:prepare`,
    )
  }

  try {
    const webRes = await fetch(base, { signal: AbortSignal.timeout(8000) })
    if (webRes.ok) pass('web_server', base)
    else fail('web_server', `${base} returned ${webRes.status}`)
  } catch (err) {
    fail('web_server', `${base} unreachable — run npm run dev (${err.message})`)
  }

  try {
    const { res, body } = await fetchJson(`${apiBase}/api/health/ready`, {
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok && body?.database === 'ok') {
      pass('api_health_ready', 'database ok')
    } else if (res.status === 503) {
      fail('api_health_ready', 'database error — run npm run db:prepare')
    } else {
      fail('api_health_ready', `unexpected response ${res.status}`)
    }
  } catch (err) {
    fail('api_health_ready', `API unreachable at ${apiBase} (${err.message})`)
  }

  try {
    const { res, body } = await fetchJson(`${apiBase}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'RopeDreamer', password: demoPassword }),
      signal: AbortSignal.timeout(10000),
    })
    if (res.status >= 500) {
      fail('seed_login', `POST /api/auth/session returned ${res.status} — ${JSON.stringify(body)}`)
    } else if (res.ok) {
      pass('seed_login', 'RopeDreamer login ok')
    } else if (res.status === 401) {
      fail('seed_login', 'Invalid credentials for RopeDreamer — run npm run db:seed')
    } else if (res.status === 503 && body?.code === 'db_unavailable') {
      fail('seed_login', 'Database unavailable during login')
    } else {
      fail('seed_login', `unexpected status ${res.status}`)
    }
  } catch (err) {
    fail('seed_login', err.message)
  }

  try {
    const { res, body } = await fetchJson(`${apiBase}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Brax', password: adminPassword }),
      signal: AbortSignal.timeout(10000),
    })
    if (res.status >= 500) {
      fail('admin_login', `POST /api/auth/session returned ${res.status}`)
    } else if (res.ok) {
      pass('admin_login', 'Brax login ok')
    } else if (res.status === 401) {
      fail('admin_login', 'Invalid credentials for Brax — run npm run db:seed')
    } else {
      fail('admin_login', `unexpected status ${res.status}`)
    }
  } catch (err) {
    fail('admin_login', err.message)
  }

  const auditUser = `audit${Date.now().toString(36)}`
  const auditEmail = `${auditUser}@audit.local`
  try {
    const { res, body } = await fetchJson(`${apiBase}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: auditUser,
        email: auditEmail,
        password: 'AuditTest1!',
        ageAffirmed: true,
        termsAccepted: true,
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (res.status >= 500) {
      fail('registration', `POST /api/auth/register returned ${res.status} — ${JSON.stringify(body)}`)
    } else if (res.ok) {
      pass('registration', `created ${auditUser}`)
    } else if (res.status === 503 && body?.code === 'db_unavailable') {
      fail('registration', 'Database unavailable during registration')
    } else if (res.status === 409) {
      pass('registration', '409 conflict (username taken) — auth path reachable')
    } else {
      fail('registration', `unexpected status ${res.status}: ${JSON.stringify(body)}`)
    }
  } catch (err) {
    fail('registration', err.message)
  }

  const report = {
    generatedAt: new Date().toISOString(),
    base,
    apiBase,
    ok: checks.every((c) => c.ok),
    checks,
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(path.join(OUT_DIR, 'preflight-report.json'), JSON.stringify(report, null, 2))

  console.log('\nPreflight results:')
  for (const c of checks) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}: ${c.detail}`)
  }

  if (!report.ok) {
    console.error('\nPreflight FAILED — fix runtime before running audit:ui-architecture')
    process.exit(1)
  }

  console.log('\nPreflight passed.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
