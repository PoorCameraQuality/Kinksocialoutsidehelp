'use client'

import { useCallback, useRef, useState } from 'react'
import { MapZoneOverlay } from '@/components/dancecard/venue/MapZoneOverlay'
import { VenueMapViewport } from '@/components/dancecard/venue/VenueMapViewport'
import { mapPinDisplayName } from '@/lib/dancecard/mapPinLabels'
import { normalizeMapZonePin, type MapZonePin } from '@/lib/dancecard/mapPinZones'

export type VenueMapPin = MapZonePin

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n))
}

/** Only show zones that have been placed away from the default center (or are being edited). */
function pinIsPlaced(pin: MapZonePin, editingLocationId: string | null) {
  if (editingLocationId === pin.locationId) return true
  return pin.x !== 0.5 || pin.y !== 0.5
}

export function VenueMapCanvas({
  imageUrl,
  alt,
  pins,
  locationNames,
  readOnly = false,
  mode,
  dropHighlightLocationId = null,
  onDropOnLocation,
  onPinMove,
  onPinResize,
  onPinRotate,
  editingLocationId = null,
  onMapClickPlace,
  showZoom = true,
}: {
  imageUrl: string
  alt: string
  pins: VenueMapPin[]
  locationNames: Record<string, string>
  readOnly?: boolean
  mode: 'drop' | 'edit'
  dropHighlightLocationId?: string | null
  onDropOnLocation?: (locationId: string, slotId: string) => void
  onPinMove?: (locationId: string, x: number, y: number) => void
  onPinResize?: (locationId: string, width: number, height: number) => void
  onPinRotate?: (locationId: string, rotation: number) => void
  editingLocationId?: string | null
  onMapClickPlace?: (locationId: string, x: number, y: number) => void
  showZoom?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragOverLoc, setDragOverLoc] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)

  const coordsFromClient = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    }
  }, [])

  function handleMapClick(e: React.MouseEvent) {
    if (mode !== 'edit' || readOnly || !editingLocationId || !onMapClickPlace) return
    if ((e.target as HTMLElement).closest('[data-map-zone]')) return
    const c = coordsFromClient(e.clientX, e.clientY)
    if (!c) return
    onMapClickPlace(editingLocationId, c.x, c.y)
  }

  const visiblePins = pins.filter((p) => pinIsPlaced(p, editingLocationId))

  const mapInner = (
    <div
      ref={containerRef}
      className="relative overflow-visible"
      onClick={handleMapClick}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={alt} className="block w-full select-none" draggable={false} />
      {visiblePins.map((raw) => {
        const pin = normalizeMapZonePin(raw)
        const name = mapPinDisplayName(pin, locationNames)
        const isDrop = mode === 'drop'
        const highlighted =
          isDrop && (dragOverLoc === pin.locationId || dropHighlightLocationId === pin.locationId)
        const focused = editingLocationId === pin.locationId

        if (isDrop) {
          return (
            <MapZoneOverlay
              key={pin.locationId}
              pin={pin}
              displayName={name}
              variant="drop"
              focused={focused}
              highlighted={highlighted}
              className={readOnly ? 'pointer-events-none opacity-60' : undefined}
              data-map-zone
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setDragOverLoc(pin.locationId)
              }}
              onDragLeave={() => setDragOverLoc((id) => (id === pin.locationId ? null : id))}
              onDrop={(e) => {
                e.preventDefault()
                setDragOverLoc(null)
                const sid = e.dataTransfer.getData('text/slot-id')
                if (!sid || readOnly) return
                onDropOnLocation?.(pin.locationId, sid)
              }}
            />
          )
        }

        const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
          if (readOnly) return
          e.preventDefault()
          e.stopPropagation()
          // Preserve grab offset so the pin doesn't snap its centre to the cursor.
          const start = coordsFromClient(e.clientX, e.clientY)
          const offsetX = start ? start.x - pin.x : 0
          const offsetY = start ? start.y - pin.y : 0
          const onMove = (ev: PointerEvent) => {
            const c = coordsFromClient(ev.clientX, ev.clientY)
            if (c) onPinMove?.(pin.locationId, clamp01(c.x - offsetX), clamp01(c.y - offsetY))
          }
          const onUp = () => {
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
          }
          window.addEventListener('pointermove', onMove)
          window.addEventListener('pointerup', onUp)
        }

        const startResize = (
          corner: 'tl' | 'tr' | 'br' | 'bl',
          e: React.PointerEvent<HTMLDivElement>,
        ) => {
          if (readOnly) return
          const el = containerRef.current
          if (!el) return
          const rect = el.getBoundingClientRect()
          const startW = pin.width ?? 0.12
          const startH = pin.height ?? 0.12
          const startX = e.clientX
          const startY = e.clientY
          const signX = corner === 'tr' || corner === 'br' ? 1 : -1
          const signY = corner === 'br' || corner === 'bl' ? 1 : -1
          // Inverse-rotate the cursor delta so dragging always grows the box
          // along its own axes even when the zone is rotated.
          const theta = -((pin.rotation ?? 0) * Math.PI) / 180
          const cos = Math.cos(theta)
          const sin = Math.sin(theta)
          const onMove = (ev: PointerEvent) => {
            const rawDx = (ev.clientX - startX) / rect.width
            const rawDy = (ev.clientY - startY) / rect.height
            const localDx = rawDx * cos - rawDy * sin
            const localDy = rawDx * sin + rawDy * cos
            const w = Math.max(0.04, Math.min(0.75, startW + localDx * signX * 2))
            const h = Math.max(0.04, Math.min(0.75, startH + localDy * signY * 2))
            onPinResize?.(pin.locationId, w, h)
          }
          const onUp = () => {
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
          }
          window.addEventListener('pointermove', onMove)
          window.addEventListener('pointerup', onUp)
        }

        const startRotate = (_e: React.PointerEvent<HTMLDivElement>) => {
          if (readOnly) return
          const el = containerRef.current
          if (!el) return
          const rect = el.getBoundingClientRect()
          const cx = rect.left + pin.x * rect.width
          const cy = rect.top + pin.y * rect.height
          const onMove = (ev: PointerEvent) => {
            const angleRad = Math.atan2(ev.clientY - cy, ev.clientX - cx)
            // Handle sits above the centre, so 0° rotation == pointer due north.
            let deg = angleRad * (180 / Math.PI) + 90
            if (deg > 180) deg -= 360
            if (deg < -180) deg += 360
            onPinRotate?.(pin.locationId, Math.round(deg))
          }
          const onUp = () => {
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
          }
          window.addEventListener('pointermove', onMove)
          window.addEventListener('pointerup', onUp)
        }

        return (
          <div key={pin.locationId} data-map-zone>
            <MapZoneOverlay
              pin={pin}
              displayName={name}
              variant="edit"
              focused={focused}
              className={readOnly ? 'cursor-default opacity-70' : undefined}
              onPointerDown={startDrag}
              onResizeStart={startResize}
              onRotateStart={startRotate}
            />
          </div>
        )
      })}
    </div>
  )

  if (!showZoom) {
    return (
      <div className="overflow-hidden rounded-xl border border-dc-border bg-dc-surface-muted">
        {mapInner}
      </div>
    )
  }

  return <VenueMapViewport zoom={zoom} onZoomChange={setZoom} className="min-w-0">{mapInner}</VenueMapViewport>
}
