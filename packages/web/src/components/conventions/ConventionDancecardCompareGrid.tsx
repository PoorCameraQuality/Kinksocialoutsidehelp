import { useMemo, type MouseEvent } from 'react'
import {
  PX_PER_HOUR,
  buildDayColumns,
  buildMutualFreeMillis,
  intersectRange,
  type CalItem,
  type DayColumn,
  type FreeGap,
  viewerExpandedBusy,
} from '@/components/conventions/convention-dancecard-compare-utils'

type Props = {
  hostFreeGaps: FreeGap[]
  conventionStartsAt?: string
  conventionEndsAt?: string
  timezone: string
  viewerCal: { items: CalItem[]; bufferMinutes: number } | null
  viewerCalStatus: 'idle' | 'loading' | 'ready' | 'signed_out' | 'blocked'
  onMutualSlotClick?: (e: MouseEvent<HTMLButtonElement>, startMs: number, endMs: number) => void
  compact?: boolean
  /** When false, mutual blocks are display-only (hub compare). Default true when onMutualSlotClick is set. */
  interactiveMutual?: boolean
}

export default function ConventionDancecardCompareGrid({
  hostFreeGaps,
  conventionStartsAt,
  conventionEndsAt,
  timezone: tz,
  viewerCal,
  viewerCalStatus,
  onMutualSlotClick,
  compact = false,
  interactiveMutual,
}: Props) {
  const mutualInteractive = interactiveMutual ?? Boolean(onMutualSlotClick)
  const convBounds = useMemo(() => {
    if (conventionStartsAt && conventionEndsAt) {
      return { start: new Date(conventionStartsAt), end: new Date(conventionEndsAt) }
    }
    if (hostFreeGaps.length > 0) {
      let minT = Infinity
      let maxT = -Infinity
      for (const g of hostFreeGaps) {
        minT = Math.min(minT, new Date(g.startsAt).getTime())
        maxT = Math.max(maxT, new Date(g.endsAt).getTime())
      }
      return { start: new Date(minT), end: new Date(maxT) }
    }
    return null
  }, [conventionStartsAt, conventionEndsAt, hostFreeGaps])

  const dayColumns = useMemo(() => {
    if (!convBounds) return [] as DayColumn[]
    return buildDayColumns(convBounds.start, convBounds.end, tz)
  }, [convBounds, tz])

  const viewerBusyExpanded = useMemo(() => {
    if (!convBounds || !viewerCal || viewerCalStatus !== 'ready') return [] as { s: number; e: number }[]
    return viewerExpandedBusy(
      viewerCal.items,
      viewerCal.bufferMinutes,
      convBounds.start.getTime(),
      convBounds.end.getTime(),
    )
  }, [convBounds, viewerCal, viewerCalStatus])

  const mutualFreeMillis = useMemo(() => {
    if (viewerCalStatus === 'idle' || viewerCalStatus === 'loading') return [] as { s: number; e: number }[]
    return buildMutualFreeMillis(hostFreeGaps, viewerBusyExpanded)
  }, [hostFreeGaps, viewerBusyExpanded, viewerCalStatus])

  if (hostFreeGaps.length === 0) {
    return (
      <p className="text-sm text-amber-200">
        There are no bookable free windows in this range (gaps may be shorter than 15 minutes).
      </p>
    )
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className={`flex flex-wrap gap-3 text-xs text-dc-text-muted ${compact ? '' : 'mt-1'}`}>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-5 rounded-sm bg-emerald-900/50 ring-1 ring-emerald-700/50" /> Host free
        </span>
        {viewerCalStatus === 'ready' ?
          <>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-3 w-5 rounded-sm bg-red-600/50 ring-1 ring-red-400/40" /> Your calendar
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-3 w-5 rounded-sm bg-emerald-400 ring-1 ring-emerald-200/60" /> Mutual free
            </span>
          </>
        : null}
      </div>

      <div className={`overflow-x-auto pb-2 ${compact ? 'max-h-[min(20rem,38vh)]' : ''}`}>
        <div className="flex min-w-max gap-2 sm:gap-3">
          {dayColumns.map((day) => {
            const colMs = day.colEnd.getTime() - day.colStart.getTime()
            const hours = colMs / (60 * 60 * 1000)
            const colHeight = Math.max(hours * PX_PER_HOUR, compact ? 96 : 120)
            const hourTicks = Math.max(1, Math.ceil(hours))
            return (
              <div key={day.ymdKey} className={compact ? 'w-32 shrink-0 sm:w-36' : 'w-36 shrink-0 sm:w-44'}>
                <div className="mb-1 text-center text-xs font-semibold text-dc-text">{day.label}</div>
                <div
                  className="relative rounded-lg border border-dc-border bg-zinc-900/80"
                  style={{ height: colHeight }}
                >
                  {hostFreeGaps.map((g, gi) => {
                    const gs = new Date(g.startsAt).getTime()
                    const ge = new Date(g.endsAt).getTime()
                    const hit = intersectRange(gs, ge, day.colStart.getTime(), day.colEnd.getTime())
                    if (!hit) return null
                    const top = ((hit.s - day.colStart.getTime()) / colMs) * colHeight
                    const h = ((hit.e - hit.s) / colMs) * colHeight
                    return (
                      <div
                        key={`host-${g.startsAt}-${gi}`}
                        className="pointer-events-none absolute left-1 right-1 z-[2] rounded-md bg-emerald-950/38 ring-1 ring-emerald-800/35"
                        style={{ top, height: Math.max(h, 4) }}
                        title="Host is free here"
                      />
                    )
                  })}
                  {viewerBusyExpanded.map((b, bi) => {
                    const hit = intersectRange(b.s, b.e, day.colStart.getTime(), day.colEnd.getTime())
                    if (!hit) return null
                    const top = ((hit.s - day.colStart.getTime()) / colMs) * colHeight
                    const h = ((hit.e - hit.s) / colMs) * colHeight
                    return (
                      <div
                        key={`you-${hit.s}-${bi}`}
                        className="pointer-events-none absolute left-1 right-1 z-[8] rounded-md border-2 border-red-300/55 bg-red-600/48"
                        style={{ top, height: Math.max(h, 4) }}
                        title="You are busy here"
                      />
                    )
                  })}
                  {mutualFreeMillis.map((m, mi) => {
                    const hit = intersectRange(m.s, m.e, day.colStart.getTime(), day.colEnd.getTime())
                    if (!hit) return null
                    const top = ((hit.s - day.colStart.getTime()) / colMs) * colHeight
                    const h = ((hit.e - hit.s) / colMs) * colHeight
                    if (mutualInteractive && onMutualSlotClick) {
                      return (
                        <button
                          key={`mutual-${m.s}-${mi}`}
                          type="button"
                          data-mutual-slot
                          title="You and the host are both free. Click to request this time"
                          onClick={(ev) => onMutualSlotClick(ev, hit.s, hit.e)}
                          className="absolute left-1 right-1 z-[20] cursor-pointer rounded-md border-2 border-emerald-200/70 bg-emerald-400/50 text-left shadow-md backdrop-blur-[1px] transition hover:bg-emerald-300/75 hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-emerald-100/80"
                          style={{ top, height: Math.max(h, 8) }}
                        />
                      )
                    }
                    return (
                      <div
                        key={`mutual-${m.s}-${mi}`}
                        className="pointer-events-none absolute left-1 right-1 z-[20] rounded-md border-2 border-emerald-200/70 bg-emerald-400/50"
                        style={{ top, height: Math.max(h, 8) }}
                        title="Mutual free time"
                      />
                    )
                  })}
                  {Array.from({ length: hourTicks + 1 }).map((_, h) => (
                    <div
                      key={h}
                      className="pointer-events-none absolute left-0 right-0 z-[25] border-t border-white/25 pl-1 text-[10px] font-medium tabular-nums text-zinc-100/95"
                      style={{ top: Math.min((h / hours) * colHeight, colHeight) }}
                    >
                      {new Intl.DateTimeFormat(undefined, {
                        timeZone: tz,
                        hour: 'numeric',
                        minute: '2-digit',
                      }).format(new Date(day.colStart.getTime() + h * 60 * 60 * 1000))}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
