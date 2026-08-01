import { useEffect, useMemo, useRef, useState } from 'react'
import {
  exclusiveEndOfZonedCalendarDayMs,
  formatHourTickLabel,
  formatTime,
  utcMillisAtZonedWallClock,
  zonedCalendarDateFromUtc,
} from '@/components/dancecard/time'
import { compareSlot } from '@/components/conventions/compare/compareColors'
import {
  gapsToMs,
  intervalFullyInsideAnyUnion,
  intervalOverlapsAnyUnion,
  mergeMsIntervals,
} from '@/components/conventions/compare/intervalHelpers'

const STEP_MS = 30 * 60 * 1000
const DISPLAY_SLOT_COUNT = 48
/** Wide enough that a phone viewport always needs horizontal scroll for 24h */
const HOUR_COL_MIN_PX = 52

type SlotKind = 'outside' | 'mutual' | 'hostOnly' | 'busy' | 'selected'

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export default function MutualAvailabilityStrip(props: {
  dayLabel: string
  rangeStartMs: number
  freeGaps: { startsAt: string; endsAt: string }[]
  hostFreeGaps: { startsAt: string; endsAt: string }[]
  tz: string
  mode: 'mutual' | 'host'
  /** Soft emphasis when opened from a day summary card. */
  highlighted?: boolean
  onFreeStepClick?: (startMs: number, endMs: number) => void
  activeWindowStartMs?: number
  activeWindowEndMs?: number
  selectedStartMs?: number | null
  selectedEndMs?: number | null
}) {
  const {
    dayLabel,
    rangeStartMs,
    freeGaps,
    hostFreeGaps,
    tz,
    mode,
    highlighted = false,
    onFreeStepClick,
    activeWindowStartMs,
    activeWindowEndMs,
    selectedStartMs,
    selectedEndMs,
  } = props

  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const mergedFree = useMemo(() => mergeMsIntervals(gapsToMs(freeGaps)), [freeGaps])
  const mergedHostFree = useMemo(() => mergeMsIntervals(gapsToMs(hostFreeGaps)), [hostFreeGaps])
  const calendarYmd = useMemo(() => zonedCalendarDateFromUtc(rangeStartMs, tz), [rangeStartMs, tz])

  const slots = useMemo(() => {
    const dayEnd = exclusiveEndOfZonedCalendarDayMs(tz, calendarYmd)
    const row: { startMs: number; endMs: number; kind: SlotKind }[] = []

    for (let i = 0; i < DISPLAY_SLOT_COUNT; i++) {
      const hour = Math.floor(i / 2)
      const minute = (i % 2) * 30
      let startMs = utcMillisAtZonedWallClock(tz, calendarYmd, hour, minute)
      if (startMs == null) {
        startMs = i > 0 ? row[i - 1]!.endMs : rangeStartMs
      }
      let endMs: number
      if (i === DISPLAY_SLOT_COUNT - 1) {
        endMs = dayEnd
      } else {
        const h2 = Math.floor((i + 1) / 2)
        const min2 = ((i + 1) % 2) * 30
        endMs = utcMillisAtZonedWallClock(tz, calendarYmd, h2, min2) ?? startMs + STEP_MS
      }
      if (!(endMs > startMs)) endMs = startMs + STEP_MS

      const inPlayableWindow =
        activeWindowStartMs == null ||
        activeWindowEndMs == null ||
        (startMs >= activeWindowStartMs && endMs <= activeWindowEndMs)

      const selected =
        selectedStartMs != null &&
        selectedEndMs != null &&
        selectedEndMs > selectedStartMs &&
        startMs < selectedEndMs &&
        endMs > selectedStartMs

      let kind: SlotKind
      if (!inPlayableWindow) {
        kind = 'outside'
      } else if (selected) {
        kind = 'selected'
      } else if (mode === 'mutual') {
        const mutual = intervalFullyInsideAnyUnion(startMs, endMs, mergedFree)
        const hostFree = intervalOverlapsAnyUnion(startMs, endMs, mergedHostFree)
        if (mutual) kind = 'mutual'
        else if (hostFree) kind = 'hostOnly'
        else kind = 'busy'
      } else {
        kind = intervalFullyInsideAnyUnion(startMs, endMs, mergedHostFree) ? 'mutual' : 'busy'
      }

      row.push({ startMs, endMs, kind })
    }
    return row
  }, [
    activeWindowEndMs,
    activeWindowStartMs,
    calendarYmd,
    mergedFree,
    mergedHostFree,
    mode,
    rangeStartMs,
    selectedEndMs,
    selectedStartMs,
    tz,
  ])

  const interactive = Boolean(onFreeStepClick)
  const hourColumns = useMemo(() => {
    const cols: { hour: number; slots: typeof slots }[] = []
    for (let h = 0; h < 24; h++) {
      cols.push({ hour: h, slots: slots.slice(h * 2, h * 2 + 2) })
    }
    return cols
  }, [slots])

  /** First hour worth showing: selection, mutual free, or play-window start. */
  const focusHourIndex = useMemo(() => {
    if (selectedStartMs != null) {
      const idx = slots.findIndex((s) => selectedStartMs >= s.startMs && selectedStartMs < s.endMs)
      if (idx >= 0) return Math.floor(idx / 2)
    }
    const mutualIdx = slots.findIndex((s) => s.kind === 'mutual' || s.kind === 'selected')
    if (mutualIdx >= 0) return Math.max(0, Math.floor(mutualIdx / 2) - 1)
    const inWindowIdx = slots.findIndex((s) => s.kind !== 'outside')
    if (inWindowIdx >= 0) return Math.max(0, Math.floor(inWindowIdx / 2) - 1)
    return 0
  }, [selectedStartMs, slots])

  function updateScrollEdges() {
    const el = scrollRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(max > 4 && el.scrollLeft < max - 4)
  }

  function scrollByHours(deltaHours: number) {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: deltaHours * HOUR_COL_MIN_PX, behavior: 'smooth' })
  }

  function scrollToHour(hour: number) {
    const el = scrollRef.current
    if (!el) return
    const max = Math.max(0, el.scrollWidth - el.clientWidth)
    const left = Math.min(max, Math.max(0, hour * HOUR_COL_MIN_PX))
    el.scrollTo({ left, behavior: 'smooth' })
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // Jump first so Friday doesn’t open parked on midnight outside the window
    const max = Math.max(0, el.scrollWidth - el.clientWidth)
    el.scrollLeft = Math.min(max, Math.max(0, focusHourIndex * HOUR_COL_MIN_PX))
    updateScrollEdges()
    const onScroll = () => updateScrollEdges()
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => updateScrollEdges()) : null
    ro?.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro?.disconnect()
    }
    // Re-aim when day highlight / selection / window changes
  }, [focusHourIndex, highlighted, dayLabel])

  function slotClass(kind: SlotKind): string {
    switch (kind) {
      case 'outside':
        return compareSlot.outsideWindow
      case 'mutual':
        return compareSlot.mutualFree
      case 'hostOnly':
        return compareSlot.hostFreeOnly
      case 'busy':
        return compareSlot.busy
      case 'selected':
        return compareSlot.selectedGap
      default:
        return compareSlot.busy
    }
  }

  const trackWidth = 24 * HOUR_COL_MIN_PX

  return (
    <div
      className={cx(
        'rounded-xl border bg-dc-surface-muted/95 p-2 sm:p-2.5 transition',
        highlighted ? 'border-dc-accent/55 ring-1 ring-dc-accent/25' : 'border-dc-border',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-dc-text">{dayLabel}</div>
          <p className="mt-0.5 text-[11px] leading-snug text-dc-muted sm:hidden">
            Swipe the timeline · or use arrows
          </p>
          <p className="mt-0.5 hidden text-[11px] leading-snug text-dc-muted sm:block">
            {mode === 'mutual' ? 'Green = both free · Blue = host free only' : 'Green = host free'}
            {interactive ? ' · tap green to set start' : null}
            {' · Rose = busy · Charcoal = outside window'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`Scroll ${dayLabel} earlier`}
            disabled={!canScrollLeft}
            onClick={() => scrollByHours(-3)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-dc-border bg-dc-elevated text-dc-text disabled:opacity-35"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={`Scroll ${dayLabel} later`}
            disabled={!canScrollRight}
            onClick={() => scrollByHours(3)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-dc-border bg-dc-elevated text-dc-text disabled:opacity-35"
          >
            ›
          </button>
        </div>
      </div>

      <div className="relative mt-1.5">
        <div
          ref={scrollRef}
          className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] [touch-action:pan-x] [scrollbar-width:thin]"
          onScroll={updateScrollEdges}
        >
          {/* One track so hour labels + slots scroll together */}
          <div style={{ width: trackWidth, minWidth: trackWidth }}>
            <div
              className="grid text-[10px] font-medium uppercase tracking-[0.1em] text-dc-muted"
              style={{ gridTemplateColumns: `repeat(24, ${HOUR_COL_MIN_PX}px)` }}
              aria-hidden
            >
              {hourColumns.map(({ hour }) => (
                <div
                  key={hour}
                  className="border-l border-dc-border pl-1 first:border-l-0 first:pl-0"
                >
                  {formatHourTickLabel(hour)}
                </div>
              ))}
            </div>

            <div
              className="relative z-0 mt-1 grid gap-0 rounded-lg border border-dc-border bg-dc-surface/80"
              style={{ gridTemplateColumns: `repeat(24, ${HOUR_COL_MIN_PX}px)` }}
              role={interactive ? 'group' : 'img'}
              aria-label={`Availability for ${dayLabel}`}
            >
              {hourColumns.map(({ hour, slots: pair }) => (
                <div
                  key={hour}
                  className="flex min-h-12 w-full gap-px border-l border-dc-border first:border-l-0 sm:min-h-11"
                >
                  {pair.map((slot, j) => {
                    const rangeLabel = `${formatTime(new Date(slot.startMs).toISOString(), tz)} – ${formatTime(new Date(slot.endMs).toISOString(), tz)}`
                    const canReserve = slot.kind === 'mutual' && interactive
                    if (canReserve) {
                      return (
                        <button
                          key={`${hour}-${j}`}
                          type="button"
                          title={`Reserve ${rangeLabel}`}
                          aria-label={`Reserve mutual free time ${rangeLabel}`}
                          onClick={() => onFreeStepClick!(slot.startMs, slot.endMs)}
                          className={cx(
                            'relative z-[1] min-h-12 min-w-0 flex-1 cursor-pointer touch-manipulation rounded-sm transition sm:min-h-11',
                            compareSlot.mutualFree,
                            compareSlot.mutualFreeHover,
                          )}
                        />
                      )
                    }
                    return (
                      <div
                        key={`${hour}-${j}`}
                        title={rangeLabel}
                        className={cx(
                          'min-h-12 min-w-0 flex-1 rounded-sm sm:min-h-11',
                          slotClass(slot.kind),
                        )}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {canScrollLeft ?
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-dc-surface-muted to-transparent sm:hidden"
            aria-hidden
          />
        : null}
        {canScrollRight ?
          <button
            type="button"
            onClick={() => scrollByHours(4)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center bg-gradient-to-l from-dc-surface-muted via-dc-surface-muted/90 to-transparent text-xs font-semibold text-dc-accent-hover sm:pointer-events-none sm:text-transparent"
            aria-label={`Show later hours on ${dayLabel}`}
          >
            <span className="sm:hidden">→</span>
          </button>
        : null}
      </div>

      {focusHourIndex > 0 ?
        <button
          type="button"
          className="mt-1.5 text-[11px] font-medium text-dc-accent-hover underline-offset-2 hover:underline sm:hidden"
          onClick={() => scrollToHour(focusHourIndex)}
        >
          Jump to open hours
        </button>
      : null}
    </div>
  )
}
