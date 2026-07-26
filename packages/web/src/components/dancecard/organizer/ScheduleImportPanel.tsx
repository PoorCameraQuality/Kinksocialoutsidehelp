'use client'

import Link from 'next/link'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { invalidateOrganizerDancecardCache, organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { useConfirmDialog } from '@/components/dancecard/organizer/ui'
import { Panel } from '@/components/dancecard/ui/Panel'
import { importDiffHeadline, summarizeImportRows } from '@/lib/dancecard/importDiffSummary'
import { IMPORT_SKIP_STORAGE_KEY } from '@/lib/dancecard/setupTasks'
import { supportCopy } from '@/lib/dancecard/supportCopy'
import {
  activeDragFromDndId,
  cellDropId,
  parseBoardSlotDropId,
  parseCellDropId,
  parseLibRowDropId,
} from '@/components/dancecard/organizer/scheduleImportDndIds'
import { GoogleSheetsImportSection } from '@/components/dancecard/organizer/GoogleSheetsImportSection'
import {
  ImportColumnMappingPanel,
  parsedRowsToApiPayload,
} from '@/components/dancecard/organizer/ImportColumnMappingPanel'
import type { ConventionCommandPermissions } from '@c2k/shared'
import {
  buildTemplateCsv,
  detectImportFormat,
  normalizeJsonImportRows,
  parseSpreadsheetImport,
  type ImportKind,
  type SpreadsheetParseResult,
} from '@c2k/shared'
import { normalizeImportBatch, normalizeImportRow } from '@/lib/dancecard/importDto'
import { readSpreadsheetFile } from '@/lib/dancecard/spreadsheetParse'
import {
  ImportBoardSlotDropTarget,
  ImportDraggableBoardSlot,
  ImportDraggableDutyChip,
  ImportDraggableLocationChip,
  ImportDraggableStaffChip,
  ImportDroppableCell,
  ImportSortableLibraryCard,
} from '@/components/dancecard/organizer/scheduleImportDndParts'

type BatchKind = ImportKind | 'event'

export type OrganizerLocation = {
  id: string
  name: string
  shortName: string | null
  capacity: number | null
  notes: string | null
  sortOrder: number
}

type ImportBatch = {
  id: string
  kind: BatchKind
  status: string
  source_filename: string | null
  sheet_name: string | null
  summary: { total?: number; valid?: number; invalid?: number; locations?: string[]; staffNames?: string[] }
}

type ImportRow = {
  id: string
  row_key: string
  kind: ImportKind
  action: string
  draft_status: 'unplaced' | 'placed' | 'invalid' | 'ignored'
  title: string | null
  person_name: string | null
  role: string | null
  track: string | null
  room: string | null
  location_id: string | null
  starts_at: string | null
  ends_at: string | null
  duration_minutes: number | null
  description: string | null
  validation_errors: string[]
  sort_order: number
}

type DutyTemplate = {
  id: string
  name: string
  durationMinutes: number
}

type StaffMetric = {
  name: string
  shiftCount: number
  minutes: number
  conflictCount: number
}

type ActiveDrag =
  | { type: 'row'; rowId: string }
  | { type: 'staff'; staffName: string }
  | { type: 'location'; locationName: string }
  | { type: 'duty'; dutyId: string }

const DEFAULT_DUTY_TEMPLATES: DutyTemplate[] = [
  { id: 'duty-hq', name: 'HQ', durationMinutes: 120 },
  { id: 'duty-dungeon', name: 'Dungeon Monitor', durationMinutes: 120 },
  { id: 'duty-door', name: 'Door / Check-in', durationMinutes: 90 },
  { id: 'duty-parking', name: 'Parking', durationMinutes: 120 },
  { id: 'duty-registration', name: 'Registration', durationMinutes: 120 },
  { id: 'duty-covid', name: 'COVID Proctor', durationMinutes: 120 },
]

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

function importActionBorderClass(action: string): string {
  switch (action) {
    case 'add':
      return 'border-emerald-400/50'
    case 'update':
      return 'border-amber-400/50'
    case 'delete':
      return 'border-rose-400/50'
    case 'unchanged':
      return 'border-dc-border opacity-75'
    default:
      return 'border-dc-border'
  }
}

function localInputValue(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function addMinutes(iso: string, minutes: number) {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString()
}

function formatScheduleLabel(row: ImportRow) {
  const day = row.starts_at ? localInputValue(row.starts_at).slice(5, 10) : 'Unscheduled'
  const start = row.starts_at ? localInputValue(row.starts_at).slice(11) : ''
  const end = row.ends_at ? localInputValue(row.ends_at).slice(11) : ''
  return `${day}${start ? ` ${start}` : ''}${end ? `-${end}` : ''}`
}

function dayOptions(windowStartsAt: string, windowEndsAt: string) {
  const out: string[] = []
  const cursor = new Date(windowStartsAt)
  cursor.setHours(0, 0, 0, 0)
  const end = new Date(windowEndsAt)
  end.setHours(0, 0, 0, 0)
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

function makeLocalBatch(kind: BatchKind, total: number): ImportBatch {
  return {
    id: `local-${Date.now()}`,
    kind,
    status: 'draft-local',
    source_filename: 'local-prototype.json',
    sheet_name: 'Prototype',
    summary: { total, valid: total, invalid: 0 },
  }
}

function makeStaffRosterRow(personName: string, index: number): ImportRow {
  return {
    id: `local-staff-${Date.now()}-${index}`,
    row_key: `local-staff-${index}`,
    kind: 'staff',
    action: 'add',
    draft_status: 'unplaced',
    title: null,
    person_name: personName,
    role: null,
    track: null,
    room: null,
    location_id: null,
    starts_at: null,
    ends_at: null,
    duration_minutes: 120,
    description: 'Roster person. Drag this person onto a duty shift to assign them.',
    validation_errors: [],
    sort_order: index,
  }
}

function makeLocalDemoRows(kind: ImportKind, _windowStartsAt: string): ImportRow[] {
  if (kind === 'staff') {
    return ['Mira Chen', 'Rowan Vale', 'ZsaZsa', 'Ninja', 'Indy', 'RopeKitten', 'Kitxi-Kat', 'Parker'].map(
      (personName, index) => makeStaffRosterRow(personName, index)
    )
  }

  return [
    {
      id: 'local-program-1',
      row_key: 'local-program-1',
      kind: 'program',
      action: 'add',
      draft_status: 'unplaced',
      title: 'Rope Lab: patterning',
      person_name: null,
      role: null,
      track: 'Rope',
      room: null,
      location_id: null,
      starts_at: null,
      ends_at: null,
      duration_minutes: 90,
      description: 'PAF program exists, but no day, room, or time has been assigned yet.',
      validation_errors: [],
      sort_order: 0,
    },
    {
      id: 'local-program-2',
      row_key: 'local-program-2',
      kind: 'program',
      action: 'add',
      draft_status: 'unplaced',
      title: 'Negotiation clinic',
      person_name: null,
      role: null,
      track: 'Consent',
      room: null,
      location_id: null,
      starts_at: null,
      ends_at: null,
      duration_minutes: 60,
      description: 'Imported from the program list; organizer chooses placement later.',
      validation_errors: [],
      sort_order: 1,
    },
    {
      id: 'local-program-3',
      row_key: 'local-program-3',
      kind: 'program',
      action: 'add',
      draft_status: 'unplaced',
      title: 'Impact calibration',
      person_name: null,
      role: null,
      track: 'Impact',
      room: null,
      location_id: null,
      starts_at: null,
      ends_at: null,
      duration_minutes: 75,
      description: 'Known program card, not yet assigned to a schedule slot.',
      validation_errors: [],
      sort_order: 2,
    },
    {
      id: 'local-program-4',
      row_key: 'local-program-4',
      kind: 'program',
      action: 'add',
      draft_status: 'unplaced',
      title: 'Aftercare roundtable',
      person_name: null,
      role: null,
      track: 'Discussion',
      room: null,
      location_id: null,
      starts_at: null,
      ends_at: null,
      duration_minutes: 60,
      description: 'Program library item waiting for day/time/location.',
      validation_errors: [],
      sort_order: 3,
    },
  ]
}

function makeBlankEventRows(): ImportRow[] {
  return [
    {
      id: 'blank-class-1',
      row_key: 'blank-class-1',
      kind: 'program',
      action: 'add',
      draft_status: 'unplaced',
      title: 'Rope fundamentals',
      person_name: null,
      role: null,
      track: 'Rope',
      room: null,
      location_id: null,
      starts_at: null,
      ends_at: null,
      duration_minutes: 90,
      description: 'Mock class card for first-run testing.',
      validation_errors: [],
      sort_order: 0,
    },
    {
      id: 'blank-class-2',
      row_key: 'blank-class-2',
      kind: 'program',
      action: 'add',
      draft_status: 'unplaced',
      title: 'Consent lab',
      person_name: null,
      role: null,
      track: 'Consent',
      room: null,
      location_id: null,
      starts_at: null,
      ends_at: null,
      duration_minutes: 60,
      description: 'Mock class card for first-run testing.',
      validation_errors: [],
      sort_order: 1,
    },
    {
      id: 'blank-class-3',
      row_key: 'blank-class-3',
      kind: 'program',
      action: 'add',
      draft_status: 'unplaced',
      title: 'Aftercare roundtable',
      person_name: null,
      role: null,
      track: 'Discussion',
      room: null,
      location_id: null,
      starts_at: null,
      ends_at: null,
      duration_minutes: 60,
      description: 'Mock class card for first-run testing.',
      validation_errors: [],
      sort_order: 2,
    },
  ]
}

function applyLocalPatch(row: ImportRow, patch: Record<string, unknown>): ImportRow {
  return {
    ...row,
    action: typeof patch.action === 'string' ? patch.action : row.action,
    draft_status:
      patch.draftStatus === 'placed' || patch.draftStatus === 'unplaced' || patch.draftStatus === 'invalid' || patch.draftStatus === 'ignored'
        ? patch.draftStatus
        : row.draft_status,
    title: typeof patch.title === 'string' ? patch.title : row.title,
    person_name: typeof patch.personName === 'string' ? patch.personName : patch.personName === null ? null : row.person_name,
    role: typeof patch.role === 'string' ? patch.role : row.role,
    track: typeof patch.track === 'string' ? patch.track : row.track,
    room: typeof patch.room === 'string' ? patch.room : row.room,
    starts_at: typeof patch.startsAt === 'string' ? patch.startsAt : patch.startsAt === null ? null : row.starts_at,
    ends_at: typeof patch.endsAt === 'string' ? patch.endsAt : patch.endsAt === null ? null : row.ends_at,
    duration_minutes:
      typeof patch.durationMinutes === 'number' && Number.isFinite(patch.durationMinutes)
        ? patch.durationMinutes
        : row.duration_minutes,
    description: typeof patch.description === 'string' ? patch.description : row.description,
    sort_order:
      typeof patch.sortOrder === 'number' && Number.isFinite(patch.sortOrder) ? patch.sortOrder : row.sort_order,
  }
}

function makeDroppedStaffRow(staffName: string, index: number, room: string, startsAt: string, role = 'Shift'): ImportRow {
  const duration = 120
  return {
    id: `local-staff-drop-${Date.now()}-${index}`,
    row_key: `local-staff-drop-${index}`,
    kind: 'staff',
    action: 'add',
    draft_status: 'placed',
    title: null,
    person_name: staffName,
    role,
    track: null,
    room,
    location_id: null,
    starts_at: startsAt,
    ends_at: addMinutes(startsAt, duration),
    duration_minutes: duration,
    description: null,
    validation_errors: [],
    sort_order: index,
  }
}

function makeDroppedDutyRow(duty: DutyTemplate, index: number, room: string, startsAt: string): ImportRow {
  return {
    id: `local-duty-drop-${Date.now()}-${index}`,
    row_key: `local-duty-drop-${index}`,
    kind: 'staff',
    action: 'add',
    draft_status: 'placed',
    title: null,
    person_name: null,
    role: duty.name,
    track: null,
    room,
    location_id: null,
    starts_at: startsAt,
    ends_at: addMinutes(startsAt, duty.durationMinutes),
    duration_minutes: duty.durationMinutes,
    description: 'Duty shift created from organizer template.',
    validation_errors: [],
    sort_order: index,
  }
}

function rowMinutes(row: ImportRow) {
  if (!row.starts_at || !row.ends_at) return 0
  const minutes = Math.round((Date.parse(row.ends_at) - Date.parse(row.starts_at)) / 60_000)
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0
}

function rowsOverlap(a: ImportRow, b: ImportRow) {
  if (!a.starts_at || !a.ends_at || !b.starts_at || !b.ends_at) return false
  return Date.parse(a.starts_at) < Date.parse(b.ends_at) && Date.parse(b.starts_at) < Date.parse(a.ends_at)
}

export function ScheduleImportPanel({
  eventSlug,
  timezone,
  windowStartsAt,
  windowEndsAt,
  readOnly = false,
  permissions,
}: {
  eventSlug: string
  timezone: string
  windowStartsAt: string
  windowEndsAt: string
  readOnly?: boolean
  permissions: ConventionCommandPermissions
}) {
  const canConfigureGoogle = permissions.isFullAdmin
  const [file, setFile] = useState<File | null>(null)
  const [jsonText, setJsonText] = useState('')
  const [pendingRawRows, setPendingRawRows] = useState<string[][] | null>(null)
  const [pendingSheetName, setPendingSheetName] = useState<string | null>(null)
  const [pendingSpreadsheetId, setPendingSpreadsheetId] = useState<string | null>(null)
  const [pendingSourceFilename, setPendingSourceFilename] = useState<string | null>(null)
  const [pendingParse, setPendingParse] = useState<SpreadsheetParseResult | null>(null)
  const [batch, setBatch] = useState<ImportBatch | null>(null)
  const kind: ImportKind = batch?.kind === 'staff' ? 'staff' : 'program'
  const [rows, setRows] = useState<ImportRow[]>([])
  const [locations, setLocations] = useState<OrganizerLocation[]>([])
  const [locationsNeedsMigration, setLocationsNeedsMigration] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null)
  const [dutyTemplates, setDutyTemplates] = useState<DutyTemplate[]>(DEFAULT_DUTY_TEMPLATES)
  const [newDutyName, setNewDutyName] = useState('')
  const [newDutyDuration, setNewDutyDuration] = useState('120')
  const [newStaffName, setNewStaffName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [draftBatches, setDraftBatches] = useState<ImportBatch[]>([])
  const { ask, dialog } = useConfirmDialog()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await organizerDancecardFetch<{ batches: unknown[] }>(eventSlug, '/imports')
        if (cancelled) return
        const open = (res.batches ?? [])
          .map((b) => normalizeImportBatch(b as Parameters<typeof normalizeImportBatch>[0]))
          .filter((b) => b.status !== 'published')
        setDraftBatches(open)
      } catch {
        if (!cancelled) setDraftBatches([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [eventSlug, batch?.id, batch?.status])

  const selected = rows.find((row) => row.id === selectedId) ?? null
  const importActionCounts = useMemo(() => {
    const counts = { add: 0, update: 0, delete: 0, unchanged: 0 }
    for (const row of rows) {
      if (row.action === 'add') counts.add += 1
      else if (row.action === 'update') counts.update += 1
      else if (row.action === 'delete') counts.delete += 1
      else if (row.action === 'unchanged') counts.unchanged += 1
    }
    return counts
  }, [rows])
  const diffSummary = useMemo(() => summarizeImportRows(rows), [rows])
  const days = useMemo(() => dayOptions(windowStartsAt, windowEndsAt), [windowStartsAt, windowEndsAt])
  const hours = useMemo(() => Array.from({ length: 17 }, (_, index) => 8 + index), [])
  const laneNames = useMemo(() => {
    const names = new Set<string>(locations.map((location) => location.name))
    rows.forEach((row) => {
      if (row.room) names.add(row.room)
    })
    return Array.from(names).sort()
  }, [locations, rows])
  const staffNames = useMemo(
    () => Array.from(new Set(rows.filter((row) => row.person_name).map((row) => row.person_name as string))).sort(),
    [rows]
  )
  const unscheduledProgramCount = rows.filter((row) => row.kind === 'program' && !row.starts_at).length
  const scheduledCount = rows.filter((row) => row.kind === 'program' && row.starts_at && row.room).length
  const libraryRows = useMemo(
    () =>
      rows.filter((row) =>
        batch?.kind === 'staff'
          ? row.kind === 'staff' && !row.starts_at && !row.person_name
          : row.kind === 'program' && !row.starts_at
      ),
    [rows, batch?.kind]
  )
  const libraryRowIds = useMemo(() => libraryRows.map((r) => r.id), [libraryRows])
  const assignedStaffRows = useMemo(
    () => rows.filter((row) => row.kind === 'staff' && row.person_name && row.starts_at && row.ends_at),
    [rows]
  )
  const staffMetrics = useMemo(() => {
    const metrics = new Map<string, StaffMetric>()
    for (const name of staffNames) {
      metrics.set(name, { name, shiftCount: 0, minutes: 0, conflictCount: 0 })
    }
    for (const row of assignedStaffRows) {
      if (!row.person_name) continue
      const metric = metrics.get(row.person_name) ?? { name: row.person_name, shiftCount: 0, minutes: 0, conflictCount: 0 }
      metric.shiftCount += 1
      metric.minutes += rowMinutes(row)
      metrics.set(row.person_name, metric)
    }
    for (const metric of Array.from(metrics.values())) {
      const personRows = assignedStaffRows.filter((row) => row.person_name === metric.name)
      let conflicts = 0
      for (let i = 0; i < personRows.length; i++) {
        for (let j = i + 1; j < personRows.length; j++) {
          if (rowsOverlap(personRows[i], personRows[j])) conflicts += 1
        }
      }
      metric.conflictCount = conflicts
    }
    return metrics
  }, [assignedStaffRows, staffNames])
  const unassignedDutyCount = rows.filter((row) => row.kind === 'staff' && row.starts_at && !row.person_name).length
  const conflictShiftIds = useMemo(() => {
    const ids = new Set<string>()
    for (const row of assignedStaffRows) {
      const conflicts = assignedStaffRows.some(
        (candidate) => candidate.id !== row.id && candidate.person_name === row.person_name && rowsOverlap(row, candidate)
      )
      if (conflicts) ids.add(row.id)
    }
    return ids
  }, [assignedStaffRows])
  const selectedConflictRows = useMemo(() => {
    if (!selected?.person_name || !selected.starts_at || !selected.ends_at) return []
    return assignedStaffRows.filter(
      (row) => row.id !== selected.id && row.person_name === selected.person_name && rowsOverlap(row, selected)
    )
  }, [assignedStaffRows, selected])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const handleDndDragStart = useCallback((event: DragStartEvent) => {
    setActiveDrag(activeDragFromDndId(String(event.active.id)))
  }, [])

  const handleDndDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (readOnly) {
        setActiveDrag(null)
        return
      }
      const aid = String(active.id)
      const oid = over ? String(over.id) : ''
      const ad = activeDragFromDndId(aid)
      if (!ad) {
        setActiveDrag(null)
        return
      }
      const cell = parseCellDropId(oid)
      if (cell) {
        void dropOnBoard(ad, cell.day, cell.hour, cell.room)
        return
      }
      const libTarget = parseLibRowDropId(oid)
      if (libTarget && ad.type === 'staff') {
        const targetRow = rows.find((r) => r.id === libTarget)
        if (targetRow?.kind === 'staff') assignStaffToShift(libTarget, ad.staffName)
        setActiveDrag(null)
        return
      }
      if (libTarget && ad.type === 'location') {
        assignLocationToCard(libTarget, ad.locationName)
        setActiveDrag(null)
        return
      }
      const boardSlot = parseBoardSlotDropId(oid)
      if (boardSlot && ad.type === 'staff') {
        const targetRow = rows.find((r) => r.id === boardSlot)
        if (targetRow?.kind === 'staff') assignStaffToShift(boardSlot, ad.staffName)
        setActiveDrag(null)
        return
      }
      if (boardSlot && ad.type === 'location') {
        assignLocationToCard(boardSlot, ad.locationName)
        setActiveDrag(null)
        return
      }
      if (over && libraryRowIds.includes(aid) && libraryRowIds.includes(oid) && aid !== oid) {
        const oldIndex = libraryRowIds.indexOf(aid)
        const newIndex = libraryRowIds.indexOf(oid)
        const nextOrder = arrayMove(libraryRowIds, oldIndex, newIndex)
        const orderMap = new Map(nextOrder.map((id, sortIdx) => [id, sortIdx]))
        setRows((prev) =>
          prev.map((row) => (orderMap.has(row.id) ? { ...row, sort_order: orderMap.get(row.id)! } : row)),
        )
        for (const id of nextOrder) {
          const sortOrder = orderMap.get(id)
          if (sortOrder !== undefined) void patchRow(id, { sortOrder })
        }
      }
      setActiveDrag(null)
    },
    [readOnly, rows, libraryRowIds], // eslint-disable-line react-hooks/exhaustive-deps -- DnD uses latest patch/drop helpers without re-subscribing sensors each render
  )

  async function loadLocations() {
    const res = await organizerDancecardFetch<{ locations: OrganizerLocation[]; needsMigration?: boolean }>(eventSlug, '/locations')
    setLocations(res.locations ?? [])
    setLocationsNeedsMigration(Boolean(res.needsMigration))
  }

  function loadDemoDraft() {
    if (readOnly) return
    const demoRows = makeLocalDemoRows(kind, windowStartsAt)
    setBatch(makeLocalBatch(kind, demoRows.length))
    setRows(demoRows)
    setSelectedId(demoRows[0]?.id ?? null)
    setDutyTemplates(DEFAULT_DUTY_TEMPLATES)
    setLocations([
      { id: 'local-main', name: 'Main Hall', shortName: 'Main', capacity: null, notes: null, sortOrder: 0 },
      { id: 'local-burrow', name: 'Burrow', shortName: 'Burrow', capacity: null, notes: null, sortOrder: 1 },
      { id: 'local-studio', name: 'Studio', shortName: 'Studio', capacity: null, notes: null, sortOrder: 2 },
    ])
    setErr(null)
    setMessage(
      kind === 'program'
        ? 'Loaded unscheduled PAF-style programs. Drag a program card onto the board to assign day, time, and location.'
        : 'Loaded a local staff draft board. Drag staff chips or cards into a room/time slot.'
    )
  }

  function loadBlankEventDraft() {
    if (readOnly) return
    const demoRows = makeBlankEventRows()
    setBatch(makeLocalBatch('event', demoRows.length))
    setRows(demoRows)
    setSelectedId(demoRows[0]?.id ?? null)
    setLocations([])
    setDutyTemplates([])
    setNewStaffName('')
    setErr(null)
    setMessage('Started a blank event setup. Add locations and staff, create duties, then drag the mock classes onto the board.')
  }

  async function loadImportResponse(response: { batch: unknown; rows: unknown[] }) {
    setBatch(normalizeImportBatch(response.batch as Parameters<typeof normalizeImportBatch>[0]))
    setRows(response.rows.map((r) => normalizeImportRow(r as Parameters<typeof normalizeImportRow>[0])))
    await loadLocations()
    clearPendingSource()
  }

  async function resumeDraftBatch(batchId: string) {
    if (readOnly) return
    setBusy(true)
    setErr(null)
    try {
      const res = await organizerDancecardFetch<{ batch: unknown; rows: unknown[] }>(
        eventSlug,
        `/imports/${batchId}`,
      )
      await loadImportResponse(res)
      setMessage('Draft import resumed.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not resume draft')
    } finally {
      setBusy(false)
    }
  }

  function clearPendingSource() {
    setPendingRawRows(null)
    setPendingSheetName(null)
    setPendingSpreadsheetId(null)
    setPendingSourceFilename(null)
    setPendingParse(null)
  }

  function beginPendingParse(rawRows: string[][], opts: { sheetName?: string | null; sourceFilename?: string; spreadsheetId?: string | null }) {
    const detectedFormat = detectImportFormat(rawRows)
    const parsed = parseSpreadsheetImport(rawRows, {
      kind,
      importFormat: detectedFormat === 'unknown' ? 'flat_rows' : detectedFormat,
      timezone,
      windowStartsAt,
      windowEndsAt,
      sourceId: opts.sheetName ? `sheet:${opts.sheetName}` : opts.spreadsheetId ? `sheet:${opts.spreadsheetId}` : 'upload',
      sheetName: opts.sheetName ?? undefined,
    })
    setPendingRawRows(rawRows)
    setPendingSheetName(opts.sheetName ?? null)
    setPendingSpreadsheetId(opts.spreadsheetId ?? null)
    setPendingSourceFilename(opts.sourceFilename ?? null)
    setPendingParse(parsed)
    return parsed
  }

  async function parseSelectedFile(selected: File) {
    setBusy(true)
    setErr(null)
    setMessage(null)
    clearPendingSource()
    setBatch(null)
    setRows([])
    try {
      const { rawRows, sheetName } = await readSpreadsheetFile(selected)
      const parsed = beginPendingParse(rawRows, {
        sheetName,
        sourceFilename: selected.name,
      })
      setMessage(
        `Parsed ${parsed.rows.length} rows from ${sheetName}. Map columns below, then create your draft.`,
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not read spreadsheet')
    } finally {
      setBusy(false)
    }
  }

  async function createDraftFromMapping() {
    if (readOnly || !pendingParse) return
    setBusy(true)
    setErr(null)
    setMessage(null)
    try {
      const payload = parsedRowsToApiPayload(pendingParse, kind)
      const response = await organizerDancecardFetch(eventSlug, '/imports', {
        method: 'POST',
        body: JSON.stringify({
          kind,
          rows: payload,
          filename:
            pendingSourceFilename ??
            file?.name ??
            `${kind}-${pendingSheetName ?? 'sheet'}.csv`,
          columnMapping: pendingParse.columnMapping,
          headerRowIndex: pendingParse.headerRowIndex,
          importFormat: pendingParse.importFormat,
          sheetName: pendingSheetName,
          spreadsheetId: pendingSpreadsheetId ?? undefined,
        }),
      })
      await loadImportResponse(response as { batch: unknown; rows: unknown[] })
      clearPendingSource()
      setFile(null)
      setJsonText('')
      setMessage(`Draft created with ${payload.length} rows. Review on the board, then publish.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create draft')
    } finally {
      setBusy(false)
    }
  }

  async function uploadImport() {
    if (readOnly) return
    if (pendingParse) {
      await createDraftFromMapping()
      return
    }
    setBusy(true)
    setErr(null)
    setMessage(null)
    try {
      if (file) {
        await parseSelectedFile(file)
        return
      }
      const raw = jsonText.trim() ? JSON.parse(jsonText) : []
      const rows = normalizeJsonImportRows(Array.isArray(raw) ? raw : [])
      const response = await organizerDancecardFetch(eventSlug, '/imports', {
        method: 'POST',
        body: JSON.stringify({ kind, rows, filename: `${kind}-manual.json` }),
      })
      await loadImportResponse(response as { batch: unknown; rows: unknown[] })
      setMessage(`Imported ${rows.length} draft rows.`)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Import failed'
      if (message.includes('requires dancecard_007') || message.includes('409')) {
        setErr(
          `${supportCopy.importNotReady} You can still use “Load … demo” below to explore the board while setup finishes.`,
        )
      } else {
        setErr(message)
      }
    } finally {
      setBusy(false)
    }
  }

  function downloadTemplate() {
    const csv = buildTemplateCsv(kind)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${kind}-import-template.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function patchRow(rowId: string, patch: Record<string, unknown>) {
    if (readOnly) return
    if (!batch) return
    setRows((current) => current.map((row) => (row.id === rowId ? applyLocalPatch(row, patch) : row)))
    if (batch.id.startsWith('local-')) {
      return
    }
    try {
      const res = await organizerDancecardFetch<{ row: ImportRow }>(
        eventSlug,
        `/imports/${batch.id}/draft-rows/${rowId}`,
        { method: 'PATCH', body: JSON.stringify(patch) }
      )
      setRows((current) => current.map((row) => (row.id === rowId ? normalizeImportRow(res.row as Parameters<typeof normalizeImportRow>[0]) : row)))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save draft row')
    }
  }

  async function publishBatch() {
    if (readOnly) return
    if (!batch) return
    if (batch.id.startsWith('local-')) {
      setErr('Publishing is not available in demo mode. This board is for drag-and-drop review only.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const preview = await organizerDancecardFetch<{
        diff: {
          newCount: number
          updatedCount: number
          unchangedCount: number
          invalidCount: number
          unplacedCount: number
          missingFromSourceCount: number
        }
      }>(eventSlug, `/imports/${batch.id}/publish-preview`, { method: 'POST' })
      const d = preview.diff
      const confirmMessage = [
        `${d.newCount} new`,
        `${d.updatedCount} updated`,
        `${d.unchangedCount} unchanged`,
        d.unplacedCount ? `${d.unplacedCount} unplaced (skipped)` : null,
        d.invalidCount ? `${d.invalidCount} invalid (skipped)` : null,
        d.missingFromSourceCount
          ? `${d.missingFromSourceCount} live slots not in this sheet (ignored. Not deleted)`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
      if (
        !(await ask({
          title: 'Publish to live program?',
          message: `Re-importing the same sheet will not duplicate rows with matching keys. ${confirmMessage}`,
        }))
      ) {
        return
      }
      const res = await organizerDancecardFetch<{
        summary: {
          added: number
          updated: number
          unchanged?: number
          skipped: number
          invalid?: number
          unplaced?: number
          missingFromSource?: number
          notified: number
        }
      }>(eventSlug, `/imports/${batch.id}/publish`, { method: 'POST' })
      invalidateOrganizerDancecardCache(eventSlug, '/program-slots')
      setBatch({ ...batch, status: 'published', summary: { ...batch.summary, ...res.summary } })
      setDraftBatches((current) => current.filter((b) => b.id !== batch.id))
      setMessage(
        `Published. Created ${res.summary.added}, updated ${res.summary.updated}, skipped ${res.summary.skipped}. Open Program to review the live grid.`,
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Publish failed')
    } finally {
      setBusy(false)
    }
  }

  async function dropOnBoard(active: ActiveDrag, day: string, hour: number, room: string) {
    if (readOnly) return
    if (active.type === 'location') {
      setActiveDrag(null)
      return
    }
    const start = new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`)
    if (active.type === 'staff') {
      const row = makeDroppedStaffRow(active.staffName, rows.length, room, start.toISOString())
      setRows((current) => [...current, row])
      setSelectedId(row.id)
      setActiveDrag(null)
      return
    }
    if (active.type === 'duty') {
      const duty = dutyTemplates.find((item) => item.id === active.dutyId)
      if (!duty) return
      const row = makeDroppedDutyRow(duty, rows.length, room, start.toISOString())
      setRows((current) => [...current, row])
      setSelectedId(row.id)
      setActiveDrag(null)
      return
    }
    const row = rows.find((item) => item.id === active.rowId)
    if (!row || row.draft_status === 'invalid') return
    const duration = row.duration_minutes ?? 60
    void patchRow(row.id, {
      room,
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + duration * 60_000).toISOString(),
      draftStatus: 'placed',
    })
    setSelectedId(row.id)
    setActiveDrag(null)
  }

  function assignLocationToCard(rowId: string, locationName: string) {
    if (readOnly) return
    void patchRow(rowId, { room: locationName })
    setSelectedId(rowId)
    setActiveDrag(null)
  }

  function assignStaffToShift(rowId: string, staffName: string) {
    if (readOnly) return
    void patchRow(rowId, { personName: staffName })
    setSelectedId(rowId)
    setActiveDrag(null)
  }

  function addDutyTemplate() {
    if (readOnly) return
    const name = newDutyName.trim()
    const duration = Number(newDutyDuration)
    if (!name || !Number.isFinite(duration) || duration <= 0) return
    setDutyTemplates((current) => [
      ...current,
      { id: `duty-${Date.now()}`, name, durationMinutes: Math.round(duration) },
    ])
    setNewDutyName('')
    setNewDutyDuration('120')
  }

  function addLocalStaff() {
    if (readOnly) return
    const name = newStaffName.trim()
    if (!name) return
    setRows((current) =>
      current.some((row) => row.person_name?.toLowerCase() === name.toLowerCase())
        ? current
        : [...current, makeStaffRosterRow(name, current.length)]
    )
    setNewStaffName('')
  }

  function addLocalLocation(locationName: string) {
    if (readOnly) return
    const cleanName = locationName.trim()
    if (!cleanName) return
    setLocations((current) =>
      current.some((location) => location.name.toLowerCase() === cleanName.toLowerCase())
        ? current
        : [
            ...current,
            {
              id: `local-location-${Date.now()}`,
              name: cleanName,
              shortName: cleanName,
              capacity: null,
              notes: null,
              sortOrder: current.length,
            },
          ]
    )
  }

  async function shiftPlaced(minutes: number) {
    if (readOnly) return
    const placed = rows.filter((row) => row.starts_at && row.ends_at && row.draft_status !== 'invalid')
    for (const row of placed) {
      await patchRow(row.id, {
        startsAt: addMinutes(row.starts_at as string, minutes),
        endsAt: addMinutes(row.ends_at as string, minutes),
      })
    }
  }

  async function moveUnplacedToFirstLocation() {
    if (readOnly) return
    const first = laneNames[0] ?? locations[0]?.name
    if (!first) return
    for (const row of rows.filter((item) => !item.room)) {
      await patchRow(row.id, { room: first })
    }
  }

  const importStep: 1 | 2 | 3 = !batch && !pendingParse ? 1 : batch?.status === 'published' ? 3 : 2

  return (
    <div className="space-y-5">
      <Panel variant="default" className="border border-dc-accent-border bg-dc-accent-muted p-4">
        <p className="text-dc-micro font-semibold uppercase tracking-[0.22em] text-dc-text">How import works</p>
        <h3 className="mt-2 font-serif text-lg text-dc-text">Every sheet is different. Map once, reuse forever</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-dc-muted">
          <li>
            <strong className="text-dc-text">Flat row lists</strong> (title + start + end + room columns) work best.
            Download our template or export from Google Sheets as CSV/XLSX.
          </li>
          <li>
            We <strong className="text-dc-text">auto-detect header names</strong> (Start, Class, Room, etc.). You confirm
            or fix the column mapping. No AI; your choices are saved on the draft batch.
          </li>
          <li>Unscheduled rows land in the library; drag onto the board to place times and rooms, then publish.</li>
          <li>
            <strong className="text-dc-text">Volunteer shift grids</strong> are managed on the People → Staff shifts tab.
            Spreadsheet import for staff shifts is not available yet.
          </li>
        </ol>
        <p className="mt-3 text-xs leading-relaxed text-dc-muted">
          Full checklist:{' '}
          <Link
            href="/docs/dancecard-first-run.md"
            className="font-semibold text-dc-accent underline underline-offset-2 hover:text-dc-accent-hover"
            target="_blank"
            rel="noopener noreferrer"
          >
            docs/dancecard-first-run.md
          </Link>
        </p>
      </Panel>
      {draftBatches.length > 0 && !batch ? (
        <Panel variant="muted" className="border border-dc-border-subtle p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Resume a draft import</p>
          <ul className="mt-2 space-y-2">
            {draftBatches.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-dc-text">
                  {b.kind} · {b.source_filename ?? 'import'} · {String(b.summary?.total ?? '?')} rows
                </span>
                <button
                  type="button"
                  disabled={busy || readOnly}
                  className="rounded-lg border border-dc-accent-border px-3 py-1 text-xs font-semibold text-dc-accent hover:bg-dc-accent-muted disabled:opacity-50"
                  onClick={() => void resumeDraftBatch(b.id)}
                >
                  Resume
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      {dialog}
      {err ? <p className="rounded-2xl border border-red-200 bg-red-100 px-4 py-3 text-sm text-red-800">{err}</p> : null}
      {message ? <p className="rounded-2xl border border-dc-accent-border bg-dc-accent-muted px-4 py-3 text-sm text-dc-accent">{message}</p> : null}
      {batch && rows.length ? (
        <div className="rounded-2xl border border-dc-accent-border bg-dc-accent-muted px-4 py-3 text-sm text-dc-accent">
          <p className="text-xs font-semibold uppercase tracking-wide text-dc-accent">Draft diff summary</p>
          <p className="mt-1 font-medium text-dc-text">{importDiffHeadline(diffSummary)}</p>
          <p className="mt-2 text-xs text-dc-muted">
            {diffSummary.total} rows · {diffSummary.newCount} new · {diffSummary.updatedCount} updated ·{' '}
            {diffSummary.removedCount} removed · {diffSummary.unchangedCount} unchanged · {diffSummary.invalidCount}{' '}
            invalid · {diffSummary.conflictCount} conflict hints
          </p>
        </div>
      ) : null}

      <div className="rounded-3xl border border-dc-border bg-dc-elevated-solid p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-dc-micro font-semibold uppercase tracking-wide text-dc-muted">Import schedule</p>
            <h2 className="mt-1 font-serif text-2xl text-dc-text">Upload, preview, then import</h2>
            <p className="mt-1 text-sm text-dc-muted">
              Upload a class/program spreadsheet, review rows on the draft board, then publish when it looks right.
            </p>
            <Panel variant="muted" className="mt-4 !p-3 text-sm text-dc-muted">
              <p className="font-medium text-dc-text">Staging board → live program</p>
              <p className="mt-1 text-xs leading-relaxed">
                This import board is staging only. Publishing copies rows into the Program grid. That grid is the single
                source of truth attendees see. You can skip import from Home if you will build the schedule manually.
              </p>
              {!readOnly ? (
                <button
                  type="button"
                  className="mt-3 text-xs font-semibold text-dc-accent hover:underline"
                  onClick={() => {
                    try {
                      localStorage.setItem(IMPORT_SKIP_STORAGE_KEY(eventSlug), '1')
                    } catch {
                      /* ignore */
                    }
                    setMessage('Import marked as skipped on Home. You can still import later.')
                  }}
                >
                  Skip import for now
                </button>
              ) : null}
            </Panel>
          </div>
          <p className="mt-2 text-xs text-dc-muted">
            Program/class import only. For volunteer shifts, use People → Staff shifts (add shifts there; spreadsheet import
            coming later).
          </p>
          {kind === 'staff' && batch ? (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              This draft is a legacy staff import and cannot be published from here. Create shifts on People → Staff shifts,
              or start a new program import below.
            </p>
          ) : null}
        </div>

        <ol className="mt-4 flex flex-wrap gap-2 text-dc-micro font-semibold uppercase tracking-wide">
          {[
            { n: 1, label: 'Upload & map columns' },
            { n: 2, label: 'Preview draft' },
            { n: 3, label: 'Publish to program' },
          ].map((step) => (
            <li
              key={step.n}
              className={cx(
                'rounded-full border px-3 py-1',
                importStep === step.n ? 'border-dc-accent/40 bg-dc-accent/10 text-dc-accent' : 'border-dc-border text-dc-muted',
                importStep > step.n && 'border-dc-success/30 text-dc-success',
              )}
            >
              {step.n}. {step.label}
            </li>
          ))}
        </ol>

        {importStep > 1 ? (
          <p className="mt-3 text-sm text-dc-muted">
            Draft loaded. Arrange rows on the board below, then use <strong className="font-medium text-dc-text">Publish</strong>{' '}
            in the review panel to import into your live schedule.
          </p>
        ) : null}

        <GoogleSheetsImportSection
          eventSlug={eventSlug}
          kind={kind}
          readOnly={readOnly}
          canConfigureGoogle={canConfigureGoogle}
          onRowsFetched={({ rawRows, spreadsheetId, sheetName }) => {
            clearPendingSource()
            setBatch(null)
            setRows([])
            setFile(null)
            setJsonText('')
            const parsed = beginPendingParse(rawRows, {
              sheetName,
              sourceFilename: `google-sheets:${spreadsheetId}`,
              spreadsheetId,
            })
            setMessage(
              `Fetched ${parsed.rows.length} rows from Google Sheets. Map columns below, then create your draft.`,
            )
          }}
          onClearFileUpload={() => {
            setFile(null)
            setJsonText('')
          }}
          onMessage={setMessage}
          onError={setErr}
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-dc-accent-border px-3 py-2 text-sm font-semibold text-dc-accent hover:bg-dc-accent-muted"
            onClick={downloadTemplate}
          >
            Download {kind} template (.csv)
          </button>
        </div>

        <p className="mt-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-dc-muted">or upload a file</p>

        <div className="mt-4">
          <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-dc-muted">
            Spreadsheet file (.csv or .xlsx)
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.txt"
              className="mt-2 block w-full rounded-lg border border-dc-border bg-dc-surface-muted px-3 py-2 text-sm text-dc-text file:mr-3 file:rounded-md file:border-0 file:bg-dc-accent file:px-3 file:py-1 file:text-xs file:font-semibold file:text-dc-accent-foreground"
              onChange={(event) => {
                const f = event.target.files?.[0] ?? null
                setFile(f)
                setJsonText('')
                clearPendingSource()
                setBatch(null)
                setRows([])
                if (f) void parseSelectedFile(f)
              }}
            />
            <span className="mt-2 block text-xs font-normal normal-case leading-relaxed text-dc-muted">
              Export from Google Sheets (File → Download → CSV or Excel). We read the first matching sheet in .xlsx
              workbooks.
            </span>
          </label>
        </div>
        {pendingRawRows && pendingParse ? (
          <div className="mt-4">
            <ImportColumnMappingPanel
              eventSlug={eventSlug}
              kind={kind}
              rawRows={pendingRawRows}
              timezone={timezone}
              windowStartsAt={windowStartsAt}
              windowEndsAt={windowEndsAt}
              sheetName={pendingSheetName}
              spreadsheetId={pendingSpreadsheetId}
              sourceId={
                pendingSheetName
                  ? `sheet:${pendingSheetName}`
                  : pendingSpreadsheetId
                    ? `sheet:${pendingSpreadsheetId}`
                    : undefined
              }
              initialHeaderRowIndex={pendingParse.headerRowIndex}
              initialMapping={pendingParse.columnMapping}
              initialImportFormat={pendingParse.importFormat}
              readOnly={readOnly}
              onMappingChange={setPendingParse}
            />
          </div>
        ) : null}

        {pendingParse ? (
          <button
            type="button"
            disabled={busy || readOnly}
            className="mt-4 rounded-lg bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground hover:opacity-90 disabled:opacity-50"
            onClick={() => void uploadImport()}
          >
            {busy ? 'Working…' : 'Create draft from mapping'}
          </button>
        ) : null}

        <details className="mt-4 rounded-xl border border-dc-border bg-dc-elevated-muted/50 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-dc-text">Advanced: paste JSON rows</summary>
          <div className="mt-3">
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-dc-muted">
              Raw JSON array
              <textarea
                className="mt-2 min-h-[90px] w-full rounded-2xl border border-dc-border bg-dc-elevated-muted px-3 py-2 text-sm text-dc-text"
                placeholder='[{"title":"Class","startsAt":"2026-06-12T10:00:00-04:00","endsAt":"...","room":"Main Hall"}]'
                value={jsonText}
                onChange={(event) => {
                  setJsonText(event.target.value)
                  if (event.target.value.trim()) setFile(null)
                }}
              />
            </label>
            <button
              type="button"
              disabled={busy || readOnly || !jsonText.trim()}
              className="mt-3 rounded-lg bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground hover:opacity-90 disabled:opacity-50"
              onClick={() => void uploadImport()}
            >
              {busy ? 'Working…' : 'Import JSON rows'}
            </button>
          </div>
        </details>

        {import.meta.env.DEV ? (
          <>
            <button
              type="button"
              disabled={readOnly}
              className="ml-2 mt-4 rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-50"
              onClick={loadBlankEventDraft}
            >
              Start blank event demo
            </button>
            <button
              type="button"
              disabled={readOnly}
              className="ml-2 mt-4 rounded-full border border-dc-accent-border px-4 py-2 text-sm font-bold text-dc-accent shadow-sm hover:bg-dc-accent-muted"
              onClick={loadDemoDraft}
            >
              {kind === 'program' ? 'Load unscheduled PAF demo' : 'Load drag/drop demo'}
            </button>
          </>
        ) : null}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDndDragStart}
        onDragEnd={handleDndDragEnd}
      >
      {locationsNeedsMigration ? (
        <div className="mb-4 rounded-2xl border border-amber-400/35 bg-amber-100 p-4 text-sm text-amber-900">
          <p className="font-semibold text-amber-900">Rooms are not set up yet</p>
          <p className="mt-1 text-amber-900/90">{supportCopy.locationsNotReady}</p>
        </div>
      ) : null}
      <LocationManagerPanel
        eventSlug={eventSlug}
        locations={locations}
        readOnly={readOnly}
        onChange={loadLocations}
        onLocalAdd={addLocalLocation}
        onRemoteError={(msg) => setErr(msg)}
      />

      {batch ? (
        <div className="grid gap-5 xl:grid-cols-[310px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-3xl border border-dc-border bg-dc-elevated-solid p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-dc-muted">Review</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-2xl bg-dc-elevated-muted p-2">
                  <b className="block text-dc-text">{batch.id.startsWith('local-') ? rows.length : batch.summary.total ?? rows.length}</b>Total
                </div>
                <div className="rounded-2xl bg-dc-elevated-muted p-2"><b className="block text-dc-accent">{batch.summary.valid ?? rows.filter((r) => !r.validation_errors?.length).length}</b>Valid</div>
                <div className="rounded-2xl bg-dc-elevated-muted p-2"><b className="block text-amber-900">{batch.summary.invalid ?? rows.filter((r) => r.validation_errors?.length).length}</b>Invalid</div>
              </div>
              {batch.kind === 'program' ? (
                <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="rounded-2xl bg-dc-elevated-muted p-2">
                    <b className="block text-amber-900">{unscheduledProgramCount}</b>Unscheduled
                  </div>
                  <div className="rounded-2xl bg-dc-elevated-muted p-2">
                    <b className="block text-dc-accent">{scheduledCount}</b>Scheduled
                  </div>
                </div>
              ) : batch.kind === 'staff' ? (
                <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="rounded-2xl bg-dc-elevated-muted p-2">
                    <b className="block text-amber-900">{unassignedDutyCount}</b>Unassigned duties
                  </div>
                  <div className="rounded-2xl bg-dc-elevated-muted p-2">
                    <b className="block text-red-800">
                      {Array.from(staffMetrics.values()).reduce((total, metric) => total + metric.conflictCount, 0)}
                    </b>
                    Conflicts
                  </div>
                </div>
              ) : null}
              {batch.kind === 'event' ? (
                <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="rounded-2xl bg-dc-elevated-muted p-2">
                    <b className="block text-amber-900">{unscheduledProgramCount}</b>Unscheduled classes
                  </div>
                  <div className="rounded-2xl bg-dc-elevated-muted p-2">
                    <b className="block text-dc-accent">{scheduledCount}</b>Scheduled classes
                  </div>
                  <div className="rounded-2xl bg-dc-elevated-muted p-2">
                    <b className="block text-amber-900">{unassignedDutyCount}</b>Unassigned duties
                  </div>
                  <div className="rounded-2xl bg-dc-elevated-muted p-2">
                    <b className="block text-red-800">
                      {Array.from(staffMetrics.values()).reduce((total, metric) => total + metric.conflictCount, 0)}
                    </b>
                    Conflicts
                  </div>
                </div>
              ) : null}
              {batch.status !== 'published' ? (
                <div className="mt-3 rounded-2xl border border-dc-border bg-dc-elevated-muted px-3 py-2 text-xs text-dc-muted">
                  <p className="font-semibold text-dc-text">Pre-publish summary</p>
                  <p className="mt-1">
                    {importActionCounts.add > 0 ? (
                      <span className="mr-2 text-emerald-700">{importActionCounts.add} add</span>
                    ) : null}
                    {importActionCounts.update > 0 ? (
                      <span className="mr-2 text-amber-800">{importActionCounts.update} update</span>
                    ) : null}
                    {importActionCounts.delete > 0 ? (
                      <span className="mr-2 text-red-700">{importActionCounts.delete} delete</span>
                    ) : null}
                    {importActionCounts.unchanged > 0 ? (
                      <span className="text-dc-muted">{importActionCounts.unchanged} unchanged</span>
                    ) : null}
                    {!importActionCounts.add &&
                    !importActionCounts.update &&
                    !importActionCounts.delete &&
                    !importActionCounts.unchanged ? (
                      <span className="text-dc-muted">No diff actions counted.</span>
                    ) : null}
                  </p>
                </div>
              ) : null}
              <div className="mt-3 flex flex-col gap-2">
                <button type="button" disabled={readOnly} className="rounded-full border border-dc-border px-3 py-2 text-sm text-dc-text" onClick={() => void moveUnplacedToFirstLocation()}>
                  Move unplaced to first location
                </button>
                <button type="button" disabled={readOnly} className="rounded-full border border-dc-border px-3 py-2 text-sm text-dc-text" onClick={() => void shiftPlaced(30)}>
                  Bulk shift placed +30m
                </button>
                <button type="button" disabled={readOnly} className="rounded-full bg-dc-accent px-3 py-2 text-sm font-bold text-dc-accent-foreground" onClick={() => void publishBatch()}>
                  Review and publish
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-dc-border bg-dc-elevated-solid p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-dc-muted">Staff roster</p>
              <p className="mt-1 text-xs text-dc-muted">Add staff, then drag a person onto an existing duty shift to assign them.</p>
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <input
                  className="rounded-xl border border-dc-border bg-dc-elevated-muted px-3 py-2 text-xs text-dc-text"
                  value={newStaffName}
                  placeholder="Staff name"
                  onChange={(event) => setNewStaffName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') addLocalStaff()
                  }}
                />
                <button
                  type="button"
                  className="rounded-xl bg-blue-200 px-3 py-2 text-xs font-bold text-slate-950"
                  onClick={addLocalStaff}
                >
                  Add
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {staffNames.length ? staffNames.map((name) => {
                    const metric = staffMetrics.get(name) ?? { name, shiftCount: 0, minutes: 0, conflictCount: 0 }
                    return (
                  <ImportDraggableStaffChip
                    key={name}
                    name={name}
                    readOnly={readOnly}
                    className={cx(
                      'cursor-grab rounded-2xl border px-3 py-2 text-left text-xs font-semibold active:cursor-grabbing',
                      metric.conflictCount ? 'border-red-300 bg-red-100 text-red-800' : '',
                      activeDrag?.type === 'staff' && activeDrag.staffName === name
                        ? 'border-blue-100/50 bg-blue-200/20 text-blue-50'
                        : 'border-blue-200/20 bg-blue-300/10 text-blue-100'
                    )}
                  >
                    <span className="block">{name}</span>
                    <span className="mt-0.5 block font-normal text-dc-muted">
                      {metric.shiftCount} shifts · {(metric.minutes / 60).toFixed(metric.minutes % 60 ? 1 : 0)}h
                      {metric.conflictCount ? ` · ${metric.conflictCount} conflict${metric.conflictCount === 1 ? '' : 's'}` : ''}
                    </span>
                  </ImportDraggableStaffChip>
                    )
                }) : <span className="text-sm text-dc-muted">No staff names parsed yet.</span>}
              </div>
            </div>

            <div className="rounded-3xl border border-dc-border bg-dc-elevated-solid p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-dc-muted">Duty templates</p>
              <p className="mt-1 text-xs text-dc-muted">Create duties, then drag duty chips onto the board to make shifts.</p>
              <div className="mt-3 grid grid-cols-[1fr_5rem_auto] gap-2">
                <input
                  className="rounded-xl border border-dc-border bg-dc-elevated-muted px-3 py-2 text-xs text-dc-text"
                  value={newDutyName}
                  placeholder="Duty name"
                  onChange={(event) => setNewDutyName(event.target.value)}
                />
                <input
                  className="rounded-xl border border-dc-border bg-dc-elevated-muted px-3 py-2 text-xs text-dc-text"
                  value={newDutyDuration}
                  placeholder="Min"
                  inputMode="numeric"
                  onChange={(event) => setNewDutyDuration(event.target.value)}
                />
                <button
                  type="button"
                  className="rounded-xl bg-dc-accent px-3 py-2 text-xs font-bold text-dc-accent-foreground"
                  onClick={addDutyTemplate}
                >
                  Add
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {dutyTemplates.map((duty) => (
                  <ImportDraggableDutyChip
                    key={duty.id}
                    dutyId={duty.id}
                    readOnly={readOnly}
                    className={cx(
                      'cursor-grab rounded-full border px-3 py-1 text-xs font-semibold active:cursor-grabbing',
                      activeDrag?.type === 'duty' && activeDrag.dutyId === duty.id
                        ? 'border-dc-accent-border bg-dc-accent-muted text-dc-accent'
                        : 'border-dc-accent-border/40 bg-dc-accent/10 text-dc-accent'
                    )}
                  >
                    {duty.name} · {duty.durationMinutes}m
                  </ImportDraggableDutyChip>
                ))}
                {!dutyTemplates.length ? (
                  <p className="rounded-2xl border border-dc-border bg-dc-elevated-muted p-3 text-sm text-dc-muted">
                    No duties yet. Add a duty name above, then drag it onto the board to create a shift.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl border border-dc-border bg-dc-elevated-solid p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-dc-muted">
                {batch.kind === 'staff' ? 'Draft cards' : 'Class library'}
              </p>
              <p className="mt-1 text-xs text-dc-muted">
                {batch.kind === 'staff'
                  ? 'Drag a card into a room/time cell to place or move it.'
                  : 'These classes are mock program cards. Drag a card into a location/time cell to schedule it.'}
              </p>
              <SortableContext items={libraryRowIds} strategy={verticalListSortingStrategy}>
              <div className="mt-3 grid max-h-[30rem] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-1">
                {libraryRows.map((row) => (
                  <ImportSortableLibraryCard
                    key={row.id}
                    rowId={row.id}
                    readOnly={readOnly || row.draft_status === 'invalid'}
                    className={cx(
                      'w-full cursor-grab rounded-2xl border p-3 text-left text-sm active:cursor-grabbing',
                      importActionBorderClass(row.action),
                      selectedId === row.id ? 'bg-dc-accent-muted' : 'bg-dc-surface-muted/50',
                      activeDrag?.type === 'row' && activeDrag.rowId === row.id && 'border-dc-accent-border bg-dc-accent-muted',
                      row.draft_status === 'invalid' && 'cursor-not-allowed border-amber-200/30 bg-amber-300/10'
                    )}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <span className="block font-semibold text-dc-text">{row.title || row.person_name || 'Untitled row'}</span>
                    <span className="mt-1 block text-xs text-dc-muted">
                      {row.kind === 'staff' ? row.role || 'Duty' : row.track || 'Program'} · {row.room || 'No location'}
                    </span>
                    <span className="mt-1 block text-xs text-dc-muted">
                      {row.starts_at ? localInputValue(row.starts_at).replace('T', ' ') : 'Unscheduled'}
                    </span>
                  </ImportSortableLibraryCard>
                ))}
                {!libraryRows.length ? (
                  <p className="rounded-2xl border border-dc-border bg-dc-elevated-muted p-3 text-sm text-dc-muted">
                    Nothing waiting here. Scheduled items live on the board.
                  </p>
                ) : null}
              </div>
              </SortableContext>
            </div>
          </aside>

          <div className="space-y-4">
            <div className="overflow-x-auto rounded-3xl border border-dc-border bg-dc-surface-muted p-3">
              <p className="mb-2 text-xs text-dc-muted md:hidden">Swipe horizontally to see all rooms and time slots.</p>
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-dc-muted">Draft board</p>
                  <p className="text-xs text-dc-muted">Drop onto a room/time cell. Filled cells stay editable from the side panel.</p>
                </div>
                {activeDrag ? (
                  <p className="rounded-full border border-dc-accent-border bg-dc-accent-muted px-3 py-1 text-xs font-semibold text-dc-accent">
                    Dragging{' '}
                    {activeDrag.type === 'staff'
                      ? activeDrag.staffName
                      : activeDrag.type === 'location'
                        ? `${activeDrag.locationName} location`
                        : activeDrag.type === 'duty'
                          ? `${dutyTemplates.find((duty) => duty.id === activeDrag.dutyId)?.name ?? 'Duty'} duty`
                          : rows.find((row) => row.id === activeDrag.rowId)?.title ?? 'draft card'}
                  </p>
                ) : null}
              </div>
              <div className="min-w-[760px]">
                <div className="grid gap-2" style={{ gridTemplateColumns: `90px repeat(${Math.max(laneNames.length, 1)}, minmax(130px, 1fr))` }}>
                  <div />
                  {(laneNames.length ? laneNames : ['Unassigned']).map((room) => (
                    <div key={room} className="rounded-2xl border border-dc-border bg-dc-elevated-muted px-3 py-2 text-sm font-semibold text-dc-text">{room}</div>
                  ))}
                  {days.flatMap((day) =>
                    hours.map((hour) => (
                      <Fragment key={`${day}-${hour}`}>
                        <div key={`${day}-${hour}-label`} className="py-2 pr-2 text-right text-xs text-dc-muted">
                          {day.slice(5)} {String(hour).padStart(2, '0')}:00
                        </div>
                        {(laneNames.length ? laneNames : ['Unassigned']).map((room) => (
                          <ImportDroppableCell
                            key={`${day}-${hour}-${room}`}
                            id={cellDropId(day, hour, room)}
                            className={cx('min-h-[58px] rounded-2xl border border-dc-border/60 bg-dc-elevated-muted p-1 transition')}
                          >
                            {rows
                              .filter((row) => row.room === room && row.starts_at?.startsWith(day) && new Date(row.starts_at).getHours() === hour)
                              .map((row) => (
                                <ImportBoardSlotDropTarget key={row.id} rowId={row.id}>
                                  <ImportDraggableBoardSlot
                                    rowId={row.id}
                                    readOnly={readOnly}
                                    className={cx(
                                      'mb-1 w-full cursor-grab rounded-xl border px-2 py-1 text-left text-[11px] active:cursor-grabbing',
                                      importActionBorderClass(row.action),
                                      row.action === 'unchanged' ? 'text-dc-text-muted bg-dc-surface-muted/50' : 'text-dc-accent bg-dc-accent-muted',
                                      row.kind === 'staff' && !row.person_name && 'border-amber-200/40 bg-amber-300/10 text-amber-900',
                                      conflictShiftIds.has(row.id) && 'border-rose-200/60 bg-rose-300/15 text-red-900'
                                    )}
                                    onClick={() => setSelectedId(row.id)}
                                  >
                                  <span className="block truncate">{row.title || row.role || 'Duty shift'}</span>
                                  <span className="block text-[10px] text-dc-accent/70">
                                    {row.ends_at ? `${localInputValue(row.starts_at).slice(11)}-${localInputValue(row.ends_at).slice(11)}` : 'Placed'}
                                  </span>
                                  {row.kind === 'staff' ? (
                                    <span className="block truncate text-[10px] text-dc-muted">
                                      {row.person_name ? `Assigned: ${row.person_name}` : 'Unassigned'}
                                      {conflictShiftIds.has(row.id) ? ' · Conflict' : ''}
                                    </span>
                                  ) : null}
                                  </ImportDraggableBoardSlot>
                                </ImportBoardSlotDropTarget>
                              ))}
                          </ImportDroppableCell>
                        ))}
                      </Fragment>
                    ))
                  )}
                </div>
              </div>
            </div>

            {selected ? (
              <ScheduleCardDetailsPanel
                row={selected}
                conflictRows={selectedConflictRows}
                onSave={(patch) => void patchRow(selected.id, patch)}
                onSaveRow={(rowId, patch) => void patchRow(rowId, patch)}
                onSelectRow={setSelectedId}
              />
            ) : null}
          </div>
        </div>
      ) : null}
      </DndContext>
    </div>
  )
}

function LocationManagerPanel({
  eventSlug,
  locations,
  readOnly,
  onChange,
  onLocalAdd,
  onRemoteError,
}: {
  eventSlug: string
  locations: OrganizerLocation[]
  readOnly?: boolean
  onChange: () => Promise<void>
  onLocalAdd: (locationName: string) => void
  onRemoteError: (message: string) => void
}) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function addLocation() {
    if (readOnly) return
    const cleanName = name.trim()
    if (!cleanName) return
    onLocalAdd(cleanName)
    setName('')
    setBusy(true)
    try {
      await organizerDancecardFetch(eventSlug, '/locations', {
        method: 'POST',
        body: JSON.stringify({ name: cleanName, sortOrder: locations.length }),
      })
      await onChange()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save location to the server'
      onRemoteError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-3xl border border-dc-border bg-dc-elevated-solid p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-dc-muted">Locations</p>
          <p className="mt-1 text-sm text-dc-muted">Create reusable locations, then drag a chip onto any class card to assign it.</p>
        </div>
        <div className="flex gap-2">
          <input className="rounded-full border border-dc-border bg-dc-elevated-muted px-3 py-2 text-sm text-dc-text" value={name} disabled={readOnly} onChange={(event) => setName(event.target.value)} placeholder="Room name" />
          <button type="button" disabled={busy || readOnly} className="rounded-full bg-dc-accent px-4 py-2 text-sm font-bold text-dc-accent-foreground disabled:opacity-60" onClick={() => void addLocation()}>
            Add
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {locations.map((location) => (
          <ImportDraggableLocationChip
            key={location.id}
            locationName={location.name}
            readOnly={readOnly}
            className={cx(
              'cursor-grab rounded-full border px-3 py-1 text-xs font-semibold active:cursor-grabbing',
              'border-amber-200/20 bg-amber-300/10 text-amber-900'
            )}
          >
            {location.name}
          </ImportDraggableLocationChip>
        ))}
        {!locations.length ? <span className="text-sm text-dc-muted">No locations yet. Add one to create schedule lanes.</span> : null}
      </div>
    </div>
  )
}

function ScheduleCardDetailsPanel({
  row,
  conflictRows,
  onSave,
  onSaveRow,
  onSelectRow,
}: {
  row: ImportRow
  conflictRows: ImportRow[]
  onSave: (patch: Record<string, unknown>) => void
  onSaveRow: (rowId: string, patch: Record<string, unknown>) => void
  onSelectRow: (rowId: string) => void
}) {
  const [title, setTitle] = useState(row.title ?? row.person_name ?? '')
  const [room, setRoom] = useState(row.room ?? '')
  const [startsAt, setStartsAt] = useState(localInputValue(row.starts_at))
  const [endsAt, setEndsAt] = useState(localInputValue(row.ends_at))

  useEffect(() => {
    setTitle(row.title ?? row.person_name ?? '')
    setRoom(row.room ?? '')
    setStartsAt(localInputValue(row.starts_at))
    setEndsAt(localInputValue(row.ends_at))
  }, [row])

  function moveSelected(minutes: number) {
    if (!row.starts_at || !row.ends_at) return
    onSave({
      startsAt: addMinutes(row.starts_at, minutes),
      endsAt: addMinutes(row.ends_at, minutes),
      draftStatus: 'placed',
    })
  }

  return (
    <div className="rounded-3xl border border-dc-border bg-dc-elevated-solid p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-dc-muted">Selected draft card</p>
      {conflictRows.length ? (
        <div className="mt-3 rounded-2xl border border-rose-200/30 bg-red-100 p-3 text-sm text-red-900">
          <p className="font-semibold">
            {row.person_name} is double-booked on {conflictRows.length} other shift{conflictRows.length === 1 ? '' : 's'}.
          </p>
          <div className="mt-2 space-y-2">
            {conflictRows.map((conflict) => (
              <div key={conflict.id} className="rounded-xl border border-dc-border bg-dc-elevated-muted p-2">
                <p className="text-xs text-red-800">
                  {conflict.role || 'Duty shift'} · {conflict.room || 'No location'} · {formatScheduleLabel(conflict)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-dc-border px-3 py-1 text-xs font-semibold text-red-900 hover:bg-dc-accent-muted"
                    onClick={() => onSelectRow(conflict.id)}
                  >
                    View conflict
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-dc-border px-3 py-1 text-xs font-semibold text-red-900 hover:bg-dc-accent-muted"
                    onClick={() => onSaveRow(conflict.id, { personName: null })}
                  >
                    Unassign other shift
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-950"
              onClick={() => onSave({ personName: null })}
            >
              Unassign this shift
            </button>
            <button
              type="button"
              className="rounded-full border border-rose-100/30 px-3 py-1.5 text-xs font-bold text-red-900"
              onClick={() => moveSelected(30)}
            >
              Move this +30m
            </button>
            <button
              type="button"
              className="rounded-full border border-rose-100/30 px-3 py-1.5 text-xs font-bold text-red-900"
              onClick={() => moveSelected(60)}
            >
              Move this +1h
            </button>
          </div>
        </div>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-dc-muted">
          Title / person
          <input className="mt-1 w-full rounded-xl border border-dc-border bg-dc-elevated-muted px-3 py-2 text-sm text-dc-text" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="text-xs text-dc-muted">
          Location
          <input className="mt-1 w-full rounded-xl border border-dc-border bg-dc-elevated-muted px-3 py-2 text-sm text-dc-text" value={room} onChange={(event) => setRoom(event.target.value)} />
        </label>
        <label className="text-xs text-dc-muted">
          Starts
          <input type="datetime-local" className="mt-1 w-full rounded-xl border border-dc-border bg-dc-elevated-muted px-3 py-2 text-sm text-dc-text" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
        </label>
        <label className="text-xs text-dc-muted">
          Ends
          <input type="datetime-local" className="mt-1 w-full rounded-xl border border-dc-border bg-dc-elevated-muted px-3 py-2 text-sm text-dc-text" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
        </label>
      </div>
      {row.validation_errors?.length ? (
        <p className="mt-3 rounded-2xl border border-amber-200/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-900">{row.validation_errors.join(', ')}</p>
      ) : null}
      <button
        type="button"
        className="mt-4 rounded-full bg-dc-accent px-4 py-2 text-sm font-bold text-dc-accent-foreground"
        onClick={() =>
          onSave({
            ...(row.kind === 'program' ? { title } : { personName: title }),
            room,
            startsAt: startsAt ? new Date(startsAt).toISOString() : null,
            endsAt: endsAt ? new Date(endsAt).toISOString() : null,
            draftStatus: startsAt && endsAt ? 'placed' : 'unplaced',
          })
        }
      >
        Save draft changes
      </button>
    </div>
  )
}
