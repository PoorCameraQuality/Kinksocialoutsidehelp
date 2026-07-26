import { and, eq, inArray } from 'drizzle-orm'
import {
  computeProgramPublishDiff,
  extractPresenterUsernames,
  resolveImportKey,
  type ProgramImportCandidate,
  type ProgramPublishDiff,
  type ProgramSlotSnapshot,
} from '@c2k/shared'
import { db } from '../../db/index.js'
import * as schema from '../../db/schema.js'
import { computeAllConventionScheduleWarnings } from '../convention-schedule-warnings.js'
import { publishToScope } from '../realtime-bus.js'

type ImportRowSelect = typeof schema.conventionImportRows.$inferSelect

export type ProgramPublishSummary = {
  created: number
  updated: number
  unchanged: number
  skipped: number
  invalid: number
  unplaced: number
  missingFromSource: number
  errors: string[]
  warnings?: Awaited<ReturnType<typeof computeAllConventionScheduleWarnings>>
}

function readRawString(raw: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = raw[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

export function candidateFromImportRow(
  row: ImportRowSelect,
  conventionId: string,
  sheetName?: string | null,
): ProgramImportCandidate {
  const raw = (row.rawRow ?? {}) as Record<string, unknown>
  const validationErrors = Array.isArray(row.validationErrors)
    ? (row.validationErrors as string[]).filter((e) => typeof e === 'string')
    : []
  const startsAt = row.startsAt ? row.startsAt.toISOString() : undefined
  const endsAt = row.endsAt ? row.endsAt.toISOString() : undefined
  const title = (row.title ?? readRawString(raw, 'title', 'Title') ?? '').trim()
  const room = row.room ?? readRawString(raw, 'room', 'Room')
  const explicitKey = readRawString(raw, 'importKey', 'import_key', 'importKey')
  const importKey = resolveImportKey(explicitKey, {
    sourceId: sheetName ? `sheet:${sheetName}` : `conv:${conventionId}`,
    rowKey: row.rowKey,
    title: title || undefined,
    startsAt,
    endsAt,
    room,
    sheetName: sheetName ?? undefined,
  })
  const presentersRaw =
    raw.presenterUsernames ?? raw.presenter_usernames ?? raw.presenters
  const presenterUsernames = extractPresenterUsernames(presentersRaw)
  const linkUrl = readRawString(raw, 'linkUrl', 'link_url', 'link')
  const unplaced = !startsAt || !endsAt
  if (!title && !unplaced) validationErrors.push('Missing title')
  return {
    sourceRowKey: row.rowKey,
    importKey,
    title,
    startsAt: startsAt ?? '',
    endsAt: endsAt ?? '',
    description: row.description ?? readRawString(raw, 'description'),
    location: readRawString(raw, 'location', 'Location'),
    linkUrl,
    trackLabel: row.track ?? readRawString(raw, 'track', 'trackLabel', 'track_label'),
    roomLabel: room,
    locationId: row.locationId ?? undefined,
    sortOrder: row.sortOrder ?? 0,
    presenterUsernames,
    validationErrors: [...new Set(validationErrors)],
    unplaced,
  }
}

export function candidateFromCsvRow(
  rowIndex: number,
  get: (names: string[]) => string,
  sourceId = 'csv',
): ProgramImportCandidate {
  const title = get(['title'])
  const startsAt = get(['startsat', 'starts_at'])
  const endsAt = get(['endsat', 'ends_at'])
  const importKey = resolveImportKey(get(['importkey', 'import_key']), {
    sourceId,
    rowKey: `row-${rowIndex}`,
    title: title || undefined,
    startsAt: startsAt || undefined,
    endsAt: endsAt || undefined,
    room: get(['roomlabel', 'room_label', 'room']) || undefined,
  })
  const validationErrors: string[] = []
  if (!title || !startsAt || !endsAt) validationErrors.push('Missing title/start/end')
  let startIso = ''
  let endIso = ''
  if (startsAt) {
    const d = new Date(startsAt)
    if (Number.isNaN(d.getTime())) validationErrors.push('Bad start date')
    else startIso = d.toISOString()
  }
  if (endsAt) {
    const d = new Date(endsAt)
    if (Number.isNaN(d.getTime())) validationErrors.push('Bad end date')
    else endIso = d.toISOString()
  }
  const presentersRaw = get(['presenterusernames', 'presenters', 'presenter_usernames'])
  return {
    sourceRowKey: `row-${rowIndex}`,
    importKey,
    title,
    startsAt: startIso,
    endsAt: endIso,
    description: get(['description']) || undefined,
    location: get(['location']) || undefined,
    linkUrl: get(['linkurl', 'link_url']) || undefined,
    trackLabel: get(['tracklabel', 'track_label', 'track']) || undefined,
    roomLabel: get(['roomlabel', 'room_label', 'room']) || undefined,
    sortOrder: rowIndex,
    presenterUsernames: presentersRaw
      ? presentersRaw
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    validationErrors,
    unplaced: false,
  }
}

export async function loadProgramSlotsByImportKey(
  conventionId: string,
): Promise<Map<string, ProgramSlotSnapshot>> {
  const rows = await db
    .select({
      id: schema.scheduleSlots.id,
      importKey: schema.scheduleSlots.importKey,
      title: schema.scheduleSlots.title,
      startsAt: schema.scheduleSlots.startsAt,
      endsAt: schema.scheduleSlots.endsAt,
      description: schema.scheduleSlots.description,
      location: schema.scheduleSlots.location,
      linkUrl: schema.scheduleSlots.linkUrl,
      trackLabel: schema.scheduleSlots.trackLabel,
      roomLabel: schema.scheduleSlots.roomLabel,
      locationId: schema.scheduleSlots.locationId,
      sortOrder: schema.scheduleSlots.sortOrder,
    })
    .from(schema.scheduleSlots)
    .where(eq(schema.scheduleSlots.conventionId, conventionId))
  const map = new Map<string, ProgramSlotSnapshot>()
  for (const r of rows) {
    if (!r.importKey) continue
    map.set(r.importKey, {
      id: r.id,
      importKey: r.importKey,
      title: r.title,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt.toISOString(),
      description: r.description,
      location: r.location,
      linkUrl: r.linkUrl,
      trackLabel: r.trackLabel,
      roomLabel: r.roomLabel,
      locationId: r.locationId,
      sortOrder: r.sortOrder,
    })
  }
  return map
}

export async function previewProgramPublish(
  conventionId: string,
  candidates: ProgramImportCandidate[],
): Promise<ProgramPublishDiff> {
  const existing = await loadProgramSlotsByImportKey(conventionId)
  return computeProgramPublishDiff(candidates, existing)
}

async function syncPresenters(
  slotId: string,
  usernames: string[],
  errors: string[],
  rowLabel: string,
): Promise<void> {
  if (!usernames.length) return
  const userRows = await db
    .select({ id: schema.users.id, username: schema.users.username })
    .from(schema.users)
    .where(inArray(schema.users.username, usernames))
  const idByName = new Map(userRows.map((u) => [u.username.toLowerCase(), u.id]))
  const userIds: string[] = []
  for (const u of usernames) {
    const uid = idByName.get(u.toLowerCase())
    if (uid) userIds.push(uid)
    else errors.push(`${rowLabel}: unknown username ${u}`)
  }
  await db.delete(schema.scheduleSlotPresenters).where(eq(schema.scheduleSlotPresenters.scheduleSlotId, slotId))
  let order = 0
  for (const uid of userIds) {
    await db.insert(schema.scheduleSlotPresenters).values({
      scheduleSlotId: slotId,
      userId: uid,
      sortOrder: order++,
    })
  }
}

export async function publishProgramCandidates(
  conventionId: string,
  candidates: ProgramImportCandidate[],
  opts?: { dryRun?: boolean },
): Promise<{ diff: ProgramPublishDiff; summary: ProgramPublishSummary }> {
  const existing = await loadProgramSlotsByImportKey(conventionId)
  const diff = computeProgramPublishDiff(candidates, existing)
  const errors: string[] = []
  const summary: ProgramPublishSummary = {
    created: 0,
    updated: 0,
    unchanged: diff.unchangedCount,
    skipped: diff.skippedCount,
    invalid: diff.invalidCount,
    unplaced: diff.unplacedCount,
    missingFromSource: diff.missingFromSourceCount,
    errors,
  }

  if (opts?.dryRun) {
    return { diff, summary }
  }

  const existingMut = new Map(existing)

  for (const c of candidates) {
    if (c.validationErrors.length || c.unplaced) continue
    const status = diff.byImportKey[c.importKey]?.status
    if (status !== 'new' && status !== 'update') continue

    const payload = {
      title: c.title,
      description: c.description,
      location: c.location,
      linkUrl: c.linkUrl,
      trackLabel: c.trackLabel,
      roomLabel: c.roomLabel,
      locationId: c.locationId,
      startsAt: new Date(c.startsAt),
      endsAt: new Date(c.endsAt),
      importKey: c.importKey,
      sortOrder: c.sortOrder,
      updatedAt: new Date(),
    }

    let slotId: string | undefined
    const prev = existingMut.get(c.importKey)
    if (prev) {
      slotId = prev.id
      await db.update(schema.scheduleSlots).set(payload).where(eq(schema.scheduleSlots.id, slotId))
      summary.updated++
    } else {
      const [ins] = await db
        .insert(schema.scheduleSlots)
        .values({
          conventionId,
          ...payload,
          isPublished: false,
        })
        .returning({ id: schema.scheduleSlots.id })
      slotId = ins?.id
      if (slotId) {
        existingMut.set(c.importKey, {
          id: slotId,
          importKey: c.importKey,
          title: c.title,
          startsAt: c.startsAt,
          endsAt: c.endsAt,
          description: c.description,
          location: c.location,
          linkUrl: c.linkUrl,
          trackLabel: c.trackLabel,
          roomLabel: c.roomLabel,
          locationId: c.locationId,
          sortOrder: c.sortOrder,
        })
      }
      summary.created++
    }
    if (slotId && c.presenterUsernames.length) {
      await syncPresenters(slotId, c.presenterUsernames, errors, c.sourceRowKey)
    }
  }

  publishToScope(`convention:${conventionId}:schedule`, 'schedule_import_publish', {
    created: summary.created,
    updated: summary.updated,
  })
  summary.warnings = await computeAllConventionScheduleWarnings(conventionId)
  return { diff, summary }
}

export async function publishStaffImportRows(
  conventionId: string,
  rows: ImportRowSelect[],
): Promise<{ added: number; updated: number; skipped: number }> {
  const existing = await db
    .select()
    .from(schema.conventionVolunteerShifts)
    .where(eq(schema.conventionVolunteerShifts.conventionId, conventionId))
  let added = 0
  let updated = 0
  let skipped = 0
  for (const r of rows) {
    if (!(r.personName && r.role && r.startsAt && r.endsAt)) {
      skipped++
      continue
    }
    const match = existing.find(
      (e) =>
        e.personName === r.personName &&
        e.role === r.role &&
        e.startsAt.getTime() === r.startsAt!.getTime(),
    )
    const values = {
      title: `${r.role}: ${r.personName}`.slice(0, 255),
      personName: r.personName,
      role: r.role,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      locationId: r.locationId ?? undefined,
      sortOrder: r.sortOrder,
    }
    if (match) {
      await db
        .update(schema.conventionVolunteerShifts)
        .set(values)
        .where(eq(schema.conventionVolunteerShifts.id, match.id))
      updated++
    } else {
      const [inserted] = await db
        .insert(schema.conventionVolunteerShifts)
        .values({ conventionId, ...values })
        .returning()
      if (inserted) existing.push(inserted)
      added++
    }
  }
  return { added, updated, skipped }
}
