import { db, schema } from '../db/index.js'

export async function recordModerationAudit(params: {
  actorUserId: string
  scopeType: string
  scopeId?: string | null
  verb: string
  targetType?: string | null
  targetId?: string | null
  payload?: Record<string, unknown>
}): Promise<string> {
  const [row] = await db
    .insert(schema.moderationAuditEvents)
    .values({
      actorUserId: params.actorUserId,
      scopeType: params.scopeType,
      scopeId: params.scopeId ?? null,
      verb: params.verb,
      targetType: params.targetType ?? null,
      targetId: params.targetId ?? null,
      payload: params.payload ?? {},
    })
    .returning({ id: schema.moderationAuditEvents.id })
  return row.id
}
