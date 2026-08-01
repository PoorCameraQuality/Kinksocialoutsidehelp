'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

function clampZoom(z: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(z * 100) / 100))
}

/**
 * Pan/zoom shell for venue map images.
 * At 100% the frame hugs the image (no letterbox). Zoomed-in uses a capped scrollport.
 */
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
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const fitted = zoom <= 1.001

  const applyZoom = useCallback(
    (next: number) => {
      const clamped = clampZoom(next, minZoom, maxZoom)
      if (onZoomChange) onZoomChange(clamped)
      else setInternalZoom(clamped)
      return clamped
    },
    [minZoom, maxZoom, onZoomChange],
  )

  const bump = useCallback(
    (delta: number) => {
      const el = scrollRef.current
      const prev = zoomRef.current
      const next = clampZoom(prev + delta, minZoom, maxZoom)
      if (next === prev) return

      if (el) {
        const { scrollLeft, scrollTop, clientWidth, clientHeight } = el
        const cx = scrollLeft + clientWidth / 2
        const cy = scrollTop + clientHeight / 2
        applyZoom(next)
        requestAnimationFrame(() => {
          const node = scrollRef.current
          if (!node) return
          const scale = next / prev
          node.scrollLeft = Math.max(0, cx * scale - clientWidth / 2)
          node.scrollTop = Math.max(0, cy * scale - clientHeight / 2)
        })
        return
      }
      applyZoom(next)
    },
    [applyZoom, minZoom, maxZoom],
  )

  // Non-passive wheel so Ctrl/⌘+wheel zooms the map instead of the browser page.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      bump(e.deltaY > 0 ? -0.15 : 0.15)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [bump])

  return (
    <div className={`relative isolate ${fitted ? '' : 'overflow-hidden'} ${className}`.trim()}>
      <div
        ref={scrollRef}
        className={
          fitted ?
            'relative w-full overflow-hidden rounded-xl border border-dc-border bg-dc-surface-muted'
          : 'relative max-h-[min(70vh,640px)] w-full overflow-auto overscroll-contain rounded-xl border border-dc-border bg-dc-surface-muted [touch-action:pan-x_pan-y]'
        }
      >
        <div
          className="block leading-none"
          style={
            fitted ?
              { width: '100%' }
            : {
                width: `${zoom * 100}%`,
                minWidth: `${zoom * 100}%`,
              }
          }
        >
          <div className="block w-full leading-none [&_img]:!m-0 [&_img]:block [&_img]:h-auto [&_img]:!max-w-none [&_img]:w-full">
            {children}
          </div>
        </div>
      </div>

      <div
        className={
          fitted ?
            'mt-2 flex justify-end'
          : 'pointer-events-none absolute bottom-3 right-3 z-10 sm:bottom-4 sm:right-4'
        }
      >
        <div
          className={`flex overflow-hidden rounded-xl border border-dc-border bg-dc-elevated shadow-[var(--dc-shadow-soft)] ${
            fitted ? '' : 'pointer-events-auto'
          }`}
        >
          <button
            type="button"
            aria-label="Zoom out"
            disabled={zoom <= minZoom}
            className="inline-flex min-h-11 min-w-11 items-center justify-center text-lg font-medium text-dc-text hover:bg-dc-accent-muted disabled:opacity-40"
            onClick={() => bump(-0.25)}
          >
            −
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            disabled={zoom >= maxZoom}
            className="inline-flex min-h-11 min-w-11 items-center justify-center border-l border-dc-border text-lg font-medium text-dc-text hover:bg-dc-accent-muted disabled:opacity-40"
            onClick={() => bump(0.25)}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Reset zoom"
            className="inline-flex min-h-11 items-center justify-center border-l border-dc-border px-2.5 text-[10px] font-semibold uppercase tracking-wide text-dc-text hover:bg-dc-accent-muted"
            onClick={() => {
              applyZoom(1)
              const el = scrollRef.current
              if (el) {
                el.scrollLeft = 0
                el.scrollTop = 0
              }
            }}
          >
            {Math.round(zoom * 100)}%
          </button>
        </div>
      </div>
    </div>
  )
}
