import { Redis } from 'ioredis'
import type { FastifyBaseLogger } from 'fastify'
import { publishLocalToScope } from './realtime-bus.js'

const CHANNEL_PREFIX = 'c2k:ws:'

let publisher: InstanceType<typeof Redis> | null = null
let subscriber: InstanceType<typeof Redis> | null = null

export function realtimeRedisBridgeEnabled(): boolean {
  return process.env.C2K_REALTIME_REDIS_BRIDGE === 'true'
}

function channelForScope(scope: string): string {
  return `${CHANNEL_PREFIX}${scope}`
}

function scopeFromChannel(channel: string): string | null {
  if (!channel.startsWith(CHANNEL_PREFIX)) return null
  const scope = channel.slice(CHANNEL_PREFIX.length)
  return scope.length > 0 ? scope : null
}

export function getRealtimeRedisBridge(): { publishRemote: typeof publishRemote } | null {
  if (!realtimeRedisBridgeEnabled() || !publisher) return null
  return { publishRemote }
}

function publishRemote(scope: string, eventType: string, payload: Record<string, unknown>): void {
  if (!publisher) return
  const body = JSON.stringify({ eventType, payload })
  void publisher.publish(channelForScope(scope), body).catch(() => {
    /* logged at init */
  })
}

export async function initRealtimeRedisBridge(log: FastifyBaseLogger): Promise<void> {
  if (!realtimeRedisBridgeEnabled()) return

  const url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'
  publisher = new Redis(url, { maxRetriesPerRequest: 2 })
  subscriber = new Redis(url, { maxRetriesPerRequest: 2 })

  await subscriber.psubscribe(`${CHANNEL_PREFIX}*`)
  subscriber.on('pmessage', (_pattern: string, channel: string, message: string) => {
    const scope = scopeFromChannel(channel)
    if (!scope) return
    try {
      const parsed = JSON.parse(message) as { eventType?: string; payload?: Record<string, unknown> }
      if (typeof parsed.eventType !== 'string') return
      publishLocalToScope(scope, parsed.eventType, parsed.payload ?? {})
    } catch (err) {
      log.warn({ err, channel }, 'realtime redis bridge: bad message')
    }
  })

  log.info({ url }, 'Realtime Redis WS bridge active (C2K_REALTIME_REDIS_BRIDGE=true)')
}

export async function closeRealtimeRedisBridge(): Promise<void> {
  await subscriber?.quit()
  await publisher?.quit()
  subscriber = null
  publisher = null
}
