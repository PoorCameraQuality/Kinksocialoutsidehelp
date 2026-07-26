'use client'

import { useEffect, useMemo, useState } from 'react'
import { organizerDancecardFetch, invalidateOrganizerDancecardCache } from '@/components/dancecard/organizer/organizerApi'
import { DatetimeLocalField } from '@/components/dancecard/organizer/ui/DatetimeLocalField'
import { dayKeysInWindow } from '@/components/dancecard/organizer/organizerTimeline'
import type { ProgramSlotStats } from '@/lib/dancecard/programSlotStats'
import {
  formatConventionDateRange,
  formatDailyGridWindow,
  fromConventionDatetimeInput,
  isSuspiciousEventWindow,
  toConventionDatetimeInput,
} from '@/lib/dancecard/eventWindowTime'
import { PROGRAM_GRID_END_HOUR_EXCL, PROGRAM_GRID_START_HOUR } from '@/lib/dancecard/programGridConfig'
import { cn } from '@/lib/cn'

type Props = {
  eventSlug: string
  timezone: string
  windowStartsAt: string
  windowEndsAt: string
  hasEventWindow: boolean
  slotStats: ProgramSlotStats
  roomCount: number | null
  readOnly?: boolean
  onSaved: (window: { windowStartsAt: string; windowEndsAt: string }) => void
  onGoSettings?: () => void
}

export function ProgramEventWindowBar({
  eventSlug,
  timezone,
  windowStartsAt,
  windowEndsAt,
  hasEventWindow,
  slotStats,
  roomCount,
  readOnly,
  onSaved,
  onGoSettings,
}: Props) {
  const [editing, setEditing] = useState(!hasEventWindow)
  const [startLocal, setStartLocal] = useState('')
  const [endLocal, setEndLocal] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [savedHint, setSavedHint] = useState<string | null>(null)

  useEffect(() => {
    if (!hasEventWindow) setEditing(true)
  }, [hasEventWindow])

  useEffect(() => {
    if (!editing) return
    setStartLocal(toConventionDatetimeInput(windowStartsAt, timezone))
    setEndLocal(toConventionDatetimeInput(windowEndsAt, timezone))
    setErr(null)
    setSavedHint(null)
  }, [editing, windowStartsAt, windowEndsAt, timezone])

  const dateRange = useMemo(
    () => (hasEventWindow ? formatConventionDateRange(windowStartsAt, windowEndsAt, timezone) : null),
    [hasEventWindow, windowStartsAt, windowEndsAt, timezone],
  )

  const scheduleDays = useMemo(() => {
    if (!hasEventWindow) return 0
    return dayKeysInWindow(windowStartsAt, windowEndsAt, timezone).length
  }, [hasEventWindow, windowStartsAt, windowEndsAt, timezone])

  const dailyWindow = useMemo(() => {
    if (!hasEventWindow) return null
    const keys = dayKeysInWindow(windowStartsAt, windowEndsAt, timezone)
    if (!keys.length) return null
    return formatDailyGridWindow(PROGRAM_GRID_START_HOUR, PROGRAM_GRID_END_HOUR_EXCL, timezone, keys[0]!)
  }, [hasEventWindow, windowStartsAt, windowEndsAt, timezone])

  const needsReview = useMemo(
    () => hasEventWindow && isSuspiciousEventWindow(windowStartsAt, windowEndsAt, timezone),
    [hasEventWindow, windowStartsAt, windowEndsAt, timezone],
  )

  const save = async () => {
    if (readOnly) return
    const startIso = fromConventionDatetimeInput(startLocal, timezone)
    const endIso = fromConventionDatetimeInput(endLocal, timezone)
    if (!startIso || !endIso) {
      setErr('Choose both a start and an end date and time.')
      return
    }
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setErr('End must be after start.')
      return
    }
    setBusy(true)
    setErr(null)
    setSavedHint(null)
    try {
      const res = await organizerDancecardFetch<{
        event: { windowStartsAt: string; windowEndsAt: string }
      }>(eventSlug, '/event', {
        method: 'PATCH',
        body: JSON.stringify({ windowStartsAt: startIso, windowEndsAt: endIso }),
      })
      invalidateOrganizerDancecardCache(eventSlug, '/event')
      invalidateOrganizerDancecardCache(eventSlug, '/organizer/bootstrap')
      invalidateOrganizerDancecardCache(eventSlug, '/program-slots')
      onSaved({
        windowStartsAt: res.event.windowStartsAt,
        windowEndsAt: res.event.windowEndsAt,
      })
      setEditing(false)
      setSavedHint('Event dates updated. The grid now reflects your window.')
      window.setTimeout(() => setSavedHint(null), 5000)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save event dates')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className={cn(
        'rounded-xl border px-3 py-2.5 sm:px-4',
        needsReview
          ? 'border-dc-warning/35 bg-dc-warning-muted/25'
          : hasEventWindow
            ? 'border-dc-border-subtle bg-dc-surface-muted/50'
            : 'border-dc-warning/35 bg-dc-warning-muted/30',
      )}
      aria-labelledby="program-event-window-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="program-event-window-heading" className="text-xs font-semibold uppercase tracking-wide text-dc-muted">
            Event dates &amp; times
          </h2>
          {!hasEventWindow ? (
            <p className="mt-1 text-sm text-dc-warning">Event dates not set. The schedule grid needs a start and end.</p>
          ) : needsReview ? (
            <>
              <p className="mt-1 text-sm font-medium text-dc-warning">Program dates need review.</p>
              <p className="mt-0.5 text-xs text-dc-muted">
                The saved window looks inconsistent ({dateRange ?? 'invalid range'}). Confirm dates in {timezone} before
                building the grid.
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-lg font-semibold text-dc-text">{dateRange}</p>
              <p className="mt-0.5 text-xs text-dc-muted">
                Timezone: {timezone}
                {dailyWindow ? ` · Daily grid: ${dailyWindow}` : null}
              </p>
            </>
          )}
          {hasEventWindow && !needsReview ? (
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3 lg:grid-cols-6">
              <div>
                <dt className="text-dc-muted">Schedule days</dt>
                <dd className="font-semibold text-dc-text">{scheduleDays}</dd>
              </div>
              {roomCount != null ? (
                <div>
                  <dt className="text-dc-muted">Rooms</dt>
                  <dd className="font-semibold text-dc-text">{roomCount}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-dc-muted">Sessions</dt>
                <dd className="font-semibold text-dc-text">{slotStats.total}</dd>
              </div>
              <div>
                <dt className="text-dc-muted">Published</dt>
                <dd className="font-semibold text-emerald-400">{slotStats.published}</dd>
              </div>
              <div>
                <dt className="text-dc-muted">Draft</dt>
                <dd className={cn('font-semibold', slotStats.draft > 0 ? 'text-amber-400' : 'text-dc-text')}>
                  {slotStats.draft}
                </dd>
              </div>
              {slotStats.unscheduled > 0 ? (
                <div>
                  <dt className="text-dc-muted">Unscheduled</dt>
                  <dd className="font-semibold text-dc-muted">{slotStats.unscheduled}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          {savedHint ? <p className="mt-1 text-xs text-dc-accent">{savedHint}</p> : null}
        </div>
        {!readOnly ? (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {editing ? (
              <button
                type="button"
                className="rounded-lg border border-dc-border px-2.5 py-1 text-xs text-dc-muted hover:bg-dc-elevated-muted/80"
                disabled={busy}
                onClick={() => {
                  setEditing(false)
                  setErr(null)
                }}
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                className="rounded-lg border border-dc-border px-2.5 py-1 text-xs font-medium text-dc-text hover:bg-dc-elevated-muted/80"
                onClick={() => setEditing(true)}
              >
                Change dates
              </button>
            )}
            {onGoSettings ? (
              <button
                type="button"
                className="rounded-lg px-2.5 py-1 text-xs text-dc-accent hover:underline"
                onClick={onGoSettings}
              >
                All settings
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {editing && !readOnly ? (
        <div className="mt-3 grid gap-3 border-t border-dc-border-subtle pt-3 sm:grid-cols-2">
          <DatetimeLocalField
            label="Event starts"
            value={startLocal}
            disabled={busy}
            hint={`Wall clock in ${timezone}.`}
            onChange={setStartLocal}
          />
          <DatetimeLocalField
            label="Event ends"
            value={endLocal}
            disabled={busy}
            hint={`Wall clock in ${timezone}.`}
            onChange={setEndLocal}
          />
          <p className="sm:col-span-2 text-xs leading-relaxed text-dc-muted">
            Dates are saved in the convention timezone and control which days appear on the grid. After import or wizard
            setup, confirm the range matches your real event dates.
          </p>
          {err ? <p className="sm:col-span-2 text-sm text-red-700">{err}</p> : null}
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className="rounded-full bg-dc-accent px-4 py-2 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
              onClick={() => void save()}
            >
              {busy ? 'Saving…' : 'Save event dates'}
            </button>
          </div>
        </div>
      ) : null}

      {!hasEventWindow && !editing && !readOnly ? (
        <button
          type="button"
          className="mt-2 text-sm font-semibold text-dc-accent hover:underline"
          onClick={() => setEditing(true)}
        >
          Set event dates
        </button>
      ) : null}
    </section>
  )
}
