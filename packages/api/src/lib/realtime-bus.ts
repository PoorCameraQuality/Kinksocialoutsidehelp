import { getRealtimeRedisBridge } from './realtime-redis-bridge.js'

type RealtimeEvent = {
  scope: string
  eventType: string
  payload: Record<string, unknown>
}

type RealtimeSubscriber = (event: RealtimeEvent) => void

const subscribersByScope = new Map<string, Set<RealtimeSubscriber>>()

export function subscribeToScope(scope: string, listener: RealtimeSubscriber): () => void {
  const set = subscribersByScope.get(scope) ?? new Set<RealtimeSubscriber>()
  set.add(listener)
  subscribersByScope.set(scope, set)
  return () => {
    const current = subscribersByScope.get(scope)
    if (!current) return
    current.delete(listener)
    if (current.size === 0) subscribersByScope.delete(scope)
  }
}

/** Fan-out on this API process only (used by Redis bridge subscriber). */
export function publishLocalToScope(
  scope: string,
  eventType: string,
  payload: Record<string, unknown>,
): void {
  const set = subscribersByScope.get(scope)
  if (!set || set.size === 0) return
  const event: RealtimeEvent = { scope, eventType, payload }
  for (const listener of set) listener(event)
}

export function publishToScope(scope: string, eventType: string, payload: Record<string, unknown>): void {
  publishLocalToScope(scope, eventType, payload)
  getRealtimeRedisBridge()?.publishRemote(scope, eventType, payload)
}
