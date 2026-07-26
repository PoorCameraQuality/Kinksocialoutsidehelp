import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import net from 'node:net'
import { db } from '../db/index.js'
import { eckeHealthDiagnostic } from '../lib/health-ecke.js'
import { storageHealthDiagnostic } from '../lib/health-storage.js'
import { searchHealthDiagnostic } from '../lib/search/health.js'
import { isErrorTrackingTestRouteAllowed } from '../lib/error-tracking.js'
import { mailConfigDiagnostic } from '../lib/mail-config.js'
import { readWorkerHeartbeatDiagnostic } from '../lib/worker-heartbeat.js'

const READY_DB_TIMEOUT_MS = 2500
const DEP_CHECK_TIMEOUT_MS = 1200

async function pingTcp(host: string, port: number, timeoutMs = DEP_CHECK_TIMEOUT_MS): Promise<boolean> {
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

function isStrictReadinessEnabled(): boolean {
  return process.env.HEALTH_STRICT_READINESS === 'true'
}

async function runDependencyChecks(): Promise<Record<string, 'ok' | 'error' | 'skipped'>> {
  const checks: Record<string, 'ok' | 'error' | 'skipped'> = {}

  if (process.env.NODE_ENV === 'production') {
    const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'
    try {
      const parsed = new URL(redisUrl.replace(/^redis:\/\//, 'http://'))
      checks.redis = (await pingTcp(parsed.hostname, Number(parsed.port || 6379))) ? 'ok' : 'error'
    } catch {
      checks.redis = 'error'
    }

    const clamdHost = process.env.CLAMD_HOST ?? '127.0.0.1'
    const clamdPort = Number(process.env.CLAMD_PORT ?? '3310')
    checks.clamav = (await pingTcp(clamdHost, clamdPort)) ? 'ok' : 'error'

    const s3Endpoint = process.env.S3_ENDPOINT?.trim()
    if (s3Endpoint) {
      try {
        const u = new URL(s3Endpoint)
        checks.s3 = (await pingTcp(u.hostname, Number(u.port || 9000))) ? 'ok' : 'error'
      } catch {
        checks.s3 = 'error'
      }
    } else {
      checks.s3 = 'skipped'
    }
  }

  return checks
}

function readinessStatus(degraded: boolean): number {
  return degraded && isStrictReadinessEnabled() ? 503 : 200
}

/** Liveness: process is up; no dependency checks. */
export async function registerHealthRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => ({ ok: true }))

  app.get('/api/health/live', async () => ({ ok: true }))

  app.get('/api/health/mail', async () => mailConfigDiagnostic())

  app.get('/api/health/storage', async () => storageHealthDiagnostic())

  app.get('/api/health/ecke', async () => eckeHealthDiagnostic())

  app.get('/api/health/search', async () => searchHealthDiagnostic())

  app.get('/api/health/worker', async () => readWorkerHeartbeatDiagnostic())

  app.get('/api/health/error-test', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!isErrorTrackingTestRouteAllowed(req.headers as Record<string, unknown>)) {
      return reply.status(404).send({ error: 'Not found' })
    }
    const err = new Error('C2K error tracking test — no sensitive data attached')
    throw err
  })

  /**
   * Readiness: when `USE_DATABASE=true`, verifies Postgres and optional prod deps.
   */
  app.get('/api/health/ready', async (_req, reply: FastifyReply) => {
    if (process.env.USE_DATABASE !== 'true') {
      return reply.send({ ok: true, ready: true, database: 'skipped' as const })
    }

    const checks: Record<string, 'ok' | 'error' | 'skipped'> = {}

    try {
      const ping = db.$client.query('SELECT 1')
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), READY_DB_TIMEOUT_MS)
      })
      await Promise.race([ping, timeout])
      checks.database = 'ok'
    } catch {
      return reply.status(503).send({
        ok: false,
        ready: false,
        database: 'error' as const,
        code: 'db_ping_failed',
        error: 'Database unreachable',
      })
    }

    Object.assign(checks, await runDependencyChecks())

    const degraded = Object.values(checks).some((v) => v === 'error')
    return reply.status(readinessStatus(degraded)).send({
      ok: !degraded,
      ready: !degraded,
      ...checks,
    })
  })
}
