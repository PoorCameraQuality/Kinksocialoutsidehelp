import type { ScheduleSlot } from '@/components/conventions/convention-schedule-types'

export class ConventionProgramApiError extends Error {
  status: number
  body: string

  constructor(status: number, body: string) {
    super(body || `HTTP ${status}`)
    this.status = status
    this.body = body
  }
}

function convBase(slug: string) {
  return `/api/v1/conventions/${encodeURIComponent(slug)}`
}

async function convFetch<T>(slug: string, path: string, init?: RequestInit): Promise<T> {
  const headers: HeadersInit = {
    Accept: 'application/json',
    ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init?.headers ?? {}),
  }
  const res = await fetch(`${convBase(slug)}${path}`, {
    credentials: 'include',
    ...init,
    headers,
  })
  const text = await res.text()
  if (!res.ok) {
    throw new ConventionProgramApiError(res.status, text)
  }
  if (text) {
    return JSON.parse(text) as T
  }
  return undefined as T
}

export type ProgramSlotRow = {
  id: string
  startsAt: string
  endsAt: string
  title: string
  track: string | null
  room: string | null
  description: string | null
  sortOrder: number
  presenterUserIds: string[]
  staffAssignments: Array<{ userId: string; roleLabel: string }>
}

export type OrganizerPersonOption = {
  userId: string
  username: string
  displayName: string | null
}

export type StaffShiftRow = {
  id: string
  personName: string
  role: string
  startsAt: string
  endsAt: string
  sortOrder: number
}

export type ConventionOrganizerMeta = {
  id: string
  slug: string
  name: string
  description: string | null
  timezone: string
  startsAt: string
  endsAt: string
  settings: Record<string, unknown> | null
}

function slotToRow(slot: ScheduleSlot, index: number): ProgramSlotRow {
  return {
    id: slot.id,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    title: slot.title,
    track: slot.trackLabel ?? null,
    room: slot.roomLabel?.trim() || slot.location?.trim() || null,
    description: slot.description,
    sortOrder: index,
    presenterUserIds: (slot.presenters ?? []).map((p) => p.userId),
    staffAssignments: (slot.staff ?? []).map((s) => ({ userId: s.userId, roleLabel: s.roleLabel })),
  }
}

const STAFF_TITLE_SEP = ' | '

export function staffShiftTitle(personName: string, role: string): string {
  return `${personName.trim()}${STAFF_TITLE_SEP}${role.trim()}`
}

export function parseStaffShiftTitle(title: string): { personName: string; role: string } {
  const idx = title.indexOf(STAFF_TITLE_SEP)
  if (idx >= 0) {
    return {
      personName: title.slice(0, idx).trim(),
      role: title.slice(idx + STAFF_TITLE_SEP.length).trim(),
    }
  }
  return { personName: title.trim(), role: '' }
}

export async function loadConventionMeta(slug: string): Promise<ConventionOrganizerMeta> {
  const res = await convFetch<{ convention: ConventionOrganizerMeta }>(slug, '')
  return res.convention
}

export async function loadProgramSlots(slug: string): Promise<{
  slots: ProgramSlotRow[]
  timezone: string
  windowStartsAt: string
  windowEndsAt: string
}> {
  const [meta, slotsRes] = await Promise.all([
    loadConventionMeta(slug),
    convFetch<{ items: ScheduleSlot[] }>(slug, '/slots'),
  ])
  const items = slotsRes.items ?? []
  return {
    slots: items.map(slotToRow),
    timezone: meta.timezone,
    windowStartsAt: meta.startsAt,
    windowEndsAt: meta.endsAt,
  }
}

export async function createProgramSlot(
  slug: string,
  input: {
    startsAt: string
    endsAt: string
    title: string
    room?: string | null
    track?: string | null
    description?: string | null
  },
): Promise<void> {
  await convFetch(slug, '/slots', {
    method: 'POST',
    body: JSON.stringify({
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      title: input.title,
      roomLabel: input.room ?? undefined,
      trackLabel: input.track ?? undefined,
      description: input.description ?? undefined,
    }),
  })
}

export async function moveProgramSlot(
  slug: string,
  slotId: string,
  input: { startsAt: string; endsAt: string },
): Promise<void> {
  await convFetch(slug, `/slots/${encodeURIComponent(slotId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function updateProgramSlot(
  slug: string,
  slotId: string,
  input: {
    startsAt?: string
    endsAt?: string
    title?: string
    room?: string | null
    track?: string | null
    description?: string | null
  },
): Promise<void> {
  await convFetch(slug, `/slots/${encodeURIComponent(slotId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.room !== undefined ? { roomLabel: input.room ?? undefined } : {}),
      ...(input.track !== undefined ? { trackLabel: input.track ?? undefined } : {}),
      ...(input.description !== undefined ? { description: input.description ?? undefined } : {}),
    }),
  })
}

export async function updateProgramSlotPresenters(
  slug: string,
  slotId: string,
  userIds: string[],
): Promise<void> {
  await convFetch(slug, `/slots/${encodeURIComponent(slotId)}/presenters`, {
    method: 'PUT',
    body: JSON.stringify({ userIds }),
  })
}

export async function updateProgramSlotStaff(
  slug: string,
  slotId: string,
  assignments: Array<{ userId: string; roleLabel: string; startsAt: string; endsAt: string }>,
): Promise<void> {
  await convFetch(slug, `/slots/${encodeURIComponent(slotId)}/staff`, {
    method: 'PUT',
    body: JSON.stringify({ assignments }),
  })
}

export async function loadConventionOrganizerPeople(slug: string): Promise<OrganizerPersonOption[]> {
  const res = await fetch(`/api/v1/organizer/people/conventions/${encodeURIComponent(slug)}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  const text = await res.text()
  if (!res.ok) {
    throw new ConventionProgramApiError(res.status, text)
  }
  const data = JSON.parse(text) as {
    people?: Array<{ userId: string; username: string; displayName: string | null }>
  }
  return (data.people ?? []).map((p) => ({
    userId: p.userId,
    username: p.username,
    displayName: p.displayName,
  }))
}

export async function deleteProgramSlot(slug: string, slotId: string): Promise<void> {
  await convFetch(slug, `/slots/${encodeURIComponent(slotId)}`, { method: 'DELETE' })
}

export async function loadStaffShifts(slug: string): Promise<{ shifts: StaffShiftRow[]; timezone: string }> {
  const [meta, res] = await Promise.all([
    loadConventionMeta(slug),
    convFetch<{
      items: Array<{ id: string; title: string; startsAt: string; endsAt: string; sortOrder: number }>
    }>(slug, '/volunteer-shifts'),
  ])
  const shifts = (res.items ?? []).map((row) => {
    const { personName, role } = parseStaffShiftTitle(row.title)
    return {
      id: row.id,
      personName,
      role,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      sortOrder: row.sortOrder,
    }
  })
  return { shifts, timezone: meta.timezone }
}

export async function createStaffShift(
  slug: string,
  input: { personName: string; role: string; startsAt: string; endsAt: string },
): Promise<void> {
  await convFetch(slug, '/volunteer-shifts', {
    method: 'POST',
    body: JSON.stringify({
      title: staffShiftTitle(input.personName, input.role),
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    }),
  })
}

export async function deleteStaffShift(slug: string, shiftId: string): Promise<void> {
  await convFetch(slug, `/volunteer-shifts/${encodeURIComponent(shiftId)}`, { method: 'DELETE' })
}

export type ConventionEckeListingDetails = {
  highlights?: string[]
  venueName?: string | null
  websiteUrl?: string | null
}

export type ConventionSettingsPatch = {
  dancecardPublishStatus?: 'draft' | 'published'
  registrationAccessCode?: string
  staffAccessCode?: string
  publicProgramListing?: boolean
  dancecardSlug?: string
  dancecardEnabled?: boolean
  venueRooms?: string[]
  eckeListing?: ConventionEckeListingDetails
}

export async function patchConventionOrganizerSettings(
  slug: string,
  patch: {
    name?: string
    description?: string | null
    timezone?: string
    startsAt?: string
    endsAt?: string
    settings?: ConventionSettingsPatch & Record<string, unknown>
  },
): Promise<ConventionOrganizerMeta> {
  const res = await convFetch<{ convention: ConventionOrganizerMeta }>(slug, '', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return res.convention
}

export type ScheduleWarning = {
  kind: string
  message: string
  slotIds?: string[]
}

export async function loadScheduleWarnings(slug: string): Promise<ScheduleWarning[]> {
  const res = await convFetch<{ warnings?: ScheduleWarning[] }>(slug, '/schedule-warnings')
  return res.warnings ?? []
}

export type ConventionDocument = {
  id: string
  title: string
  url: string
  type?: string
  visibility: string
}

export type ConventionCustomPage = {
  id: string
  slug: string
  title: string
  visibility: string
}

export type StaffRosterEntry = {
  userId: string
  username: string
  displayName: string | null
  roles: string[]
  nextStartsAt?: string | null
  nextLabel?: string | null
  canAssignStaffSchedules?: boolean
}

export async function loadConventionDocuments(slug: string): Promise<ConventionDocument[]> {
  const res = await convFetch<{ items?: ConventionDocument[] }>(slug, '/documents')
  return res.items ?? []
}

export async function loadConventionCustomPages(slug: string): Promise<ConventionCustomPage[]> {
  const res = await convFetch<{ items?: ConventionCustomPage[] }>(slug, '/custom-pages')
  return res.items ?? []
}

export async function loadStaffRoster(slug: string): Promise<StaffRosterEntry[]> {
  const res = await convFetch<{ items?: StaffRosterEntry[] }>(slug, '/staff-roster')
  return res.items ?? []
}
