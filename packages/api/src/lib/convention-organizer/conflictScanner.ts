/**
 * Pure conflict detection for organizer readiness / venue grid (Phase 3 P3.4).
 * No I/O - pass normalized rows from Supabase queries.
 */

export type ConflictSeverity = 'info' | 'warning'

export type DancecardConflict = {
  id: string
  severity: ConflictSeverity
  title: string
  detail?: string
  relatedSlotIds: string[]
  relatedPersonIds?: string[]
}

function intervalsOverlap(a0: number, a1: number, b0: number, b1: number) {
  return a0 < b1 && b0 < a1
}

function roomKey(slot: { id: string; locationId: string | null; room: string | null }) {
  return (slot.locationId ?? '') || (slot.room ?? '').trim().toLowerCase() || `__noloc_${slot.id}`
}

export type ConflictScannerSlot = {
  id: string
  startsAt: string
  endsAt: string
  locationId: string | null
  room: string | null
  isPublished: boolean
  visibility: string | null
  /** Phase 4: when set, conflicts with photographers on restricted/none sessions. */
  photoPolicy?: 'allowed' | 'restricted' | 'none'
}

export type ConflictScannerPersonLink = {
  slotId: string
  personId: string
  role: string
}

export type ConflictScannerInput = {
  slots: ConflictScannerSlot[]
  slotPeople: ConflictScannerPersonLink[]
  /** locationId → max concurrent sessions (from dancecard_locations.capacity) */
  locationCapacity?: Record<string, number>
}

const PRESENTER_ROLES = new Set(['lead_presenter', 'co_presenter', 'moderator'])

export function computeDancecardConflicts(input: ConflictScannerInput): DancecardConflict[] {
  const out: DancecardConflict[] = []
  const { slots, slotPeople } = input

  const slotById = new Map(slots.map((s) => [s.id, s]))

  // --- Venue double-book (same room key, overlapping time) ---
  const overlaps: { a: string; b: string; label: string }[] = []
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i]!
      const b = slots[j]!
      if (roomKey(a) !== roomKey(b)) continue
      const a0 = new Date(a.startsAt).getTime()
      const a1 = new Date(a.endsAt).getTime()
      const b0 = new Date(b.startsAt).getTime()
      const b1 = new Date(b.endsAt).getTime()
      if (!Number.isFinite(a0) || !Number.isFinite(a1) || !Number.isFinite(b0) || !Number.isFinite(b1)) continue
      if (intervalsOverlap(a0, a1, b0, b1)) {
        overlaps.push({ a: a.id, b: b.id, label: `${a.room || a.locationId || '?'} · ${slotById.get(a.id)?.startsAt}` })
      }
    }
  }
  if (overlaps.length) {
    const idList: string[] = []
    for (const o of overlaps) {
      idList.push(o.a, o.b)
    }
    const ids = Array.from(new Set(idList))
    out.push({
      id: 'venue-double-book',
      severity: 'warning',
      title: 'Room / location double-booking',
      detail: overlaps
        .slice(0, 5)
        .map((o) => `${o.a.slice(0, 8)}… / ${o.b.slice(0, 8)}…`)
        .join(' · '),
      relatedSlotIds: ids,
    })
  }

  // --- Location capacity (concurrent sessions exceed capacity) ---
  const caps = input.locationCapacity ?? {}
  if (Object.keys(caps).length) {
    const byLoc = new Map<string, ConflictScannerSlot[]>()
    for (const s of slots) {
      if (!s.locationId) continue
      const list = byLoc.get(s.locationId) ?? []
      list.push(s)
      byLoc.set(s.locationId, list)
    }
    for (const [locId, locSlots] of Array.from(byLoc.entries())) {
      const cap = caps[locId]
      if (cap == null || cap < 1) continue
      const events: { t: number; delta: number; slotId: string }[] = []
      for (const s of locSlots) {
        const a0 = new Date(s.startsAt).getTime()
        const a1 = new Date(s.endsAt).getTime()
        if (!Number.isFinite(a0) || !Number.isFinite(a1)) continue
        events.push({ t: a0, delta: 1, slotId: s.id })
        events.push({ t: a1, delta: -1, slotId: s.id })
      }
      events.sort((a, b) => a.t - b.t || a.delta - b.delta)
      let cur = 0
      const overSlotIds = new Set<string>()
      for (const ev of events) {
        cur += ev.delta
        if (cur > cap) overSlotIds.add(ev.slotId)
      }
      if (overSlotIds.size) {
        out.push({
          id: `location-capacity-${locId}`,
          severity: 'warning',
          title: 'Room capacity exceeded',
          detail: `${cur} concurrent session(s) exceed capacity of ${cap} at this location.`,
          relatedSlotIds: Array.from(overSlotIds),
        })
      }
    }
  }

  // --- Presenter / moderator overlap ---
  const personToSlots = new Map<string, ConflictScannerPersonLink[]>()
  for (const sp of slotPeople) {
    if (!PRESENTER_ROLES.has(sp.role)) continue
    const list = personToSlots.get(sp.personId) ?? []
    list.push(sp)
    personToSlots.set(sp.personId, list)
  }
  for (const [personId, links] of Array.from(personToSlots.entries())) {
    const slotIds = Array.from(new Set(links.map((l) => l.slotId)))
    const pairKeys = new Set<string>()
    for (let i = 0; i < slotIds.length; i++) {
      for (let j = i + 1; j < slotIds.length; j++) {
        const sa = slotById.get(slotIds[i]!)
        const sb = slotById.get(slotIds[j]!)
        if (!sa || !sb) continue
        const a0 = new Date(sa.startsAt).getTime()
        const a1 = new Date(sa.endsAt).getTime()
        const b0 = new Date(sb.startsAt).getTime()
        const b1 = new Date(sb.endsAt).getTime()
        if (intervalsOverlap(a0, a1, b0, b1)) {
          const k = [slotIds[i]!, slotIds[j]!].sort().join(':')
          if (pairKeys.has(k)) continue
          pairKeys.add(k)
          out.push({
            id: `presenter-overlap-${personId}-${k}`,
            severity: 'warning',
            title: 'Presenter / moderator overlap',
            detail: `Same person assigned to overlapping sessions.`,
            relatedSlotIds: [sa.id, sb.id],
            relatedPersonIds: [personId],
          })
        }
      }
    }
  }

  // --- Photographer overlap ---
  const photoToSlots = new Map<string, ConflictScannerPersonLink[]>()
  for (const sp of slotPeople) {
    if (sp.role !== 'photographer') continue
    const list = photoToSlots.get(sp.personId) ?? []
    list.push(sp)
    photoToSlots.set(sp.personId, list)
  }
  for (const [personId, links] of Array.from(photoToSlots.entries())) {
    const slotIds = Array.from(new Set(links.map((l) => l.slotId)))
    const pairKeys = new Set<string>()
    for (let i = 0; i < slotIds.length; i++) {
      for (let j = i + 1; j < slotIds.length; j++) {
        const sa = slotById.get(slotIds[i]!)
        const sb = slotById.get(slotIds[j]!)
        if (!sa || !sb) continue
        const a0 = new Date(sa.startsAt).getTime()
        const a1 = new Date(sa.endsAt).getTime()
        const b0 = new Date(sb.startsAt).getTime()
        const b1 = new Date(sb.endsAt).getTime()
        if (intervalsOverlap(a0, a1, b0, b1)) {
          const k = [slotIds[i]!, slotIds[j]!].sort().join(':')
          if (pairKeys.has(k)) continue
          pairKeys.add(k)
          out.push({
            id: `photographer-overlap-${personId}-${k}`,
            severity: 'warning',
            title: 'Photographer overlap',
            detail: `Same photographer on overlapping sessions.`,
            relatedSlotIds: [sa.id, sb.id],
            relatedPersonIds: [personId],
          })
        }
      }
    }
  }

  // --- Photo policy vs photographer presence (Phase 4) ---
  for (const s of slots) {
    const pol = s.photoPolicy ?? 'allowed'
    if (pol === 'allowed') continue
    const photographers = slotPeople.filter((sp) => sp.slotId === s.id && sp.role === 'photographer')
    if (photographers.length === 0) continue
    out.push({
      id: `photo-policy-${s.id}`,
      severity: pol === 'none' ? 'warning' : 'info',
      title: pol === 'none' ? 'Photographers on no-photo session' : 'Photographers on photo-restricted session',
      detail:
        pol === 'none'
          ? 'Session is marked no photography but has photographer role(s) assigned.'
          : 'Session is marked photo-restricted; confirm coverage is intentional.',
      relatedSlotIds: [s.id],
      relatedPersonIds: photographers.map((p) => p.personId),
    })
  }

  return out
}

/** Dev-only sanity check; run: `npm run test:dancecard-conflicts` (or `node -r ts-node/register -e "require('./src/lib/dancecard/conflictScanner').__conflictScannerSelfTest()"` from repo root). */
export function __conflictScannerSelfTest(): void {
  const t0 = '2026-05-01T14:00:00.000Z'
  const t1 = '2026-05-01T15:00:00.000Z'
  const t2 = '2026-05-01T14:30:00.000Z'
  const t3 = '2026-05-01T16:00:00.000Z'
  const slots: ConflictScannerSlot[] = [
    { id: 'a', startsAt: t0, endsAt: t1, locationId: 'L1', room: null, isPublished: true, visibility: 'public' },
    { id: 'b', startsAt: t2, endsAt: t3, locationId: 'L1', room: null, isPublished: true, visibility: 'public' },
  ]
  const c = computeDancecardConflicts({
    slots,
    slotPeople: [
      { slotId: 'a', personId: 'p1', role: 'lead_presenter' },
      { slotId: 'b', personId: 'p1', role: 'co_presenter' },
    ],
  })
  if (!c.some((x) => x.id === 'venue-double-book')) throw new Error('expected venue-double-book')
  if (!c.some((x) => x.title.includes('Presenter'))) throw new Error('expected presenter overlap')
}
