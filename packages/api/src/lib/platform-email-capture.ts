import { db, schema } from '../db/index.js'

export type CaptureEventType =
  | 'subscribe'
  | 'subscribe_pending'
  | 'subscribe_confirmed'
  | 'broadcast'
  | 'unsubscribe'

export async function capturePlatformEmail(params: {
  email: string
  eventType: CaptureEventType
  scopeType?: 'organization' | 'group'
  scopeId?: string
  scopeName?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  const normalized = params.email.trim().toLowerCase()
  if (!normalized.includes('@')) return
  try {
    await db.insert(schema.platformEmailCaptures).values({
      email: normalized,
      eventType: params.eventType,
      scopeType: params.scopeType ?? null,
      scopeId: params.scopeId ?? null,
      scopeName: params.scopeName ?? null,
      metadata: params.metadata ?? {},
    })
  } catch (err) {
    console.warn('[platform-email-capture] insert failed', err)

  }

}



export function isPlatformAdminEmail(email: string | null | undefined): boolean {

  if (!email) return false

  const allow = process.env.C2K_PLATFORM_ADMIN_EMAILS?.trim()

  if (!allow) return false

  const normalized = email.trim().toLowerCase()

  return allow

    .split(',')

    .map((s) => s.trim().toLowerCase())

    .filter(Boolean)

    .includes(normalized)

}


