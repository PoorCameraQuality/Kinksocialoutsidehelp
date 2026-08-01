/**
 * Play Spaces Dancecard API client — calendar, share, bookings, program, maps, prefs.
 */
import type { DancecardEntry, PlaySpaceListItem, PlaySpaceMember } from '@/hooks/useApiPlaySpaces'
export type { DancecardEntry, PlaySpaceListItem, PlaySpaceMember }

function errMsg(status: number, bodyError?: string): string {
  if (status === 401) return bodyError ?? 'Sign in with kink.social to continue.'
  if (status === 403) return bodyError ?? 'You do not have access to this play space.'
  return bodyError ?? `Request failed (${status}).`
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { credentials: 'include', ...init })
  const j = (await r.json().catch(() => ({}))) as T & { error?: string }
  if (!r.ok) throw new Error(errMsg(r.status, j.error))
  return j
}

export type CalendarItem = {
  id: string
  startsAt: string
  endsAt: string
  title: string
  kind: 'dancecard_manual' | 'dancecard_slot_signup' | 'dancecard_scene_booking' | string
  location?: string | null
  subtitle?: string
  mutable?: boolean
  sourceKind?: string | null
  sourceId?: string | null
}

export type ProgramSlot = {
  id: string
  title: string
  description?: string | null
  startsAt: string
  endsAt: string
  location?: string | null
  published: boolean
  isOnMyDancecard?: boolean
  personalEntryId?: string | null
}

export type BookingParty = {
  userId?: string
  username?: string | null
  displayName?: string | null
  avatarUrl?: string | null
}

export type BookingRequest = {
  id: string
  hostUserId: string
  guestUserId?: string | null
  guestDisplayName?: string | null
  guestContact?: string | null
  startsAt: string
  endsAt: string
  location?: string | null
  description: string
  status: string
  counterpart?: BookingParty | null
  host?: BookingParty | null
  guest?: BookingParty | null
}

export type PlayMap = { id: string; label: string; imageUrl: string }

export type SharedPayload = {
  playSpaceName: string
  conventionName?: string
  timezone: string
  playSpaceStartsAt?: string
  playSpaceEndsAt?: string
  conventionStartsAt?: string
  conventionEndsAt?: string
  freeGaps: { startsAt: string; endsAt: string }[]
  sharer: { username: string; displayName: string | null; avatarUrl: string | null }
  allowGuestReserve?: boolean
}

export function fetchCalendar(key: string) {
  return jsonFetch<{
    items: CalendarItem[]
    bufferMinutes: number
    freeGaps?: { startsAt: string; endsAt: string }[]
    playSpaceStartsAt?: string
    playSpaceEndsAt?: string
    conventionStartsAt?: string
    conventionEndsAt?: string
    timezone?: string
  }>(`/api/v1/play-spaces/${encodeURIComponent(key)}/dancecard/calendar`)
}

export function fetchPrefs(key: string) {
  return jsonFetch<{
    bufferMinutes: number
    displayName: string | null
    bio: string | null
    avatarUrl: string | null
    contactNote: string | null
  }>(`/api/v1/play-spaces/${encodeURIComponent(key)}/dancecard/prefs`)
}

export function patchPrefs(
  key: string,
  body: {
    bufferMinutes?: number
    displayName?: string | null
    bio?: string | null
    avatarUrl?: string | null
    contactNote?: string | null
  },
) {
  return jsonFetch(`/api/v1/play-spaces/${encodeURIComponent(key)}/dancecard/prefs`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function mintShareLink(key: string, label?: string) {
  return jsonFetch<{ url: string; path: string; share: { token: string; id: string } }>(
    `/api/v1/play-spaces/${encodeURIComponent(key)}/dancecard/share`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(label ? { label } : {}),
    },
  )
}

export function listShares(key: string) {
  return jsonFetch<{ items: { id: string; token: string; label: string | null; revokedAt: string | null }[] }>(
    `/api/v1/play-spaces/${encodeURIComponent(key)}/dancecard/shares`,
  )
}

export function fetchShared(key: string, token: string) {
  return jsonFetch<SharedPayload>(
    `/api/v1/play-spaces/${encodeURIComponent(key)}/dancecard/shared/${encodeURIComponent(token)}`,
  )
}

export function createBooking(
  key: string,
  body: {
    shareToken: string
    startsAt: string
    endsAt: string
    location?: string
    description?: string
    guestDisplayName?: string
    guestContact?: string
  },
) {
  return jsonFetch<{ request: BookingRequest }>(
    `/api/v1/play-spaces/${encodeURIComponent(key)}/dancecard/booking-requests`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

export function listBookings(key: string) {
  return jsonFetch<{ incoming: BookingRequest[]; outgoing: BookingRequest[] }>(
    `/api/v1/play-spaces/${encodeURIComponent(key)}/dancecard/booking-requests`,
  )
}

export function acceptBooking(key: string, id: string) {
  return jsonFetch(`/api/v1/play-spaces/${encodeURIComponent(key)}/dancecard/booking-requests/${id}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
}

export function declineBooking(key: string, id: string) {
  return jsonFetch(`/api/v1/play-spaces/${encodeURIComponent(key)}/dancecard/booking-requests/${id}/decline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
}

export function cancelBooking(key: string, id: string) {
  return jsonFetch(`/api/v1/play-spaces/${encodeURIComponent(key)}/dancecard/booking-requests/${id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
}

export function patchBooking(
  key: string,
  id: string,
  body: {
    description?: string
    location?: string | null
    startsAt?: string
    endsAt?: string
  },
) {
  return jsonFetch(`/api/v1/play-spaces/${encodeURIComponent(key)}/dancecard/booking-requests/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function revokeShare(key: string, shareId: string) {
  return jsonFetch(`/api/v1/play-spaces/${encodeURIComponent(key)}/dancecard/shares/${encodeURIComponent(shareId)}`, {
    method: 'DELETE',
  })
}

export function patchBusyBlock(
  key: string,
  entryId: string,
  body: {
    title?: string
    startsAt?: string
    endsAt?: string
    location?: string | null
    notes?: string | null
  },
) {
  return jsonFetch(`/api/v1/play-spaces/${encodeURIComponent(key)}/dancecard/entries/${encodeURIComponent(entryId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function deleteBusyBlock(key: string, entryId: string) {
  return jsonFetch(`/api/v1/play-spaces/${encodeURIComponent(key)}/dancecard/entries/${encodeURIComponent(entryId)}`, {
    method: 'DELETE',
  })
}

export function fetchProgram(key: string) {
  return jsonFetch<{ items: ProgramSlot[]; canEdit: boolean }>(
    `/api/v1/play-spaces/${encodeURIComponent(key)}/program`,
  )
}

export function createProgramSlot(
  key: string,
  body: {
    title: string
    startsAt: string
    endsAt: string
    description?: string
    location?: string
  },
) {
  return jsonFetch<ProgramSlot>(`/api/v1/play-spaces/${encodeURIComponent(key)}/program`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function deleteProgramSlot(key: string, slotId: string) {
  return jsonFetch(`/api/v1/play-spaces/${encodeURIComponent(key)}/program/${slotId}`, { method: 'DELETE' })
}

export function addProgramToDancecard(key: string, slotId: string) {
  return jsonFetch<{ id: string; alreadyAdded?: boolean }>(
    `/api/v1/play-spaces/${encodeURIComponent(key)}/program/${slotId}/add-to-dancecard`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    },
  )
}

export function removeProgramFromDancecard(key: string, slotId: string) {
  return jsonFetch(`/api/v1/play-spaces/${encodeURIComponent(key)}/program/${slotId}/add-to-dancecard`, {
    method: 'DELETE',
  })
}

export function fetchMaps(key: string) {
  return jsonFetch<{ items: PlayMap[]; canEdit: boolean }>(
    `/api/v1/play-spaces/${encodeURIComponent(key)}/maps`,
  )
}

export async function uploadMapImage(key: string, file: File): Promise<{ path: string; url: string }> {
  const fd = new FormData()
  fd.append('file', file)
  const r = await fetch(`/api/v1/play-spaces/${encodeURIComponent(key)}/maps/upload`, {
    method: 'POST',
    credentials: 'include',
    body: fd,
  })
  const j = (await r.json().catch(() => ({}))) as { path?: string; url?: string; error?: string }
  if (!r.ok || !j.url) throw new Error(errMsg(r.status, j.error ?? 'Upload failed'))
  return { path: j.path ?? '', url: j.url }
}

export function createMap(key: string, body: { label: string; imageUrl: string }) {
  return jsonFetch<PlayMap>(`/api/v1/play-spaces/${encodeURIComponent(key)}/maps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function deleteMap(key: string, mapId: string) {
  return jsonFetch(`/api/v1/play-spaces/${encodeURIComponent(key)}/maps/${mapId}`, { method: 'DELETE' })
}

export function addBusyBlock(
  key: string,
  body: { title: string; startsAt: string; endsAt: string; location?: string; notes?: string },
) {
  return jsonFetch<DancecardEntry>(
    `/api/v1/play-spaces/${encodeURIComponent(key)}/dancecard/entries`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}
