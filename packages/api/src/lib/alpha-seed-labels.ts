/**
 * Alpha demo seed labeling — batch registry, item marks, and API attachment helpers.
 */
import { buildAlphaContentLabel, type AlphaContentLabel } from '@c2k/shared'
import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/index.js'

export const ALPHA_ECKE_BATCH_KEY = 'alpha-ecke-demo'
/** Fictional social-layer seed (users, posts, groups, DMs) — separate from ECKE import batch. */
export const ALPHA_SOCIAL_BATCH_KEY = 'alpha-social-seed'

export type AlphaSeedMarkInput = {
  targetType: string
  targetId: string
  sourceType?: string
  sourceSlug?: string
  labelText?: string
  isSynthetic?: boolean
  isPublicSource?: boolean
}

export async function ensureAlphaSeedBatch(input: {
  batchKey?: string
  sourceName: string
  sourceUrl?: string
  sourceRepo?: string
  notes?: string
}): Promise<{ id: string; batchKey: string }> {
  const batchKey = input.batchKey ?? ALPHA_ECKE_BATCH_KEY
  const [existing] = await db
    .select()
    .from(schema.alphaSeedBatches)
    .where(eq(schema.alphaSeedBatches.batchKey, batchKey))
    .limit(1)
  if (existing) return { id: existing.id, batchKey: existing.batchKey }

  const [created] = await db
    .insert(schema.alphaSeedBatches)
    .values({
      batchKey,
      sourceName: input.sourceName,
      sourceUrl: input.sourceUrl,
      sourceRepo: input.sourceRepo,
      notes: input.notes,
    })
    .returning()
  if (!created) throw new Error(`Failed to create alpha seed batch ${batchKey}`)
  return { id: created.id, batchKey: created.batchKey }
}

export async function markAlphaSeedItem(
  batchId: string,
  input: AlphaSeedMarkInput,
): Promise<void> {
  await db
    .insert(schema.alphaSeedItems)
    .values({
      batchId,
      targetType: input.targetType,
      targetId: input.targetId,
      sourceType: input.sourceType,
      sourceSlug: input.sourceSlug,
      labelText: input.labelText ?? 'ALPHA TEST',
      isSynthetic: input.isSynthetic ?? false,
      isPublicSource: input.isPublicSource ?? false,
    })
    .onConflictDoNothing({
      target: [
        schema.alphaSeedItems.batchId,
        schema.alphaSeedItems.targetType,
        schema.alphaSeedItems.targetId,
      ],
    })
}

export function createAlphaSeedMarker(batchId: string) {
  return async (input: AlphaSeedMarkInput) => markAlphaSeedItem(batchId, input)
}

export type AlphaSeedMarker = ReturnType<typeof createAlphaSeedMarker>

export async function getAlphaLabelsForTargets(
  targetType: string,
  targetIds: string[],
): Promise<Map<string, AlphaContentLabel>> {
  const map = new Map<string, AlphaContentLabel>()
  if (targetIds.length === 0) return map

  const rows = await db
    .select({
      targetId: schema.alphaSeedItems.targetId,
      labelText: schema.alphaSeedItems.labelText,
      isSynthetic: schema.alphaSeedItems.isSynthetic,
      isPublicSource: schema.alphaSeedItems.isPublicSource,
    })
    .from(schema.alphaSeedItems)
    .where(
      and(
        eq(schema.alphaSeedItems.targetType, targetType),
        inArray(schema.alphaSeedItems.targetId, targetIds),
      ),
    )

  for (const row of rows) {
    map.set(
      row.targetId,
      buildAlphaContentLabel({
        text: row.labelText,
        isSynthetic: row.isSynthetic,
        isPublicSource: row.isPublicSource,
      }),
    )
  }
  return map
}

export function attachAlphaLabelToRows<T extends Record<string, unknown>>(
  rows: T[],
  labels: Map<string, AlphaContentLabel>,
  idKey: keyof T & string = 'id',
): Array<T & { alphaLabel?: AlphaContentLabel }> {
  return rows.map((row) => {
    const id = row[idKey]
    if (typeof id !== 'string') return row
    const alphaLabel = labels.get(id)
    return alphaLabel ? { ...row, alphaLabel } : row
  })
}

export async function attachAlphaLabels<T extends Record<string, unknown>>(
  targetType: string,
  rows: T[],
  idKey: keyof T & string = 'id',
): Promise<Array<T & { alphaLabel?: AlphaContentLabel }>> {
  const ids: string[] = []
  for (const row of rows) {
    const id = row[idKey]
    if (typeof id === 'string') ids.push(id)
  }
  const labels = await getAlphaLabelsForTargets(targetType, ids)
  return attachAlphaLabelToRows(rows, labels, idKey)
}

export async function getAlphaLabelForTarget(
  targetType: string,
  targetId: string,
): Promise<AlphaContentLabel | undefined> {
  const labels = await getAlphaLabelsForTargets(targetType, [targetId])
  return labels.get(targetId)
}

/** Resolve batch id by key; returns undefined when batch was never seeded. */
export async function getAlphaSeedBatchId(batchKey: string): Promise<string | undefined> {
  const [row] = await db
    .select({ id: schema.alphaSeedBatches.id })
    .from(schema.alphaSeedBatches)
    .where(eq(schema.alphaSeedBatches.batchKey, batchKey))
    .limit(1)
  return row?.id
}

export async function listAlphaSeedTargetIds(
  batchId: string,
  targetType: string,
): Promise<string[]> {
  const rows = await db
    .select({ targetId: schema.alphaSeedItems.targetId })
    .from(schema.alphaSeedItems)
    .where(
      and(eq(schema.alphaSeedItems.batchId, batchId), eq(schema.alphaSeedItems.targetType, targetType)),
    )
  return rows.map((r) => r.targetId)
}

export async function withAlphaLabel<T extends Record<string, unknown>>(
  targetType: string,
  row: T,
  idKey: keyof T & string = 'id',
): Promise<T & { alphaLabel?: AlphaContentLabel }> {
  const id = row[idKey]
  if (typeof id !== 'string') return row
  const alphaLabel = await getAlphaLabelForTarget(targetType, id)
  return alphaLabel ? { ...row, alphaLabel } : row
}

export async function withAlphaLabels<T extends Record<string, unknown>>(
  targetType: string,
  rows: T[],
  idKey: keyof T & string = 'id',
): Promise<Array<T & { alphaLabel?: AlphaContentLabel }>> {
  return attachAlphaLabels(targetType, rows, idKey)
}
