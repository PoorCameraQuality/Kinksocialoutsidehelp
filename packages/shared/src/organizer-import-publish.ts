/** Idempotent program import: stable keys, diff, and field comparison (shared by API + web). */

export type ProgramSlotSnapshot = {
  id: string
  importKey: string
  title: string
  startsAt: string
  endsAt: string
  description?: string | null
  location?: string | null
  linkUrl?: string | null
  trackLabel?: string | null
  roomLabel?: string | null
  locationId?: string | null
  sortOrder?: number
}

export type ProgramImportCandidate = {
  sourceRowKey: string
  importKey: string
  title: string
  startsAt: string
  endsAt: string
  description?: string
  location?: string
  linkUrl?: string
  trackLabel?: string
  roomLabel?: string
  locationId?: string
  sortOrder: number
  presenterUsernames: string[]
  validationErrors: string[]
  /** Row is valid but not schedulable yet (no times). */
  unplaced: boolean
}

export type ProgramPublishDiff = {
  newCount: number
  updatedCount: number
  unchangedCount: number
  invalidCount: number
  unplacedCount: number
  skippedCount: number
  missingFromSourceCount: number
  missingFromSourceKeys: string[]
  conflicts: string[]
  total: number
  /** Per importKey classification for UI detail. */
  byImportKey: Record<
    string,
    { status: 'new' | 'update' | 'unchanged' | 'invalid' | 'unplaced'; sourceRowKey: string }
  >
}

export type FallbackImportKeyInput = {
  sourceId: string
  rowKey: string
  title?: string
  startsAt?: string
  endsAt?: string
  room?: string
  sheetName?: string
}

/** Deterministic 32-bit FNV-1a hex - stable across browser and Node. */
export function fnv1aHex(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function generateFallbackImportKey(input: FallbackImportKeyInput): string {
  const payload = [
    input.sourceId,
    input.sheetName ?? '',
    input.rowKey,
    input.title ?? '',
    input.startsAt ?? '',
    input.endsAt ?? '',
    input.room ?? '',
  ].join('|')
  const hash = fnv1aHex(payload)
  const slug = (input.title ?? 'row')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const key = `gen-${slug}-${hash}`.slice(0, 128)
  return key || `gen-${hash}`
}

export function resolveImportKey(
  explicit: string | undefined | null,
  fallback: FallbackImportKeyInput,
): string {
  const trimmed = (explicit ?? '').trim()
  if (trimmed) return trimmed.slice(0, 128)
  return generateFallbackImportKey(fallback)
}

function normStr(v: string | null | undefined): string {
  return (v ?? '').trim()
}

function normIso(v: string | Date | null | undefined): string {
  if (!v) return ''
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

export function programCandidateMatchesExisting(
  candidate: ProgramImportCandidate,
  existing: ProgramSlotSnapshot,
): boolean {
  return (
    normStr(candidate.title) === normStr(existing.title) &&
    normIso(candidate.startsAt) === normIso(existing.startsAt) &&
    normIso(candidate.endsAt) === normIso(existing.endsAt) &&
    normStr(candidate.description) === normStr(existing.description) &&
    normStr(candidate.location) === normStr(existing.location) &&
    normStr(candidate.linkUrl) === normStr(existing.linkUrl) &&
    normStr(candidate.trackLabel) === normStr(existing.trackLabel) &&
    normStr(candidate.roomLabel) === normStr(existing.roomLabel) &&
    normStr(candidate.locationId) === normStr(existing.locationId)
  )
}

export function computeProgramPublishDiff(
  candidates: ProgramImportCandidate[],
  existingByImportKey: Map<string, ProgramSlotSnapshot>,
): ProgramPublishDiff {
  const byImportKey: ProgramPublishDiff['byImportKey'] = {}
  const importKeysInBatch = new Set<string>()
  let newCount = 0
  let updatedCount = 0
  let unchangedCount = 0
  let invalidCount = 0
  let unplacedCount = 0
  const conflicts: string[] = []

  for (const c of candidates) {
    if (c.validationErrors.length) {
      invalidCount++
      byImportKey[c.importKey] = { status: 'invalid', sourceRowKey: c.sourceRowKey }
      continue
    }
    if (c.unplaced) {
      unplacedCount++
      byImportKey[c.importKey] = { status: 'unplaced', sourceRowKey: c.sourceRowKey }
      continue
    }
    importKeysInBatch.add(c.importKey)
    const existing = existingByImportKey.get(c.importKey)
    if (!existing) {
      newCount++
      byImportKey[c.importKey] = { status: 'new', sourceRowKey: c.sourceRowKey }
      continue
    }
    if (programCandidateMatchesExisting(c, existing)) {
      unchangedCount++
      byImportKey[c.importKey] = { status: 'unchanged', sourceRowKey: c.sourceRowKey }
    } else {
      updatedCount++
      byImportKey[c.importKey] = { status: 'update', sourceRowKey: c.sourceRowKey }
    }
  }

  const missingFromSourceKeys: string[] = []
  for (const key of existingByImportKey.keys()) {
    if (!importKeysInBatch.has(key)) missingFromSourceKeys.push(key)
  }

  return {
    newCount,
    updatedCount,
    unchangedCount,
    invalidCount,
    unplacedCount,
    skippedCount: unchangedCount,
    missingFromSourceCount: missingFromSourceKeys.length,
    missingFromSourceKeys,
    conflicts,
    total: candidates.length,
    byImportKey,
  }
}

export function extractPresenterUsernames(raw: unknown): string[] {
  if (typeof raw === 'string') {
    return raw
      .split(/[|,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean)
  }
  return []
}
