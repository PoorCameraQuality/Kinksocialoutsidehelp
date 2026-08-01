import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildDayColumns } from '@/components/conventions/convention-dancecard-compare-utils'
import { formatDuration } from '@/components/conventions/compare/bestOpenWindows'
import CompareLegend from '@/components/conventions/compare/CompareLegend'
import CompareProfileCard, { type CompareProfile } from '@/components/conventions/compare/CompareProfileCard'
import { dayAvailabilitySummaries } from '@/components/conventions/compare/dayAvailabilitySummaries'
import {
  gapsToMs,
  intervalFullyInsideAnyUnion,
  mergeMsIntervals,
} from '@/components/conventions/compare/intervalHelpers'
import MutualAvailabilityStrip from '@/components/conventions/compare/MutualAvailabilityStrip'
import { formatTime } from '@/components/dancecard/time'
import { dancecardSharePublicPath, type DancecardApiScope } from '@/lib/dancecard/dancecardApiScope'
import MobileActionBar from '@/components/shell/MobileActionBar'

type FreeGap = { startsAt: string; endsAt: string }

const RESERVE_LENGTHS = [
  { ms: 30 * 60_000, label: '30 min', short: '½ hr' },
  { ms: 60 * 60_000, label: '1 hour', short: '1 hr' },
  { ms: 90 * 60_000, label: '1½ hours', short: '1½ hr' },
] as const

function cx(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(' ')
}

export default function PlaySpaceCompareBoard({
  scope,
  shareToken,
  timezone,
  hostFreeGaps,
  mutualFreeGaps,
  windowStartsAt,
  windowEndsAt,
  viewerProfile,
  hostProfile,
  hasViewerCalendar,
}: {
  scope: DancecardApiScope
  shareToken: string | null
  timezone: string
  hostFreeGaps: FreeGap[]
  mutualFreeGaps: FreeGap[]
  windowStartsAt?: string
  windowEndsAt?: string
  viewerProfile: CompareProfile | null
  hostProfile: CompareProfile | null
  hasViewerCalendar: boolean
}) {
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null)
  const [focusDayKey, setFocusDayKey] = useState<string | null>(null)
  /** Reservation start (stretch start or tapped green half-hour). */
  const [startMs, setStartMs] = useState<number | null>(null)
  /** Chosen length — never the whole free stretch. */
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const [location, setLocation] = useState('')
  const dayStripRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const mode = hasViewerCalendar ? 'mutual' : 'host'
  const hostName = hostProfile?.displayName?.trim() || hostProfile?.username || 'Host'
  const sourceGaps = hasViewerCalendar ? mutualFreeGaps : hostFreeGaps

  const daySummaries = useMemo(
    () => dayAvailabilitySummaries(sourceGaps, timezone, { maxDays: 6 }),
    [sourceGaps, timezone],
  )

  const dayColumns = useMemo(() => {
    if (!windowStartsAt || !windowEndsAt) return []
    return buildDayColumns(new Date(windowStartsAt), new Date(windowEndsAt), timezone)
  }, [windowStartsAt, windowEndsAt, timezone])

  const windowStartMs = windowStartsAt ? Date.parse(windowStartsAt) : undefined
  const windowEndMs = windowEndsAt ? Date.parse(windowEndsAt) : undefined

  const mergedFree = useMemo(() => mergeMsIntervals(gapsToMs(sourceGaps)), [sourceGaps])

  const selectedStartMs = startMs
  const selectedEndMs =
    startMs != null && durationMs != null ? startMs + durationMs : null

  function durationFits(fromMs: number, dur: number): boolean {
    return intervalFullyInsideAnyUnion(fromMs, fromMs + dur, mergedFree)
  }

  function setReservationStart(nextStartMs: number, dayKey?: string) {
    setStartMs(nextStartMs)
    if (dayKey) setFocusDayKey(dayKey)
    setDurationMs((prev) => {
      if (prev != null && durationFits(nextStartMs, prev)) return prev
      return null
    })
  }

  function clearSelection() {
    setStartMs(null)
    setDurationMs(null)
    setFocusDayKey(null)
    setLocation('')
  }

  function openDayDetail(ymdKey: string) {
    if (expandedDayKey === ymdKey) {
      setExpandedDayKey(null)
      clearSelection()
      return
    }
    setExpandedDayKey(ymdKey)
    setFocusDayKey(ymdKey)
    requestAnimationFrame(() => {
      dayStripRefs.current.get(ymdKey)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  const reserveHref =
    shareToken && selectedStartMs != null && selectedEndMs != null && durationMs != null
      ? `${dancecardSharePublicPath(scope, shareToken)}?startsAt=${encodeURIComponent(new Date(selectedStartMs).toISOString())}&endsAt=${encodeURIComponent(new Date(selectedEndMs).toISOString())}${
          location.trim() ? `&location=${encodeURIComponent(location.trim())}` : ''
        }`
      : null

  const freeLead =
    hasViewerCalendar ? `You’re both free` : `${hostName} is free`

  const durationLabel =
    RESERVE_LENGTHS.find((d) => d.ms === durationMs)?.label ?? null

  const lengthChips = startMs != null ? (
    <div className="grid grid-cols-3 gap-2">
      {RESERVE_LENGTHS.map((d) => {
        const fits = durationFits(startMs, d.ms)
        const active = durationMs === d.ms
        return (
          <button
            key={d.ms}
            type="button"
            disabled={!fits}
            onClick={() => setDurationMs(d.ms)}
            className={cx(
              'min-h-12 rounded-xl border px-2 py-2 text-center text-sm font-semibold transition',
              active && fits
                ? 'border-dc-accent bg-dc-accent text-dc-accent-foreground'
                : 'border-dc-border bg-dc-surface/80 text-dc-text hover:border-dc-accent/45',
              !fits && 'cursor-not-allowed opacity-35',
            )}
          >
            <span className="block sm:hidden">{d.short}</span>
            <span className="hidden sm:block">{d.label}</span>
          </button>
        )
      })}
    </div>
  ) : null

  const locationField = startMs != null ? (
    <label className="block text-[11px] text-dc-muted">
      Location <span className="text-dc-muted/70">(optional)</span>
      <input
        type="text"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="e.g. dungeon, barn loft, porch"
        maxLength={512}
        className="mt-1 min-h-11 w-full rounded-xl border border-dc-border bg-dc-surface px-3 text-sm text-dc-text placeholder:text-dc-muted/60"
      />
    </label>
  ) : null

  const canReserve =
    startMs != null &&
    durationMs != null &&
    selectedEndMs != null &&
    durationFits(startMs, durationMs) &&
    Boolean(reserveHref)

  return (
    <div className="space-y-4">
      {viewerProfile || hostProfile ?
        <section className="grid gap-2 sm:grid-cols-2 sm:gap-2.5">
          {viewerProfile ? <CompareProfileCard profile={viewerProfile} variant="self" /> : null}
          {hostProfile ? <CompareProfileCard profile={hostProfile} variant="host" /> : null}
        </section>
      : null}

      {daySummaries.length > 0 ?
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-dc-accent">
            {hasViewerCalendar ? 'Mutual availability' : 'Host availability'}
          </p>
          <h2 className="mt-1 font-serif text-lg text-dc-text">Times you can meet</h2>
          <p className="mt-0.5 hidden text-xs text-dc-muted md:block">
            By day — open a day to browse every free stretch, then tap half-hours below to choose how long.
          </p>
          <p className="mt-0.5 text-xs text-dc-muted md:hidden">Open a day, pick a start, then length.</p>
          <ul className="mt-3 space-y-2">
            {daySummaries.map((day) => {
              const open = expandedDayKey === day.ymdKey
              return (
                <li
                  key={day.ymdKey}
                  className={cx(
                    'overflow-hidden rounded-2xl border transition',
                    open ? 'border-dc-accent/50 bg-dc-accent/10' : 'border-dc-border bg-dc-surface-muted/90',
                  )}
                >
                  <div className="flex items-stretch gap-0">
                    <div className="flex w-14 shrink-0 flex-col items-center justify-center border-r border-white/[0.06] bg-dc-surface/40 px-1 py-3 text-center sm:w-16">
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-dc-muted">
                        {day.weekdayShort}
                      </span>
                      <span className="font-serif text-2xl leading-none text-dc-text">
                        {day.ymdKey.slice(-2).replace(/^0/, '')}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 p-3 sm:p-3.5">
                      <p className="text-sm leading-snug text-dc-text">
                        <span className="font-medium">{freeLead}</span>{' '}
                        <span className="text-dc-text-muted">
                          {day.weekdayLong} {day.partsLabel}.
                        </span>
                      </p>
                      <p className="mt-1.5 text-xs text-dc-muted">
                        Largest stretch:{' '}
                        <span className="font-medium text-dc-text">{day.largest.timeLabel}</span>
                        <span className="text-dc-muted"> · {day.largest.durationLabel}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-dc-muted">
                        {day.windows.length} window{day.windows.length === 1 ? '' : 's'} ·{' '}
                        {formatDuration(day.totalFreeMs)} free total
                      </p>
                      <button
                        type="button"
                        onClick={() => openDayDetail(day.ymdKey)}
                        className="mt-2.5 min-h-11 w-full rounded-xl border border-dc-accent/35 bg-dc-accent/10 px-3 text-left text-xs font-semibold text-dc-accent hover:bg-dc-accent/16 sm:min-h-0 sm:w-auto sm:border-0 sm:bg-transparent sm:px-0 sm:hover:bg-transparent sm:hover:underline"
                      >
                        {open ?
                          'Hide detailed times'
                        : <>
                            <span className="md:hidden">See all times →</span>
                            <span className="hidden md:inline">
                              See detailed view of all available time for {day.weekdayLong} →
                            </span>
                          </>}
                      </button>
                    </div>
                  </div>

                  {open ?
                    <div className="border-t border-white/[0.06] bg-dc-surface/50 px-3 py-3 sm:px-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-dc-muted">
                        All free stretches · {day.dayLabel}
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {day.windows.map((w) => {
                          const activeStart = startMs === w.startMs
                          return (
                            <li key={`${w.startMs}-${w.endMs}`}>
                              <button
                                type="button"
                                onClick={() => {
                                  setReservationStart(w.startMs, day.ymdKey)
                                  requestAnimationFrame(() => {
                                    dayStripRefs.current
                                      .get(day.ymdKey)
                                      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                                  })
                                }}
                                className={cx(
                                  'flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition',
                                  activeStart
                                    ? 'border-dc-accent bg-dc-accent/15 text-dc-text'
                                    : 'border-dc-border bg-dc-elevated/80 text-dc-text hover:border-dc-accent/40',
                                )}
                              >
                                <span>
                                  <span className="font-medium">{w.timeLabel}</span>
                                  <span className="ml-2 text-xs text-dc-muted">{w.durationLabel}</span>
                                </span>
                                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-dc-accent">
                                  {activeStart ? 'Start' : 'Use start'}
                                </span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                      <p className="mt-2 hidden text-[11px] leading-snug text-dc-muted md:block">
                        Sets the start of that stretch — then pick 30 min, 1 hour, or 1½ hours below. Or tap
                        a green half-hour on the strip for a different start.
                      </p>
                    </div>
                  : null}
                </li>
              )
            })}
          </ul>

          {/* Desktop / tablet: inline reserve funnel */}
          {hasViewerCalendar && startMs != null ?
            <div className="mt-3 hidden rounded-2xl border border-dc-accent/40 bg-dc-accent/10 p-3 md:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-dc-muted">
                How long to reserve
              </p>
              <p className="mt-1 text-sm text-dc-text">
                Starting{' '}
                <span className="font-medium">
                  {formatTime(new Date(startMs).toISOString(), timezone)}
                </span>
              </p>

              <div className="mt-2">{lengthChips}</div>
              <div className="mt-3">{locationField}</div>

              {canReserve && reserveHref ?
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <p className="text-xs text-dc-muted">
                    {formatTime(new Date(startMs).toISOString(), timezone)} –{' '}
                    {formatTime(new Date(selectedEndMs!).toISOString(), timezone)}
                    {durationLabel ? ` · ${durationLabel}` : ''}
                  </p>
                  <Link
                    to={reserveHref}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
                  >
                    Reserve {durationLabel} →
                  </Link>
                </div>
              : durationMs == null ?
                <p className="mt-2 text-[11px] text-dc-muted">Pick a length — you won’t reserve the whole free stretch.</p>
              : <p className="mt-2 text-xs text-dc-muted">Share link needed to reserve.</p>}
            </div>
          : null}
        </section>
      : null}

      <div className="hidden rounded-2xl border border-dc-accent/30 bg-dc-accent/10 px-3 py-2 text-[11px] leading-snug text-dc-text md:block">
        <p className="font-semibold">Choosing a time</p>
        <p className="mt-1 text-dc-muted">
          {hasViewerCalendar ?
            <>
              Open a day, set a start (stretch or <span className="text-emerald-300">green</span> half-hour),
              then choose 30 min / 1 hour / 1½ hours.{' '}
              <span className="text-sky-300">Blue</span> = host free but you are busy.
            </>
          : <>
              Day cards summarize when {hostName} is free. Open a day for every stretch. Sign in and
              Compare again for mutual windows.
            </>
          }
        </p>
      </div>
      <p className="text-[11px] text-dc-muted md:hidden">
        {hasViewerCalendar ? 'Tap a green half-hour, then pick length below.' : `Open a day for ${hostName}'s free times.`}
      </p>

      <CompareLegend mode={mode} />

      {dayColumns.length > 0 && windowStartMs != null && windowEndMs != null ?
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-dc-muted">
              Hour-by-hour calendar
            </h2>
            <p className="mt-1 text-[11px] text-dc-muted">
              Tap a green half-hour to set where your reservation starts.
            </p>
          </div>
          {/* Mobile: page scroll only — nested overflow-y steals horizontal swipes on the strips */}
          <div className="space-y-3 md:max-h-[min(60vh,32rem)] md:overflow-y-auto md:overscroll-contain md:pr-1">
            {dayColumns.map((d) => (
              <div
                key={d.ymdKey}
                ref={(el) => {
                  if (el) dayStripRefs.current.set(d.ymdKey, el)
                  else dayStripRefs.current.delete(d.ymdKey)
                }}
              >
                <MutualAvailabilityStrip
                  dayLabel={d.label}
                  rangeStartMs={d.colStart.getTime()}
                  freeGaps={hasViewerCalendar ? mutualFreeGaps : hostFreeGaps}
                  hostFreeGaps={hostFreeGaps}
                  tz={timezone}
                  mode={mode}
                  highlighted={focusDayKey === d.ymdKey}
                  onFreeStepClick={
                    hasViewerCalendar ? (s) => setReservationStart(s, d.ymdKey) : undefined
                  }
                  activeWindowStartMs={windowStartMs}
                  activeWindowEndMs={windowEndMs}
                  selectedStartMs={selectedStartMs}
                  selectedEndMs={selectedEndMs}
                />
              </div>
            ))}
          </div>
        </section>
      : null}

      {hasViewerCalendar && mutualFreeGaps.length === 0 ?
        <p className="text-sm text-dc-muted">No mutual free windows right now — try adjusting availability.</p>
      : null}

      {shareToken && startMs == null ?
        <Link
          to={dancecardSharePublicPath(scope, shareToken)}
          className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent/18 px-4 text-sm font-medium text-dc-accent hover:bg-dc-accent/26"
        >
          Open full compare &amp; request scene →
        </Link>
      : null}

      {/* Mobile: sticky length → location → Reserve above bottom nav */}
      {hasViewerCalendar && startMs != null ?
        <>
          {/* Clearance for sticky length/location/Reserve bar + bottom nav */}
          <div className="h-[min(50vh,22rem)] md:hidden" aria-hidden />
          <div className="md:hidden">
            <MobileActionBar
              status={`Start ${formatTime(new Date(startMs).toISOString(), timezone)}${
                durationMs != null && selectedEndMs != null
                  ? ` – ${formatTime(new Date(selectedEndMs).toISOString(), timezone)}`
                  : ''
              }`}
              body={
                <div className="space-y-2">
                  {lengthChips}
                  {locationField}
                </div>
              }
              primary={{
                label: durationLabel ? `Reserve ${durationLabel}` : 'Pick a length',
                href: canReserve && reserveHref ? reserveHref : undefined,
                onClick: canReserve ? undefined : () => undefined,
                disabled: !canReserve,
              }}
              secondary={{
                label: 'Clear',
                onClick: clearSelection,
                variant: 'secondary',
              }}
            />
          </div>
        </>
      : null}
    </div>
  )
}
