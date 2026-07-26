'use client'

import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { formatInTimeZone } from 'date-fns-tz'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { organizerTabHref, useOrganizerWorkspacePath } from '@/components/dancecard/organizer/organizerWorkspaceContext'
import {
  clampSlotIntervalToWindow,
  dayKeysInWindow,
  formatDayHeader,
  formatTimeLabel,
  instantFromRow,
  rowIndexForInstant,
} from '@/components/dancecard/organizer/organizerTimeline'
import { SessionDetailDrawer } from '@/components/dancecard/organizer/SessionDetailDrawer'
import {
  ScheduleChangeImpactModal,
  type ScheduleChangeImpactPayload,
} from '@/components/dancecard/organizer/ScheduleChangeImpactModal'
import type { ScheduleChangeImpactReport } from '@/lib/dancecard/scheduleChangeImpact'
import {
  OrganizerConfirmDialog,
  useOrganizerToast,
} from '@/components/dancecard/organizer/ui'
import {
  ProgramGridDroppableCell,
  ProgramSlotDragOverlay,
  ProgramSessionEditButton,
  ProgramUnassignedPool,
} from '@/components/dancecard/organizer/program/programScheduleParts'
import {
  PROGRAM_UNASSIGNED_POOL_ID,
  parseProgramCellDropId,
  parseProgramSlotDragId,
  programCellDropId,
  programSlotDragId,
} from '@/components/dancecard/organizer/program/programScheduleDndIds'
import type { ProgramSlotRow } from '@/lib/dancecard/organizerProgramSlotDto'
import { isProgramSlotScheduled, programSlotRoomLabel } from '@/lib/dancecard/organizerProgramSlotDto'
import { slotCardVisual } from '@/lib/dancecard/trackDisplayColors'
import { PROGRAM_GRID_END_HOUR_EXCL, PROGRAM_GRID_START_HOUR } from '@/lib/dancecard/programGridConfig'
import { cn } from '@/lib/cn'

export type { ProgramSlotRow } from '@/lib/dancecard/organizerProgramSlotDto'

const ROW_H = 26
const COL_MIN_W_DEFAULT = 120
const COL_MIN_W_WIDE = 168
const GRID_START_HOUR = PROGRAM_GRID_START_HOUR
const GRID_END_HOUR_EXCL = PROGRAM_GRID_END_HOUR_EXCL
const SLOT_STEP = 30
const DEFAULT_SLOT_DURATION_MS = 60 * 60 * 1000

const programScheduleCollision: CollisionDetection = (args) => {
  const byPointer = pointerWithin(args)
  if (byPointer.length > 0) return byPointer
  return rectIntersection(args)
}

export type ProgramScheduleGridLabels = {
  scheduledItem: string
  scheduledItemPlural: string
  addItemCta: string
}

const DEFAULT_GRID_LABELS: ProgramScheduleGridLabels = {
  scheduledItem: 'activity',
  scheduledItemPlural: 'activities',
  addItemCta: 'Add activity',
}

type LocationRow = { id: string; name: string; parentId?: string | null }

function isLeafLocation(locations: LocationRow[], id: string) {
  return !locations.some((l) => l.parentId === id)
}

function roomLocationOptions(locations: LocationRow[]): LocationRow[] {
  if (!locations.length) return []
  const leaves = locations.filter((l) => isLeafLocation(locations, l.id))
  const list = leaves.length ? leaves : locations
  return [...list].sort((a, b) => a.name.localeCompare(b.name))
}

function RoomLocationField({
  value,
  onChange,
  locations,
  locationsLoadErr,
  venuesHref,
}: {
  value: string
  onChange: (locationId: string) => void
  locations: LocationRow[]
  locationsLoadErr: string | null
  venuesHref: string
}) {
  const options = useMemo(() => roomLocationOptions(locations), [locations])

  return (
    <label className="block text-xs uppercase tracking-wide text-dc-muted">
      Room / location
      <select
        className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">None</option>
        {options.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      {locationsLoadErr ? <p className="mt-1 text-sm text-dc-danger">{locationsLoadErr}</p> : null}
      {!locationsLoadErr && options.length === 0 ? (
        <p className="mt-1 text-xs text-dc-muted">
          No rooms yet. Add them on the{' '}
          <a href={venuesHref} className="text-dc-accent hover:underline">
            Venues
          </a>{' '}
          tab.
        </p>
      ) : null}
    </label>
  )
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function displayTrack(slot: ProgramSlotRow) {
  return (slot.trackName ?? slot.track ?? '').trim()
}

function capitalizeWords(s: string) {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function DraggableProgramSlot({
  slot,
  top,
  height,
  rowH,
  tz,
  colWidth,
  readOnly,
  selected,
  onToggleSelect,
  onOpenDrawer,
  hasConflict,
  sonarPulse,
  scheduledItemLabel,
}: {
  slot: ProgramSlotRow
  top: number
  height: number
  rowH: number
  tz: string
  colWidth: number
  readOnly?: boolean
  selected: boolean
  onToggleSelect: (id: string) => void
  onOpenDrawer: (slot: ProgramSlotRow) => void
  hasConflict?: boolean
  sonarPulse?: boolean
  scheduledItemLabel: string
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: programSlotDragId(slot.id),
    disabled: readOnly,
  })
  const tr = displayTrack(slot)
  const visual = slotCardVisual({ trackColorHex: slot.trackColor, trackName: tr || 'track' })
  const room = programSlotRoomLabel(slot)
  const timeLabel =
    slot.startsAt && slot.endsAt
      ? `${formatTimeLabel(slot.startsAt, tz)} – ${formatTimeLabel(slot.endsAt, tz)}`
      : 'Unscheduled'
  const rowSpan = height / rowH
  const compact = rowSpan < 2.5
  const showRoom = !compact && Boolean(room)
  const showTrack = rowSpan >= 3.5 && Boolean(tr)
  const showStatus = rowSpan >= 4
  const visibilityLabel =
    slot.visibility === 'staff_only' ? 'staff only' : slot.visibility === 'secret' ? 'hidden' : slot.visibility

  const style: CSSProperties = {
    top,
    height: Math.max(height, rowH),
    width: colWidth - 6,
    left: 3,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 30 : 10,
    touchAction: 'none',
    ...visual.style,
  }

  const openDetails = () => onOpenDrawer(slot)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'absolute overflow-hidden rounded-lg px-1.5 py-1 text-left',
        visual.className,
        hasConflict && '!border-dc-warning ring-2 ring-dc-warning/50',
        selected && !hasConflict && '!border-dc-accent ring-2 ring-dc-accent/40',
        hasConflict && sonarPulse && 'dc-conflict-sonar',
        !slot.isPublished && 'ring-1 ring-dashed ring-dc-warning/60 opacity-90',
        slot.isPublished && !hasConflict && 'ring-1 ring-emerald-500/30',
        !readOnly && 'cursor-pointer',
      )}
      onDoubleClick={(e) => {
        if (readOnly) return
        e.stopPropagation()
        openDetails()
      }}
      title={readOnly ? undefined : `${slot.title}. Double-click to edit`}
    >
      {hasConflict ? (
        <span
          className="absolute right-1 top-1 z-30 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white"
          title="Schedule conflict"
          aria-hidden
        >
          !
        </span>
      ) : null}
      {!readOnly ? (
        <ProgramSessionEditButton
          slotTitle={slot.title}
          scheduledItemLabel={scheduledItemLabel}
          compact={compact}
          className={cn(compact && 'absolute right-0.5 top-0.5 z-20')}
          onClick={openDetails}
        />
      ) : null}
      <div
        className={cn(
          'flex items-start gap-1',
          compact && !readOnly && 'pr-8',
          !readOnly && 'cursor-grab touch-none active:cursor-grabbing',
        )}
        title={readOnly ? undefined : `${slot.title}. Drag to move`}
        {...(readOnly ? {} : { ...listeners, ...attributes })}
      >
        {!readOnly ? (
          <input
            type="checkbox"
            className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-dc-accent"
            checked={selected}
            aria-label={`Select ${slot.title}`}
            onChange={() => onToggleSelect(slot.id)}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate font-semibold leading-tight text-dc-text',
              compact ? 'text-[10px]' : 'text-xs',
            )}
          >
            {slot.title}
          </p>
          <p className="mt-0.5 truncate text-dc-micro leading-tight text-dc-muted" title={timeLabel}>
            {timeLabel}
          </p>
          {showRoom ? (
            <p className="truncate text-dc-micro leading-tight text-dc-subtle" title={room}>
              {room}
            </p>
          ) : null}
          {showTrack ? (
            <p className="truncate text-[0.625rem] leading-tight text-dc-subtle" title={tr}>
              {tr}
            </p>
          ) : null}
          {showStatus && (!slot.isPublished || slot.visibility !== 'public') ? (
            <div className="mt-0.5 flex flex-wrap gap-1">
              {!slot.isPublished ? <span className="text-[9px] font-medium text-dc-warning">draft</span> : null}
              {slot.visibility !== 'public' ? (
                <span className="text-[9px] text-dc-muted">{visibilityLabel}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function ProgramScheduleGrid({
  eventSlug,
  timezone,
  windowStartsAt,
  windowEndsAt,
  slots,
  onRefresh,
  readOnly = false,
  initialSlotId = null,
  onSlotLinkChange,
  conflictSlotIds = [],
  conflictSonarActive = false,
  onConflictsRefresh,
  drawerInitialTab,
  onDrawerTabConsumed,
  wideCanvas = false,
  gridLabels,
  onOpenImport,
}: {
  eventSlug: string
  timezone: string
  windowStartsAt: string
  windowEndsAt: string
  slots: ProgramSlotRow[]
  onRefresh: () => Promise<void>
  readOnly?: boolean
  initialSlotId?: string | null
  onSlotLinkChange?: (slotId: string | null) => void
  conflictSlotIds?: string[]
  conflictSonarActive?: boolean
  onConflictsRefresh?: () => void | Promise<void>
  drawerInitialTab?: 'overview' | 'edit' | 'location' | 'people' | 'registrants' | 'privacy' | 'notes'
  onDrawerTabConsumed?: () => void
  wideCanvas?: boolean
  gridLabels?: ProgramScheduleGridLabels
  onOpenImport?: () => void
}) {
  const scheduleNouns = gridLabels ?? DEFAULT_GRID_LABELS
  const workspaceBase = useOrganizerWorkspacePath(eventSlug)
  const venuesHref = `${organizerTabHref(workspaceBase, 'venues')}&venuesPanel=setup`
  const toast = useOrganizerToast()
  const colMinW = wideCanvas ? COL_MIN_W_WIDE : COL_MIN_W_DEFAULT
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTitle, setConfirmTitle] = useState('')
  const [confirmMessage, setConfirmMessage] = useState('')
  const [confirmDestructive, setConfirmDestructive] = useState(false)
  const confirmActionRef = useRef<(() => Promise<void>) | null>(null)
  const [search, setSearch] = useState('')
  const [filterTrack, setFilterTrack] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [drawerSlot, setDrawerSlot] = useState<ProgramSlotRow | null>(null)
  const [zoom, setZoom] = useState(1)
  const [activeDrawerTab, setActiveDrawerTab] = useState<
    'overview' | 'edit' | 'location' | 'people' | 'registrants' | 'privacy' | 'notes' | undefined
  >()
  const [scheduleImpactPayload, setScheduleImpactPayload] = useState<ScheduleChangeImpactPayload | null>(null)
  const conflictSet = useMemo(() => new Set(conflictSlotIds), [conflictSlotIds])
  const rowH = ROW_H * zoom

  useEffect(() => {
    if (!initialSlotId || !slots.length) return
    const match = slots.find((s) => s.id === initialSlotId)
    if (match) {
      setDrawerSlot(match)
      return
    }
    if (drawerSlot?.id === initialSlotId) setDrawerSlot(null)
    onSlotLinkChange?.(null)
  }, [initialSlotId, slots, drawerSlot?.id, onSlotLinkChange])

  useEffect(() => {
    const drawerId = drawerSlot?.id
    if (!drawerId) return
    const fresh = slots.find((s) => s.id === drawerId)
    if (fresh) setDrawerSlot(fresh)
  }, [slots, drawerSlot?.id])

  useEffect(() => {
    if (drawerInitialTab) setActiveDrawerTab(drawerInitialTab)
  }, [drawerInitialTab])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const t = e.target as HTMLElement | null
        if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.isContentEditable) return
        window.dispatchEvent(new CustomEvent('dc-organizer-show-shortcuts'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function askConfirm(title: string, message: string, action: () => Promise<void>, destructive = false) {
    setConfirmTitle(title)
    setConfirmMessage(message)
    setConfirmDestructive(destructive)
    confirmActionRef.current = action
    setConfirmOpen(true)
  }

  const [locations, setLocations] = useState<LocationRow[]>([])
  const [locationsLoadErr, setLocationsLoadErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLocationsLoadErr(null)
      try {
        const res = await organizerDancecardFetch<{ locations: LocationRow[] }>(eventSlug, '/locations')
        if (cancelled) return
        setLocations(
          (res.locations ?? []).map((l) => ({
            id: l.id,
            name: l.name,
            parentId: l.parentId ?? null,
          })),
        )
      } catch (e) {
        if (cancelled) return
        setLocationsLoadErr(e instanceof Error ? e.message : 'Could not load rooms')
        setLocations([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [eventSlug])

  const trackOptions = useMemo(() => {
    const set = new Set<string>()
    for (const s of slots) {
      const d = displayTrack(s)
      if (d) set.add(d)
    }
    return Array.from(set).sort()
  }, [slots])

  const tagNameOptions = useMemo(() => {
    const set = new Set<string>()
    for (const s of slots) {
      for (const n of s.tagNames) set.add(n)
    }
    return Array.from(set).sort()
  }, [slots])

  const filteredSlots = useMemo(() => {
    const q = search.trim().toLowerCase()
    return slots.filter((s) => {
      if (filterTrack && displayTrack(s) !== filterTrack) return false
      if (filterTag && !s.tagNames.includes(filterTag)) return false
      if (q) {
        const blob = `${s.title} ${s.description ?? ''} ${programSlotRoomLabel(s)} ${displayTrack(s)}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [slots, search, filterTrack, filterTag])

  const dayKeys = useMemo(
    () => dayKeysInWindow(windowStartsAt, windowEndsAt, timezone),
    [windowStartsAt, windowEndsAt, timezone],
  )
  const rowsPerDay = useMemo(
    () => Math.max(1, Math.ceil(((GRID_END_HOUR_EXCL - GRID_START_HOUR) * 60) / SLOT_STEP)),
    [],
  )
  const rowLabels = useMemo(() => {
    const labels: string[] = []
    for (let r = 0; r < rowsPerDay; r++) {
      const mins = GRID_START_HOUR * 60 + r * SLOT_STEP
      const h = Math.floor(mins / 60)
      const m = mins % 60
      labels.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
    return labels
  }, [rowsPerDay])

  const [sel, setSel] = useState<null | { day: string; r0: number; r1: number }>(null)
  const [dragging, setDragging] = useState(false)
  const anchor = useRef<{ day: string; row: number } | null>(null)
  const [modal, setModal] = useState<null | { day: string; startRow: number; endRow: number }>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formLocationId, setFormLocationId] = useState('')
  const [formTrack, setFormTrack] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [dragActiveSlot, setDragActiveSlot] = useState<ProgramSlotRow | null>(null)
  const [draftModal, setDraftModal] = useState(false)

  useEffect(() => {
    const openCreate = () => {
      setFormTitle('')
      setFormLocationId('')
      setFormTrack('')
      setFormDesc('')
      setErr(null)
      setDraftModal(true)
    }
    window.addEventListener('dc-program-open-create', openCreate)
    return () => window.removeEventListener('dc-program-open-create', openCreate)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
  )

  const scheduledSlots = useMemo(
    () => filteredSlots.filter((s) => isProgramSlotScheduled(s)),
    [filteredSlots],
  )
  const unassignedSlots = useMemo(
    () => filteredSlots.filter((s) => !isProgramSlotScheduled(s)),
    [filteredSlots],
  )

  const layoutForSlot = useCallback(
    (slot: ProgramSlotRow) => {
      if (!slot.startsAt || !slot.endsAt) return null
      const startDay = formatInTimeZone(new Date(slot.startsAt), timezone, 'yyyy-MM-dd')
      const col = dayKeys.indexOf(startDay)
      if (col < 0) return null
      const r0 = clamp(rowIndexForInstant(slot.startsAt, startDay, timezone, GRID_START_HOUR, SLOT_STEP), 0, rowsPerDay - 1)
      const r1Raw = rowIndexForInstant(slot.endsAt, startDay, timezone, GRID_START_HOUR, SLOT_STEP)
      const r1 = clamp(Math.max(r0 + 1, r1Raw), r0 + 1, rowsPerDay)
      const top = r0 * rowH
      const bottom = r1 * rowH
      return { col, top, height: Math.max(rowH, bottom - top) }
    },
    [dayKeys, rowsPerDay, timezone, rowH],
  )

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const clearGridSelection = () => setSel(null)

  const selectedList = useMemo(() => filteredSlots.filter((s) => selectedIds.has(s.id)), [filteredSlots, selectedIds])

  const runBulk = async (bodyObj: Record<string, unknown>) => {
    if (readOnly) return
    const ids = (bodyObj.ids as string[]) ?? []
    if (!ids.length) {
      setErr(`Select at least one ${scheduleNouns.scheduledItem}.`)
      return
    }
    const op = String(bodyObj.op ?? '')
    if (!['publish', 'unpublish', 'delete', 'duplicate'].includes(op)) {
      setErr(`Bulk action "${op}" is not supported yet.`)
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await organizerDancecardFetch(eventSlug, '/program-slots/bulk', {
        method: 'POST',
        body: JSON.stringify({ action: op, slotIds: ids }),
      })
      setSelectedIds(new Set())
      await onRefresh()
      if (bodyObj.op === 'publish') {
        window.dispatchEvent(new CustomEvent('dc-publish-drumroll', { detail: { eventSlug } }))
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Bulk action failed')
    } finally {
      setBusy(false)
    }
  }

  const onPointerDownCell = (day: string, row: number) => {
    if (readOnly || dragActiveSlot) return
    anchor.current = { day, row }
    setDragging(true)
    setSel({ day, r0: row, r1: row })
  }

  const onPointerEnterCell = (day: string, row: number) => {
    if (!dragging || !anchor.current || anchor.current.day !== day) return
    const r0 = Math.min(anchor.current.row, row)
    const r1 = Math.max(anchor.current.row, row)
    setSel({ day, r0, r1 })
  }

  const endSelect = () => {
    setDragging(false)
    anchor.current = null
  }

  const openCreateModal = () => {
    if (!sel) return
    setFormTitle('')
    setFormLocationId('')
    setFormTrack('')
    setFormDesc('')
    setErr(null)
    setModal({ day: sel.day, startRow: sel.r0, endRow: sel.r1 })
    setSel(null)
  }

  const saveNewSlot = async () => {
    if (readOnly) return
    if (!modal) return
    const title = formTitle.trim()
    if (!title) {
      setErr('Title is required')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const start = instantFromRow(modal.day, modal.startRow, timezone, GRID_START_HOUR, SLOT_STEP)
      const end = instantFromRow(modal.day, modal.endRow + 1, timezone, GRID_START_HOUR, SLOT_STEP)
      await organizerDancecardFetch(eventSlug, '/program-slots', {
        method: 'POST',
        body: JSON.stringify({
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          title,
          locationId: formLocationId || null,
          track: formTrack.trim() || null,
          description: formDesc.trim() || null,
        }),
      })
      setModal(null)
      await onRefresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const patchSlotTimes = async (
    slotId: string,
    startsAt: string | null,
    endsAt: string | null,
  ) => {
    const res = await organizerDancecardFetch<{
      slot: ProgramSlotRow
      scheduleImpact?: ScheduleChangeImpactReport
    }>(eventSlug, `/program-slots/${slotId}`, {
      method: 'PATCH',
      body: JSON.stringify({ startsAt, endsAt }),
    })
    await onRefresh()
    if (res.scheduleImpact?.scheduleChanged) {
      setScheduleImpactPayload({ ...res.scheduleImpact, slotId })
    }
  }

  const scheduleSlotAtCell = async (slot: ProgramSlotRow, day: string, row: number) => {
    const durationMs =
      slot.startsAt && slot.endsAt
        ? Math.max(SLOT_STEP * 60 * 1000, new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime())
        : DEFAULT_SLOT_DURATION_MS
    const proposedStart = instantFromRow(day, row, timezone, GRID_START_HOUR, SLOT_STEP)
    const clamped = clampSlotIntervalToWindow(
      proposedStart.getTime(),
      durationMs,
      windowStartsAt,
      windowEndsAt,
    )
    if (!clamped) {
      setErr('That time does not fit inside the event window.')
      return
    }
    setErr(null)
    await patchSlotTimes(slot.id, new Date(clamped.startMs).toISOString(), new Date(clamped.endMs).toISOString())
  }

  const handleDragStart = (event: DragStartEvent) => {
    const slotId = parseProgramSlotDragId(String(event.active.id))
    if (!slotId) return
    const slot = slots.find((s) => s.id === slotId) ?? null
    setDragActiveSlot(slot)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setDragActiveSlot(null)
    if (readOnly) return
    const slotId = parseProgramSlotDragId(String(event.active.id))
    if (!slotId) return
    const slot = slots.find((s) => s.id === slotId)
    if (!slot) return

    const overId = event.over?.id ? String(event.over.id) : null
    if (overId === PROGRAM_UNASSIGNED_POOL_ID) {
      if (!isProgramSlotScheduled(slot)) return
      setErr(null)
      try {
        await patchSlotTimes(slotId, null, null)
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Could not unschedule')
      }
      return
    }

    const cell = overId ? parseProgramCellDropId(overId) : null
    if (cell) {
      try {
        await scheduleSlotAtCell(slot, cell.day, cell.row)
      } catch (e) {
        setErr(e instanceof Error ? e.message : `Could not schedule ${scheduleNouns.scheduledItem}`)
      }
      return
    }

    if (!isProgramSlotScheduled(slot) || !event.delta) return
    const rowDelta = Math.round(event.delta.y / rowH)
    const dayDelta = Math.round(event.delta.x / colMinW)
    if (rowDelta === 0 && dayDelta === 0) return
    const originalStartMs = new Date(slot.startsAt!).getTime()
    const originalEndMs = new Date(slot.endsAt!).getTime()
    const durationMs = Math.max(SLOT_STEP * 60 * 1000, originalEndMs - originalStartMs)
    const proposedStartMs = originalStartMs + rowDelta * SLOT_STEP * 60 * 1000 + dayDelta * 24 * 60 * 60 * 1000
    const clamped = clampSlotIntervalToWindow(proposedStartMs, durationMs, windowStartsAt, windowEndsAt)
    if (!clamped) {
      setErr('Move stays inside the event window; that drop would land outside it.')
      return
    }
    setErr(null)
    try {
      await patchSlotTimes(slotId, new Date(clamped.startMs).toISOString(), new Date(clamped.endMs).toISOString())
    } catch (e) {
      setErr(
        e instanceof Error
          ? `Could not move ${scheduleNouns.scheduledItem}: ${e.message}`
          : `Could not move ${scheduleNouns.scheduledItem}`,
      )
    }
  }

  const saveDraftSlot = async () => {
    if (readOnly) return
    const title = formTitle.trim()
    if (!title) {
      setErr('Title is required')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await organizerDancecardFetch(eventSlug, '/program-slots', {
        method: 'POST',
        body: JSON.stringify({
          title,
          locationId: formLocationId || null,
          track: formTrack.trim() || null,
          description: formDesc.trim() || null,
        }),
      })
      setDraftModal(false)
      setFormTitle('')
      setFormLocationId('')
      setFormTrack('')
      setFormDesc('')
      await onRefresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <OrganizerConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        destructive={confirmDestructive}
        confirmLabel={confirmDestructive ? 'Delete' : 'Confirm'}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          void confirmActionRef.current?.()
        }}
      />
      {err ? <p className="text-sm text-dc-danger">{err}</p> : null}

      <div className="flex flex-wrap items-end gap-1.5 rounded-xl border border-dc-border bg-dc-elevated-muted p-2.5">
        <label className="text-xs text-dc-muted">
          Search
          <input
            className="mt-1 block min-w-[140px] rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1 text-sm text-dc-text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title, room, track…"
          />
        </label>
        <label className="text-xs text-dc-muted">
          Track
          <select
            className="mt-1 block rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1 text-sm text-dc-text"
            value={filterTrack}
            onChange={(e) => setFilterTrack(e.target.value)}
          >
            <option value="">All</option>
            {trackOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-dc-muted">
          Tag
          <select
            className="mt-1 block rounded-lg border border-dc-border bg-dc-surface-muted px-2 py-1 text-sm text-dc-text"
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
          >
            <option value="">All</option>
            {tagNameOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-1">
          <button type="button" className="rounded-lg border border-dc-border px-2 py-1 text-dc-micro" onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}>−</button>
          <button type="button" className="rounded-lg border border-dc-border px-2 py-1 text-dc-micro" onClick={() => setZoom((z) => Math.min(2, z + 0.25))}>+</button>
          {onConflictsRefresh ? (
            <button type="button" className="rounded-lg border border-dc-border px-2 py-1 text-dc-micro" onClick={() => onConflictsRefresh()}>Scan</button>
          ) : null}
        </div>
      </div>

      {!readOnly && selectedList.length > 0 ? (
        <div className="fixed left-1/2 z-40 flex max-w-[96vw] -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl border border-dc-accent-border bg-dc-elevated px-4 py-2.5 text-sm shadow-xl c2k-toast-above-bottom-nav">
          <span className="font-medium text-dc-text">
            {selectedList.length} session{selectedList.length === 1 ? '' : 's'} selected
          </span>
          <button
            type="button"
            disabled={busy}
            className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
            onClick={() => void runBulk({ op: 'publish', ids: selectedList.map((s) => s.id) })}
          >
            Publish
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-full border border-amber-500/50 px-3 py-1 text-xs text-amber-200 hover:bg-amber-950/40 disabled:opacity-40"
            onClick={() => void runBulk({ op: 'unpublish', ids: selectedList.map((s) => s.id) })}
          >
            Unpublish
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-full border border-dc-border px-3 py-1 text-xs text-dc-text hover:bg-dc-elevated-muted disabled:opacity-40"
            onClick={() => void runBulk({ op: 'duplicate', ids: selectedList.map((s) => s.id) })}
          >
            Duplicate
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-full border border-red-400/50 px-3 py-1 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-40"
            onClick={() => {
              const ids = selectedList.map((s) => s.id)
              const snapshot = selectedList.map((s) => ({ ...s }))
              askConfirm(
                `Delete ${ids.length} ${ids.length === 1 ? scheduleNouns.scheduledItem : scheduleNouns.scheduledItemPlural}?`,
                'This cannot be undone from the grid. You may undo immediately after delete.',
                async () => {
                  await runBulk({ op: 'delete', ids })
                  toast.push(`Deleted ${ids.length} ${ids.length === 1 ? scheduleNouns.scheduledItem : scheduleNouns.scheduledItemPlural}.`, {
                    undoLabel: 'Undo',
                    onUndo: () => {
                      void (async () => {
                        try {
                          for (const s of snapshot) {
                            await organizerDancecardFetch(eventSlug, '/program-slots', {
                              method: 'POST',
                              body: JSON.stringify({
                                startsAt: s.startsAt,
                                endsAt: s.endsAt,
                                title: s.title,
                                track: s.track,
                                trackId: s.trackId,
                                room: s.room,
                                locationId: s.locationId,
                                description: s.description,
                                isPublished: s.isPublished,
                                visibility: s.visibility,
                                isFrozen: s.isFrozen,
                              }),
                            })
                          }
                          await onRefresh()
                        } catch (e) {
                          setErr(e instanceof Error ? e.message : 'Undo restore failed')
                        }
                      })()
                    },
                  })
                },
                true,
              )
            }}
          >
            Delete
          </button>
          <button type="button" className="ml-1 text-xs text-dc-muted underline" onClick={() => setSelectedIds(new Set())}>
            Clear selection
          </button>
        </div>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={programScheduleCollision}
        onDragStart={handleDragStart}
        onDragEnd={(e) => void handleDragEnd(e)}
      >
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start">
          <ProgramUnassignedPool
            readOnly={readOnly}
            slots={unassignedSlots}
            scheduledItemLabel={scheduleNouns.scheduledItem}
            scheduledItemPlural={scheduleNouns.scheduledItemPlural}
            addItemCta={scheduleNouns.addItemCta}
            onOpenDrawer={setDrawerSlot}
            onCreateDraft={() => {
              setFormTitle('')
              setFormLocationId('')
              setFormTrack('')
              setFormDesc('')
              setErr(null)
              setDraftModal(true)
            }}
            onOpenImport={onOpenImport}
            busy={busy}
          />
          <div
            data-dc-program-grid
            className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-dc-border bg-dc-surface-muted/40 p-2"
          >
          <div
            className={cn('gap-0', wideCanvas ? 'flex w-full min-w-full' : 'inline-flex min-w-full')}
            onPointerLeave={() => {
              if (dragging) endSelect()
            }}
            onPointerUp={() => {
              if (dragging) endSelect()
            }}
          >
            <div
              className="shrink-0 border-r border-dc-border pr-1 text-right text-[10px] text-dc-muted"
              style={{ width: 52, paddingTop: 22 }}
            >
              {rowLabels.map((lb, i) => (
                <div key={lb + i} style={{ height: rowH }} className="pr-1 leading-none">
                  {lb}
                </div>
              ))}
            </div>
            {dayKeys.map((day) => (
              <div
                key={day}
                className={cn('relative border-r border-dc-border', wideCanvas ? 'min-w-0 flex-1' : 'shrink-0')}
                style={
                  wideCanvas
                    ? { minWidth: colMinW, flex: '1 1 0%', minHeight: rowsPerDay * rowH + 22 }
                    : { width: colMinW, minHeight: rowsPerDay * rowH + 22 }
                }
              >
                <div className="sticky top-0 z-10 border-b border-dc-border bg-dc-elevated/95 px-1 py-2 text-center text-xs font-bold uppercase tracking-wide text-dc-text">
                  {formatDayHeader(day, timezone)}
                </div>
                <div className="relative" style={{ height: rowsPerDay * rowH }}>
                  {Array.from({ length: rowsPerDay }).map((_, row) => (
                    <ProgramGridDroppableCell
                      key={row}
                      id={programCellDropId(day, row)}
                      className={cn(
                        'absolute left-0 right-0 border-b border-dc-border-subtle/60',
                        row % 2 === 0 ? 'bg-dc-surface/30' : 'bg-dc-surface-muted/20',
                        'hover:bg-dc-accent-muted/25',
                      )}
                      style={{ top: row * rowH, height: rowH }}
                      onPointerDown={() => onPointerDownCell(day, row)}
                      onPointerEnter={() => onPointerEnterCell(day, row)}
                    />
                  ))}
                  {sel && sel.day === day
                    ? (() => {
                        const top = Math.min(sel.r0, sel.r1) * rowH
                        const h = (Math.abs(sel.r1 - sel.r0) + 1) * rowH
                        return (
                          <div
                            className="pointer-events-none absolute left-1 right-1 rounded-md border border-dc-accent-border bg-dc-accent-muted"
                            style={{ top, height: h, zIndex: 1 }}
                          />
                        )
                      })()
                    : null}
                  {scheduledSlots.map((slot) => {
                    const L = layoutForSlot(slot)
                    if (!L || L.col !== dayKeys.indexOf(day)) return null
                    return (
                      <DraggableProgramSlot
                        key={slot.id}
                        slot={slot}
                        top={L.top}
                        height={L.height}
                        rowH={rowH}
                        tz={timezone}
                        colWidth={colMinW}
                        readOnly={readOnly}
                        selected={selectedIds.has(slot.id)}
                        onToggleSelect={toggleSelect}
                        onOpenDrawer={setDrawerSlot}
                        hasConflict={conflictSet.has(slot.id)}
                        sonarPulse={conflictSonarActive}
                        scheduledItemLabel={scheduleNouns.scheduledItem}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {dragActiveSlot ? <ProgramSlotDragOverlay slot={dragActiveSlot} tz={timezone} /> : null}
        </DragOverlay>
      </DndContext>

      {sel && !readOnly ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full bg-dc-accent-muted px-4 py-2 text-sm font-medium text-dc-accent-foreground ring-1 ring-dc-accent-border hover:bg-dc-accent/30"
            onClick={() => openCreateModal()}
          >
            {scheduleNouns.addItemCta} in selection
          </button>
          <button
            type="button"
            className="rounded-full border border-dc-border px-4 py-2 text-sm text-dc-muted hover:bg-white/5"
            onClick={() => clearGridSelection()}
          >
            Clear selection
          </button>
        </div>
      ) : null}

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dc-surface/85 p-4">
          <div className="w-full max-w-md rounded-2xl border border-dc-border bg-dc-elevated-solid p-5 shadow-2xl">
            <h3 className="font-serif text-xl text-dc-text">New {scheduleNouns.scheduledItem}</h3>
            <p className="mt-1 text-xs text-dc-muted">
              {formatDayHeader(modal.day, timezone)} ·{' '}
              {formatTimeLabel(
                instantFromRow(modal.day, modal.startRow, timezone, GRID_START_HOUR, SLOT_STEP).toISOString(),
                timezone,
              )}{' '}
              –{' '}
              {formatTimeLabel(
                instantFromRow(modal.day, modal.endRow + 1, timezone, GRID_START_HOUR, SLOT_STEP).toISOString(),
                timezone,
              )}
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs uppercase tracking-wide text-dc-muted">
                Title
                <input
                  className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </label>
              <RoomLocationField
                value={formLocationId}
                onChange={setFormLocationId}
                locations={locations}
                locationsLoadErr={locationsLoadErr}
                venuesHref={venuesHref}
              />
              <label className="block text-xs uppercase tracking-wide text-dc-muted">
                Track
                <input
                  className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                  value={formTrack}
                  onChange={(e) => setFormTrack(e.target.value)}
                />
              </label>
              <label className="block text-xs uppercase tracking-wide text-dc-muted">
                Description
                <textarea
                  className="mt-1 min-h-[72px] w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                />
              </label>
            </div>
            {err ? <p className="mt-3 text-sm text-dc-danger">{err}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-dc-border px-4 py-2 text-sm text-dc-muted"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-full bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
                onClick={() => void saveNewSlot()}
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {draftModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dc-surface/85 p-4">
          <div className="w-full max-w-md rounded-2xl border border-dc-border bg-dc-elevated p-5 shadow-2xl">
            <h3 className="font-serif text-xl text-dc-text">Add to library</h3>
            <p className="mt-1 text-xs text-dc-muted">
              Creates an unscheduled {scheduleNouns.scheduledItem}. Drag it onto the grid when you know the time.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs uppercase tracking-wide text-dc-muted">
                Title
                <input
                  className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </label>
              <RoomLocationField
                value={formLocationId}
                onChange={setFormLocationId}
                locations={locations}
                locationsLoadErr={locationsLoadErr}
                venuesHref={venuesHref}
              />
              <label className="block text-xs uppercase tracking-wide text-dc-muted">
                Track
                <input
                  className="mt-1 w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text"
                  value={formTrack}
                  onChange={(e) => setFormTrack(e.target.value)}
                />
              </label>
            </div>
            {err ? <p className="mt-3 text-sm text-dc-danger">{err}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-dc-border px-4 py-2 text-sm text-dc-muted"
                onClick={() => setDraftModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-full bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
                onClick={() => void saveDraftSlot()}
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {scheduleImpactPayload ? (
        <ScheduleChangeImpactModal
          eventSlug={eventSlug}
          payload={scheduleImpactPayload}
          onClose={() => setScheduleImpactPayload(null)}
        />
      ) : null}

      {drawerSlot ? (
        <SessionDetailDrawer
          eventSlug={eventSlug}
          timezone={timezone}
          slot={drawerSlot}
          readOnly={readOnly}
          initialTab={activeDrawerTab ?? 'overview'}
          onClose={() => {
            setDrawerSlot(null)
            setActiveDrawerTab(undefined)
            onDrawerTabConsumed?.()
            onSlotLinkChange?.(null)
          }}
          onSaved={onRefresh}
          onScheduleImpact={(impact) => setScheduleImpactPayload({ ...impact, slotId: drawerSlot.id })}
          onCopySessionLink={
            onSlotLinkChange
              ? () => {
                  onSlotLinkChange(drawerSlot.id)
                  const url = `${window.location.origin}${organizerTabHref(workspaceBase, 'program', { slot: drawerSlot.id })}`
                  void navigator.clipboard.writeText(url)
                  toast.push(`${capitalizeWords(scheduleNouns.scheduledItem)} link copied.`)
                }
              : undefined
          }
        />
      ) : null}
    </div>
  )
}
