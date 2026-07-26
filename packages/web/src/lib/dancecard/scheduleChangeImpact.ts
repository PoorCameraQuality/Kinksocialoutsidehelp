import type { DancecardConflict } from '@/lib/dancecard/conflictScanner'

export type SlotScheduleSnapshot = {
  title: string
  startsAt: string | null
  endsAt: string | null
  room: string | null
  locationId: string | null
  locationName: string | null
}

export type ScheduleChangeHolder = {
  accountId: string
  displayName: string
}

export type ScheduleChangePresenter = {
  personId: string
  sceneName: string
  role: string
  accountId: string | null
}

export type ScheduleChangeImpactReport = {
  scheduleChanged: boolean
  summaryText: string
  slotTitle: string
  before: SlotScheduleSnapshot
  after: SlotScheduleSnapshot
  dancecardHolders: ScheduleChangeHolder[]
  presenters: ScheduleChangePresenter[]
  programConflicts: DancecardConflict[]
}

export function slotSnapshotFromParts(parts: {
  title: string
  starts_at?: string | null
  ends_at?: string | null
  room?: string | null
  location_id?: string | null
  locationName?: string | null
}): SlotScheduleSnapshot {
  return {
    title: String(parts.title ?? ''),
    startsAt: parts.starts_at != null ? String(parts.starts_at) : null,
    endsAt: parts.ends_at != null ? String(parts.ends_at) : null,
    room: (parts.room as string | null) ?? null,
    locationId: (parts.location_id as string | null) ?? null,
    locationName: parts.locationName ?? null,
  }
}

function roomLabel(s: SlotScheduleSnapshot): string {
  return (s.locationName ?? s.room ?? '').trim() || 'TBD'
}

function timeLabel(iso: string | null, tz: string): string {
  if (!iso) return 'unscheduled'
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function scheduleFieldsChanged(before: SlotScheduleSnapshot, after: SlotScheduleSnapshot): boolean {
  const norm = (v: string | null) => (v ?? '').trim()
  if (norm(before.startsAt) !== norm(after.startsAt)) return true
  if (norm(before.endsAt) !== norm(after.endsAt)) return true
  if (norm(before.room) !== norm(after.room)) return true
  if (norm(before.locationId) !== norm(after.locationId)) return true
  return false
}

export function formatScheduleChangeSummary(
  before: SlotScheduleSnapshot,
  after: SlotScheduleSnapshot,
  timezone: string,
): string {
  const title = after.title || before.title || 'Session'
  const parts: string[] = [title]
  const timeBefore = timeLabel(before.startsAt, timezone)
  const timeAfter = timeLabel(after.startsAt, timezone)
  if (timeBefore !== timeAfter) {
    parts.push(`${timeAfter} (was ${timeBefore})`)
  }
  const roomBefore = roomLabel(before)
  const roomAfter = roomLabel(after)
  if (roomBefore !== roomAfter) {
    parts.push(`${roomAfter} (was ${roomBefore})`)
  }
  return parts.join(': ')
}

export function formatScheduleChangeMessage(
  report: Pick<ScheduleChangeImpactReport, 'slotTitle' | 'before' | 'after' | 'summaryText'>,
  timezone: string,
): string {
  const summary =
    report.summaryText ||
    formatScheduleChangeSummary(report.before, report.after, timezone)
  return (
    `${report.slotTitle || 'A session'} was rescheduled · ${summary}. ` +
    'Open Program to see the official time. My dancecard may still show the old time until you review it.'
  )
}

export function snapshotFromOrganizerSlot(slot: {
  title: string
  startsAt: string | null
  endsAt: string | null
  room: string | null
  locationId: string | null
  locationName: string | null
}): SlotScheduleSnapshot {
  return {
    title: slot.title,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    room: slot.room,
    locationId: slot.locationId,
    locationName: slot.locationName,
  }
}
