import { Redis } from 'ioredis'

export const WORKER_HEARTBEAT_KEY = 'c2k:worker:heartbeat'

const HEARTBEAT_TTL_SEC = 90
const HEARTBEAT_INTERVAL_MS = 30_000
const MAX_AGE_MS = 90_000

let heartbeatRedis: Redis | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null

export function isWorkerHeartbeatEnabled(): boolean {
  return process.env.WORKER_HEARTBEAT_ENABLED === 'true'
}

export function startWorkerHeartbeat(): void {
  if (!isWorkerHeartbeatEnabled()) return
  const url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'
  heartbeatRedis = new Redis(url, { maxRetriesPerRequest: 2 })
  const beat = () => {
    void heartbeatRedis?.set(
      WORKER_HEARTBEAT_KEY,
      JSON.stringify({ ts: Date.now(), pid: process.pid }),
      'EX',
      HEARTBEAT_TTL_SEC,
    )
  }
  beat()
  heartbeatTimer = setInterval(beat, HEARTBEAT_INTERVAL_MS)
}

export async function stopWorkerHeartbeat(): Promise<void> {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  heartbeatTimer = null
  if (heartbeatRedis) {
    await heartbeatRedis.quit().catch(() => {})
    heartbeatRedis = null
  }
}

export async function readWorkerHeartbeatDiagnostic(): Promise<{
  ok: boolean
  worker: 'ok' | 'stale' | 'missing' | 'skipped'
  ageMs?: number
}> {
  if (!isWorkerHeartbeatEnabled()) {
    return { ok: true, worker: 'skipped' }
  }

  const url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'
  const redis = new Redis(url, { maxRetriesPerRequest: 1, connectTimeout: 1200 })
  try {
    const raw = await redis.get(WORKER_HEARTBEAT_KEY)
    if (!raw) {
      return { ok: false, worker: 'missing' }
    }

    let ts = 0
    try {
      const parsed = JSON.parse(raw) as { ts?: number }
      ts = typeof parsed.ts === 'number' ? parsed.ts : 0
    } catch {
      return { ok: false, worker: 'missing' }
    }

    const ageMs = Date.now() - ts
    if (ageMs > MAX_AGE_MS) {
      return { ok: false, worker: 'stale', ageMs }
    }
    return { ok: true, worker: 'ok', ageMs }
  } catch {
    return { ok: false, worker: 'missing' }
  } finally {
    redis.disconnect()
  }
}
