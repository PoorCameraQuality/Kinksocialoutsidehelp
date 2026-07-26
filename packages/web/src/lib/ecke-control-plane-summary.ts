/** Parse control-plane ECKE overview responses for compact status widgets. */

export type EckeControlPlaneSummary = {
  bridgeConnected: boolean
  aggregateStatus: 'never' | 'draft' | 'published' | 'error' | 'stale' | null
  externalSlug: string | null
  lastPublishedAt: string | null
  lastPreviewAt: string | null
  lastError: string | null
}

type HistoryRow = {
  targetKind?: string
  externalSlug?: string
  status?: string
  lastPublishedAt?: string | null
  lastPreviewAt?: string | null
  lastError?: string | null
}

type OverviewCard = {
  status?: string
  preview?: { status?: string; lastPreviewAt?: string | null }
}

function optionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string'
}

function optionalNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string'
}

function isHistoryRow(value: unknown): value is HistoryRow {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Record<string, unknown>
  return (
    optionalString(row.targetKind) &&
    optionalString(row.externalSlug) &&
    optionalString(row.status) &&
    optionalNullableString(row.lastPublishedAt) &&
    optionalNullableString(row.lastPreviewAt) &&
    optionalNullableString(row.lastError)
  )
}

function isOverviewCard(value: unknown): value is OverviewCard {
  if (typeof value !== 'object' || value === null) return false
  const card = value as Record<string, unknown>
  return optionalString(card.status)
}

export function parseEckeControlPlaneSummary(payload: {
  bridgeConnected?: boolean
  history?: unknown[]
  cards?: unknown[]
}): EckeControlPlaneSummary {
  const bridgeConnected = Boolean(payload.bridgeConnected)
  const history = (payload.history ?? []).filter(isHistoryRow)

  const errorRow = history.find((r) => r.status === 'error')
  const publishedRow = history.find((r) => r.status === 'published')
  const staleRow = history.find((r) => r.status === 'stale')
  const draftRow = history.find((r) => r.status === 'draft')
  const previewRow = history.find((r) => r.lastPreviewAt)

  const cardStatus = (payload.cards ?? []).filter(isOverviewCard).find((c) => c.status)?.status
  const aggregateStatus =
    errorRow ? 'error'
    : staleRow ? 'stale'
    : publishedRow ? 'published'
    : draftRow ? 'draft'
    : previewRow ? 'draft'
    : cardStatus === 'published' ? 'published'
    : cardStatus === 'draft' ? 'draft'
    : cardStatus === 'error' ? 'error'
    : cardStatus === 'stale' ? 'stale'
    : history.length ? 'never'
    : null

  const best = errorRow ?? staleRow ?? publishedRow ?? draftRow ?? previewRow ?? history[0]

  return {
    bridgeConnected,
    aggregateStatus: aggregateStatus as EckeControlPlaneSummary['aggregateStatus'],
    externalSlug: best?.externalSlug ?? null,
    lastPublishedAt: best?.lastPublishedAt ?? null,
    lastPreviewAt: best?.lastPreviewAt ?? null,
    lastError: errorRow?.lastError ?? null,
  }
}
