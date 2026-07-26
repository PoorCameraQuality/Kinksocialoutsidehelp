'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  boardRowDragId,
  boardSlotDropId,
  dutyDragId,
  libRowDropId,
  locDragId,
  staffDragId,
} from '@/components/dancecard/organizer/scheduleImportDndIds'

export function ImportDroppableCell({
  id,
  className,
  children,
}: {
  id: string
  className: string
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={className + (isOver ? ' ring-1 ring-dc-accent-border' : '')}>
      {children}
    </div>
  )
}

export function ImportDraggableStaffChip({
  name,
  readOnly,
  className,
  children,
}: {
  name: string
  readOnly?: boolean
  className: string
  children: ReactNode
}) {
  const id = staffDragId(name)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled: readOnly })
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.75 : 1,
    touchAction: 'none',
  }
  return (
    <button type="button" ref={setNodeRef} style={style} className={className} {...listeners} {...attributes}>
      {children}
    </button>
  )
}

export function ImportDraggableDutyChip({
  dutyId,
  readOnly,
  className,
  children,
}: {
  dutyId: string
  readOnly?: boolean
  className: string
  children: ReactNode
}) {
  const id = dutyDragId(dutyId)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled: readOnly })
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.75 : 1,
    touchAction: 'none',
  }
  return (
    <button type="button" ref={setNodeRef} style={style} className={className} {...listeners} {...attributes}>
      {children}
    </button>
  )
}

export function ImportDraggableLocationChip({
  locationName,
  readOnly,
  className,
  children,
}: {
  locationName: string
  readOnly?: boolean
  className: string
  children: ReactNode
}) {
  const id = locDragId(locationName)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled: readOnly })
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.75 : 1,
    touchAction: 'none',
  }
  return (
    <button type="button" ref={setNodeRef} style={style} className={className} {...listeners} {...attributes}>
      {children}
    </button>
  )
}

export function ImportSortableLibraryCard({
  rowId,
  readOnly,
  className,
  onClick,
  children,
}: {
  rowId: string
  readOnly?: boolean
  className: string
  onClick: () => void
  children: ReactNode
}) {
  const sort = useSortable({ id: rowId, disabled: readOnly })
  const drop = useDroppable({ id: libRowDropId(rowId) })
  const setRef = (node: HTMLElement | null) => {
    sort.setNodeRef(node)
    drop.setNodeRef(node)
  }
  const style: CSSProperties = {
    transform: CSS.Transform.toString(sort.transform),
    transition: sort.transition,
    opacity: sort.isDragging ? 0.75 : 1,
    touchAction: 'none',
  }
  return (
    <button type="button" ref={setRef} style={style} className={className} onClick={onClick} {...sort.attributes} {...sort.listeners}>
      {children}
    </button>
  )
}

export function ImportBoardSlotDropTarget({
  rowId,
  className,
  children,
}: {
  rowId: string
  className?: string
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: boardSlotDropId(rowId) })
  return (
    <div ref={setNodeRef} className={(className ?? '') + (isOver ? ' ring-1 ring-amber-200/40 rounded-lg' : '')}>
      {children}
    </div>
  )
}

export function ImportDraggableBoardSlot({
  rowId,
  readOnly,
  className,
  onClick,
  children,
}: {
  rowId: string
  readOnly?: boolean
  className: string
  onClick: () => void
  children: ReactNode
}) {
  const id = boardRowDragId(rowId)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled: readOnly })
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.75 : 1,
    touchAction: 'none',
  }
  return (
    <button type="button" ref={setNodeRef} style={style} className={className} onClick={onClick} {...listeners} {...attributes}>
      {children}
    </button>
  )
}
