import { useCallback, useId, useMemo, useState } from 'react'
import GroupEventCalendar from '@/components/GroupEventCalendar'
import ConventionScheduleAgenda, { type ScheduleLayout } from '@/components/conventions/ConventionScheduleAgenda'
import TabButton from '@/components/ui/TabButton'
import {
  EROBAY_COMMUNITY_SOURCE_LIST,
  EROBAY_DISPLAY_TIMEZONE,
  erobayCommunityMirrorSlots,
  erobayCommunitySlotsByDay,
  erobayMirrorSlotsAsMockEvents,
  erobayMirrorTrackLabels,
  pacificWallDateFromIso,
} from '@/data/erobay-community-mirror-data'
import ErobayMirrorTimeline from './ErobayMirrorTimeline'

function formatShortRange(slots: readonly { startsAt: string }[], timeZone: string): string {
  if (slots.length === 0) return '-'
  const sorted = [...slots].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  const a = new Date(sorted[0]!.startsAt)
  const b = new Date(sorted[sorted.length - 1]!.startsAt)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return '-'
  const o: Intl.DateTimeFormatOptions = { timeZone, month: 'short', day: 'numeric', year: 'numeric' }
  const left = a.toLocaleDateString('en-US', o)
  const right = b.toLocaleDateString('en-US', o)
  return left === right ? left : `${left} – ${right}`
}

function notEnded(isoEnd: string, nowMs: number): boolean {
  const t = new Date(isoEnd).getTime()
  return Number.isFinite(t) && t >= nowMs
}

export default function ErobayCommunityMirrorPage() {
  const searchId = useId()
  const tz = EROBAY_DISPLAY_TIMEZONE
  const allSlots = erobayCommunityMirrorSlots
  const trackLabels = useMemo(() => {
    const nowMs = Date.now()
    const open = allSlots.filter((s) => notEnded(s.endsAt, nowMs))
    return erobayMirrorTrackLabels(open)
  }, [allSlots])

  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [view, setView] = useState<'timeline' | 'program'>('timeline')
  const [agendaLayout, setAgendaLayout] = useState<ScheduleLayout>('time-list')
  const [highlightDay, setHighlightDay] = useState<{ year: number; monthIndex: number; day: number } | null>(null)
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null)

  const filteredSlots = useMemo(() => {
    const nowMs = Date.now()
    let list = allSlots.filter((s) => notEnded(s.endsAt, nowMs))
    if (typeFilter) list = list.filter((s) => (s.trackLabel ?? '').trim() === typeFilter)
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.location ?? '').toLowerCase().includes(q) ||
          (s.description ?? '').toLowerCase().includes(q) ||
          (s.trackLabel ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [allSlots, query, typeFilter])

  const calendarEvents = useMemo(() => erobayMirrorSlotsAsMockEvents(filteredSlots), [filteredSlots])
  const slotsByDay = useMemo(() => erobayCommunitySlotsByDay(filteredSlots), [filteredSlots])

  /** Next not-yet-started row, else earliest still-open row (in progress), for spotlight + jump. */
  const spotlightSlot = useMemo(() => {
    const nowMs = Date.now()
    const sorted = [...filteredSlots].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )
    return sorted.find((s) => new Date(s.startsAt).getTime() > nowMs) ?? sorted[0] ?? null
  }, [filteredSlots])

  const spotlightIsLive = useMemo(() => {
    if (!spotlightSlot) return false
    return new Date(spotlightSlot.startsAt).getTime() <= Date.now()
  }, [spotlightSlot])

  const hasActiveFilters = Boolean(query.trim() || typeFilter)

  const clearFilters = useCallback(() => {
    setQuery('')
    setTypeFilter(null)
  }, [])

  const scrollToSlot = useCallback((id: string) => {
    requestAnimationFrame(() => {
      document.getElementById(`erobay-slot-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  const onSelectSlot = useCallback(
    (slot: (typeof allSlots)[number]) => {
      setActiveSlotId(slot.id)
      const p = pacificWallDateFromIso(slot.startsAt)
      setHighlightDay(p)
    },
    [],
  )

  const onDayWithEventsPress = useCallback(
    (d: { year: number; monthIndex: number; day: number }) => {
      const first = filteredSlots.find((s) => {
        const p = pacificWallDateFromIso(s.startsAt)
        return p && p.year === d.year && p.monthIndex === d.monthIndex && p.day === d.day
      })
      if (first) {
        setView('timeline')
        setActiveSlotId(first.id)
        setHighlightDay(d)
        scrollToSlot(first.id)
      }
    },
    [filteredSlots, scrollToSlot],
  )

  const jumpToNext = useCallback(() => {
    if (!spotlightSlot) return
    setView('timeline')
    setActiveSlotId(spotlightSlot.id)
    const p = pacificWallDateFromIso(spotlightSlot.startsAt)
    setHighlightDay(p)
    scrollToSlot(spotlightSlot.id)
  }, [spotlightSlot, scrollToSlot])

  const rangeLabel = useMemo(() => formatShortRange(filteredSlots, tz), [filteredSlots, tz])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <header className="border-b border-white/[0.08] pb-8">
        <p className="text-xs font-medium uppercase tracking-wide text-dc-muted">Imported community calendar</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-dc-text md:text-3xl">Bay Area community events</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-dc-text-muted">
          Read-only mirror with search, type filters, and two layouts: a scannable timeline (recommended) and a program-style agenda.
          Confirm every detail on the{' '}
          <a
            href={EROBAY_COMMUNITY_SOURCE_LIST}
            className="font-medium text-dc-accent underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            live Erobay Community list
          </a>
          .
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <a
            href={EROBAY_COMMUNITY_SOURCE_LIST}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-text shadow-sm transition-[opacity,transform] motion-safe:duration-150 hover:opacity-95 motion-safe:hover:-translate-y-px motion-reduce:hover:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dc-accent"
          >
            Open source site
          </a>
          <button
            type="button"
            onClick={jumpToNext}
            disabled={!spotlightSlot}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dc-border bg-white/[0.04] px-4 text-sm font-medium text-dc-text transition-[background-color,border-color,opacity] motion-safe:duration-150 hover:border-white/25 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dc-accent"
          >
            {spotlightIsLive ? 'Jump to live event' : 'Jump to next event'}
          </button>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-dc-text-muted">
        <span>
          <span className="tabular-nums font-semibold text-dc-text">{filteredSlots.length}</span> events
        </span>
        <span className="text-dc-muted" aria-hidden>
          ·
        </span>
        <span className="tabular-nums">{rangeLabel}</span>
        <span className="text-dc-muted" aria-hidden>
          ·
        </span>
        <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs font-medium text-dc-muted ring-1 ring-white/10">
          Times in {tz.replace('_', ' ')}
        </span>
        <span className="text-dc-muted" aria-hidden>
          ·
        </span>
        <span className="text-xs text-dc-muted">Ended events hidden</span>
      </div>

      <section className="mt-6 rounded-2xl border border-dc-border bg-dc-elevated/80 p-4 shadow-[var(--dc-shadow-soft)] md:p-5" aria-label="Filter and view options">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <label htmlFor={searchId} className="block text-xs font-medium uppercase tracking-wide text-dc-muted">
                Search
              </label>
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Title, location, type, notes…"
                autoComplete="off"
                className="mt-1.5 w-full min-h-11 rounded-xl border border-dc-border bg-dc-elevated-solid px-3 text-sm text-dc-text placeholder:text-dc-muted focus:border-dc-accent-border/50 focus:outline-none focus:ring-2 focus:ring-dc-accent/25"
              />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-dc-muted">Event type</p>
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Filter by event type">
                <TabButton
                  label="All types"
                  ariaStyle="toggle"
                  size="small"
                  isActive={typeFilter === null}
                  onClick={() => setTypeFilter(null)}
                />
                {trackLabels.map((label) => (
                  <TabButton
                    key={label}
                    label={label}
                    ariaStyle="toggle"
                    size="small"
                    isActive={typeFilter === label}
                    onClick={() => setTypeFilter((cur) => (cur === label ? null : label))}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-stretch">
            {hasActiveFilters ?
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-11 rounded-xl px-3 text-sm font-medium text-dc-accent underline-offset-2 hover:underline"
              >
                Clear filters
              </button>
            : null}
            <div className="flex rounded-xl border border-dc-border bg-dc-elevated-solid/80 p-1" role="group" aria-label="Layout">
              <TabButton
                label="Timeline"
                ariaStyle="toggle"
                size="small"
                isActive={view === 'timeline'}
                onClick={() => setView('timeline')}
              />
              <TabButton label="Program" ariaStyle="toggle" size="small" isActive={view === 'program'} onClick={() => setView('program')} />
            </div>
          </div>
        </div>
      </section>

      {spotlightSlot ?
        <section
          className="mt-6 rounded-2xl border border-dc-accent/25 bg-dc-accent/[0.06] p-4 md:flex md:items-start md:justify-between md:gap-6 md:p-5"
          aria-label={spotlightIsLive ? 'Happening now' : 'Up next'}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-dc-accent">
              {spotlightIsLive ? 'Happening now' : 'Up next'}
            </p>
            <p className="mt-1 text-base font-semibold text-dc-text">{spotlightSlot.title}</p>
            <p className="mt-1 text-sm text-dc-text-muted">
              {new Date(spotlightSlot.startsAt).toLocaleString('en-US', {
                timeZone: tz,
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
              {spotlightSlot.location?.trim() ? ` · ${spotlightSlot.location.trim()}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onSelectSlot(spotlightSlot)
              scrollToSlot(spotlightSlot.id)
              setView('timeline')
            }}
            className="mt-4 inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-dc-border bg-white/[0.06] px-4 text-sm font-medium text-dc-text transition-colors hover:bg-white/[0.1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dc-accent md:mt-0"
          >
            Show in timeline
          </button>
        </section>
      : null}

      <details className="mt-6 rounded-2xl border border-dc-border bg-dc-elevated/95/50 px-4 py-3 text-sm text-dc-text-muted">
        <summary className="cursor-pointer font-medium text-dc-text">About this mirror &amp; data freshness</summary>
        <p className="mt-2 leading-relaxed">
          Automated import from Erobay is blocked by Cloudflare. Rows live in{' '}
          <code className="rounded bg-white/[0.08] px-1.5 py-0.5 text-xs text-dc-muted">erobay-community-mirror-data.ts</code>. Edit
          there after copying from your browser. Month cells with a count are buttons: they scroll the timeline to that day.
        </p>
      </details>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,19rem)_1fr] lg:items-start">
        <aside className="space-y-3 lg:sticky lg:top-24">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Month</h2>
          <GroupEventCalendar
            events={calendarEvents}
            linkEvents={false}
            highlightedDay={highlightDay}
            onDayWithEventsPress={onDayWithEventsPress}
          />
          <p className="text-xs leading-relaxed text-dc-muted">
            Arrows change month. Days with a count jump the timeline to that date and highlight the row.
          </p>
        </aside>

        <div className="min-w-0">
          {view === 'timeline' ?
            <ErobayMirrorTimeline
              slots={filteredSlots}
              timeZone={tz}
              sourceUrl={EROBAY_COMMUNITY_SOURCE_LIST}
              onSelectSlot={(slot) => {
                onSelectSlot(slot)
              }}
              activeSlotId={activeSlotId}
            />
          : <div className="space-y-3">
              <p className="text-xs text-dc-muted">
                Dense program layout. Same component as convention schedules. Use <strong className="text-dc-text-muted">Time list</strong>{' '}
                for fastest scanning.
              </p>
              <ConventionScheduleAgenda
                slotsByDay={slotsByDay}
                timezone={tz}
                onAddToDancecard={() => {}}
                showDancecard={false}
                programLayout={agendaLayout}
                onProgramLayoutChange={setAgendaLayout}
              />
            </div>}
        </div>
      </div>
    </div>
  )
}
