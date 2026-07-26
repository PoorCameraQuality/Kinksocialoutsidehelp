'use client'

import type { CSSProperties } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  PROGRAM_UNASSIGNED_POOL_ID,
  programSlotDragId,
} from '@/components/dancecard/organizer/program/programScheduleDndIds'
import { formatTimeLabel } from '@/components/dancecard/organizer/organizerTimeline'
import type { ProgramSlotRow } from '@/lib/dancecard/organizerProgramSlotDto'
import { slotCardVisual } from '@/lib/dancecard/trackDisplayColors'
import { cn } from '@/lib/cn'

function displayTrack(slot: ProgramSlotRow) {
  return (slot.trackName ?? slot.track ?? '').trim()
}

function durationMinutes(slot: ProgramSlotRow): number | null {
  if (!slot.startsAt || !slot.endsAt) return null
  const ms = new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()
  if (ms <= 0) return null
  return Math.round(ms / 60000)
}

/** Prominent control to open the session drawer (assign people, edit, publish). */
export function ProgramSessionEditButton({
  slotTitle,
  scheduledItemLabel,
  compact = false,
  className,
  onClick,
}: {
  slotTitle: string
  scheduledItemLabel: string
  compact?: boolean
  className?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        'shrink-0 rounded-md border-2 border-dc-accent bg-dc-accent font-bold uppercase tracking-wide text-dc-accent-foreground shadow-md',
        'hover:border-dc-accent-hover hover:bg-dc-accent-hover',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dc-accent',
        compact ? 'min-h-[1.5rem] min-w-[2rem] px-1 py-0.5 text-[9px] leading-none' : 'min-h-[1.75rem] px-2.5 py-1 text-[11px]',
        className,
      )}
      aria-label={`Edit ${slotTitle}`}
      title={`Edit ${scheduledItemLabel}. Assign people, room, publish`}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
    >
      Edit
    </button>
  )
}

export function ProgramGridDroppableCell({
  id,
  className,
  style,
  onPointerDown,
  onPointerEnter,
}: {
  id: string
  className: string
  style?: CSSProperties
  onPointerDown?: () => void
  onPointerEnter?: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      role="presentation"
      className={cn(className, isOver && 'bg-dc-accent-muted/50 ring-1 ring-inset ring-dc-accent-border')}
      style={style}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
    />
  )
}

export function ProgramUnassignedPool({
  readOnly,
  slots,
  scheduledItemLabel,
  scheduledItemPlural: _scheduledItemPlural,
  addItemCta,
  onOpenDrawer,
  onCreateDraft,
  onOpenImport,
  busy,
}: {
  readOnly?: boolean
  slots: ProgramSlotRow[]
  scheduledItemLabel: string
  scheduledItemPlural: string
  addItemCta?: string
  onOpenDrawer: (slot: ProgramSlotRow) => void
  onCreateDraft: () => void
  onOpenImport?: () => void
  busy?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: PROGRAM_UNASSIGNED_POOL_ID })
  return (
    <aside
      ref={setNodeRef}
      className={cn(
        'flex w-full shrink-0 flex-col rounded-xl border border-dc-border bg-dc-surface-muted/80 lg:w-60 xl:w-72',
        isOver && 'ring-2 ring-dc-accent-border',
      )}
      data-dc-program-unassigned
    >
      <div className="border-b border-dc-border-subtle px-3 py-2.5">
        <h3 className="text-sm font-semibold text-dc-text">
          Unscheduled sessions ({slots.length})
        </h3>
        <p className="mt-0.5 text-dc-micro leading-relaxed text-dc-muted">
          Sessions without a time live here. Drag them onto the grid to schedule, or drag scheduled sessions here to
          unschedule them.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-dc-border-subtle px-3 py-2">
        {!readOnly ? (
          <>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg bg-dc-accent px-2.5 py-1 text-dc-micro font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
              onClick={onCreateDraft}
            >
              {addItemCta ?? '+ Add session'}
            </button>
            {onOpenImport ? (
              <button
                type="button"
                className="rounded-lg border border-dc-border px-2.5 py-1 text-dc-micro text-dc-text hover:bg-dc-elevated-muted/80"
                onClick={onOpenImport}
              >
                Import schedule
              </button>
            ) : null}
          </>
        ) : null}
      </div>
      <div className="max-h-[min(420px,50vh)] flex-1 space-y-2 overflow-y-auto p-2 lg:max-h-none">
        {slots.length === 0 ? (
          <p className="rounded-lg border border-dashed border-dc-border-subtle px-3 py-6 text-center text-dc-micro leading-relaxed text-dc-muted">
            No unscheduled sessions.
            {!readOnly ? (
              <>
                {' '}
                Create a session, import a schedule, or drag a scheduled item here to unschedule it.
              </>
            ) : null}
          </p>
        ) : (
          slots.map((slot) => (
            <ProgramUnassignedCard
              key={slot.id}
              slot={slot}
              readOnly={readOnly}
              scheduledItemLabel={scheduledItemLabel}
              onOpenDrawer={onOpenDrawer}
            />
          ))
        )}
      </div>
    </aside>
  )
}

function ProgramUnassignedCard({
  slot,
  readOnly,
  scheduledItemLabel,
  onOpenDrawer,
}: {
  slot: ProgramSlotRow
  readOnly?: boolean
  scheduledItemLabel: string
  onOpenDrawer: (slot: ProgramSlotRow) => void
}) {
  const id = programSlotDragId(slot.id)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled: readOnly })
  const tr = displayTrack(slot)
  const visual = slotCardVisual({ trackColorHex: slot.trackColor, trackName: tr })
  const dur = durationMinutes(slot)
  const style: CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.8 : 1,
    touchAction: 'none',
    ...visual.style,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative overflow-hidden rounded-lg border border-dc-border-subtle',
        visual.className,
        !slot.isPublished && 'ring-1 ring-dashed ring-dc-warning/50',
        !readOnly && 'cursor-grab active:cursor-grabbing',
        isDragging && 'z-20 shadow-lg ring-2 ring-dc-accent-border',
      )}
    >
      <div
        className={cn('px-2 py-1.5', !readOnly && 'touch-none')}
        title={readOnly ? slot.title : `${slot.title}. Drag onto the grid to schedule`}
        {...(readOnly ? {} : { ...listeners, ...attributes })}
      >
        <p className="truncate text-xs font-semibold text-dc-text">{slot.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-dc-muted">
          {dur != null ? <span>{dur} min</span> : null}
          {tr ? <span>{tr}</span> : null}
          {!slot.isPublished ? <span className="text-dc-warning">Draft</span> : <span className="text-emerald-400">Published</span>}
        </div>
      </div>
      <ProgramSessionEditButton
        slotTitle={slot.title}
        scheduledItemLabel={scheduledItemLabel}
        compact
        className="absolute right-1 top-1"
        onClick={() => onOpenDrawer(slot)}
      />
    </div>
  )
}

export function ProgramSlotDragOverlay({ slot, tz }: { slot: ProgramSlotRow; tz: string }) {
  const tr = displayTrack(slot)
  const visual = slotCardVisual({ trackColorHex: slot.trackColor, trackName: tr })
  const timeLabel =
    slot.startsAt && slot.endsAt
      ? `${formatTimeLabel(slot.startsAt, tz)} – ${formatTimeLabel(slot.endsAt, tz)}`
      : 'Unscheduled'

  return (
    <div
      className={cn('pointer-events-none w-44 rounded-lg px-2 py-1.5 shadow-xl', visual.className)}
      style={visual.style}
    >
      <p className="truncate text-xs font-semibold text-dc-text">{slot.title}</p>
      <p className="text-[10px] text-dc-muted">{timeLabel}</p>
    </div>
  )
}
