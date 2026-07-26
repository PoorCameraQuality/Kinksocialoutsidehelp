'use client'

import { useCallback, useRef, useState, type ReactNode } from 'react'

function clampZoom(z: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(z * 100) / 100))
}

export function VenueMapViewport({
  zoom: controlledZoom,
  onZoomChange,
  minZoom = 1,
  maxZoom = 4,
  className = '',
  children,
}: {
  zoom?: number
  onZoomChange?: (z: number) => void
  minZoom?: number
  maxZoom?: number
  className?: string
  children: ReactNode
}) {
  const [internalZoom, setInternalZoom] = useState(1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const zoom = controlledZoom ?? internalZoom
  const setZoom = useCallback(
    (next: number | ((z: number) => number)) => {
      const resolved = typeof next === 'function' ? next(zoom) : next
      const clamped = clampZoom(resolved, minZoom, maxZoom)
      if (onZoomChange) onZoomChange(clamped)
      else setInternalZoom(clamped)
    },
    [minZoom, maxZoom, onZoomChange, zoom],
  )

  const bump = (delta: number) => setZoom((z) => clampZoom(z + delta, minZoom, maxZoom))

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg border border-dc-border px-3 py-1.5 text-dc-micro text-dc-muted hover:border-dc-accent-border hover:text-dc-text"
          onClick={() => bump(-0.25)}
        >
          Zoom out
        </button>
        <button
          type="button"
          className="rounded-lg border border-dc-border px-3 py-1.5 text-dc-micro text-dc-muted hover:border-dc-accent-border hover:text-dc-text"
          onClick={() => bump(0.25)}
        >
          Zoom in
        </button>
        <button
          type="button"
          className="rounded-lg border border-dc-border px-2 py-1.5 text-dc-micro text-dc-muted hover:text-dc-text"
          onClick={() => setZoom(1)}
        >
          Reset
        </button>
        <span className="text-dc-micro text-dc-muted">{Math.round(zoom * 100)}%</span>
      </div>
      <div
        ref={scrollRef}
        className="relative mt-2 max-h-[min(70vh,640px)] overflow-auto rounded-xl border border-dc-border bg-dc-surface-muted"
        onWheel={(e) => {
          if (!e.ctrlKey && !e.metaKey) return
          e.preventDefault()
          bump(e.deltaY > 0 ? -0.15 : 0.15)
        }}
      >
        <div className="inline-block min-w-full" style={{ width: `${zoom * 100}%` }}>
          {children}
        </div>
      </div>
    </div>
  )
}
