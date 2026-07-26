import {
  MEDIA_HASH_KINDS,
  MEDIA_HASH_LIST_ACTIONS,
  MEDIA_HASH_LIST_SOURCES,
  mediaHashListSourceSchema,
  policyReasonSchema,
  type MediaHashKind,
  type MediaHashListAction,
} from '@c2k/shared'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../db/index.js'

export class MediaHashListAdminError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MediaHashListAdminError'
  }
}

export const createHashListEntryBodySchema = z.object({
  hashKind: z.enum([MEDIA_HASH_KINDS.sha256, MEDIA_HASH_KINDS.perceptual]),
  hashValue: z.string().min(8).max(128),
  hashAlgorithm: z.string().max(64).optional(),
  listAction: z.enum([MEDIA_HASH_LIST_ACTIONS.deny, MEDIA_HASH_LIST_ACTIONS.review]),
  policyReason: policyReasonSchema,
  source: mediaHashListSourceSchema.default(MEDIA_HASH_LIST_SOURCES.internal),
  reasonCode: z.string().min(1).max(64),
  notesPrivate: z.string().max(8000).optional(),
  expiresAt: z.string().datetime().optional(),
  moderationCaseId: z.string().uuid().optional(),
})

export async function listMediaHashListEntries(opts: { limit?: number; activeOnly?: boolean }) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200)
  const conditions = []
  if (opts.activeOnly !== false) {
    conditions.push(eq(schema.mediaHashListEntries.active, true))
  }
  const rows = await db
    .select()
    .from(schema.mediaHashListEntries)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.mediaHashListEntries.createdAt))
    .limit(limit)
  return rows.map((row) => ({
    id: row.id,
    hashKind: row.hashKind,
    hashValue: row.hashValue,
    listAction: row.listAction,
    policyReason: row.policyReason,
    source: row.source,
    reasonCode: row.reasonCode,
    active: row.active,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    createdByAdminId: row.createdByAdminId,
    hasPrivateNotes: Boolean(row.notesPrivate?.trim()),
  }))
}

export async function createMediaHashListEntry(
  adminUserId: string,
  body: z.infer<typeof createHashListEntryBodySchema>
) {
  if (!body.reasonCode.trim()) {
    throw new MediaHashListAdminError('reasonCode is required for hash list entries')
  }

  const [row] = await db
    .insert(schema.mediaHashListEntries)
    .values({
      hashKind: body.hashKind as MediaHashKind,
      hashValue: body.hashValue.trim().toLowerCase(),
      hashAlgorithm: body.hashAlgorithm ?? null,
      listAction: body.listAction as MediaHashListAction,
      policyReason: body.policyReason,
      source: body.source,
      reasonCode: body.reasonCode.trim(),
      notesPrivate: body.notesPrivate ?? null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      addedByUserId: adminUserId,
      createdByAdminId: adminUserId,
      moderationCaseId: body.moderationCaseId ?? null,
      active: true,
    })
    .returning()

  return row!
}
