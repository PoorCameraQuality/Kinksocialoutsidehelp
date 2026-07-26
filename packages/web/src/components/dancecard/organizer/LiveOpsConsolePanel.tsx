'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { EventSettingsEventDto } from '@/components/dancecard/organizer/settings/EventSettingsEventDto'
import type { ProgramSlotRow } from '@/lib/dancecard/organizerProgramSlotDto'
import { organizerDancecardFetch } from '@/components/dancecard/organizer/organizerApi'
import { organizerTabHref, useOrganizerWorkspacePath } from '@/components/dancecard/organizer/organizerWorkspaceContext'
import { Panel } from '@/components/dancecard/ui/Panel'
import { isEventBeforeStart, isEventWindowActive, nextUpcomingSlot } from '@/components/dancecard/organizer/home/dashboardUtils'

type LivePayload = {
  generatedAt: string
  happeningNow: Array<{
    locationName: string
    capacity: number | null
    slots: Array<{ id: string; title: string; startsAt: string; endsAt: string }>
  }>
  checkIn: { onSite: number; registered: number; byTiming: Record<string, number> }
  unpublishedStartingSoon: Array<{ id: string; title: string; startsAt: string }>
  dmGapsNow: Array<{ title: string; detail?: string }>
}

export function LiveOpsConsolePanel({
  eventSlug,
  event,
  slots,
  openIncidents = 0,
}: {
  eventSlug: string
  event: EventSettingsEventDto | null
  slots: ProgramSlotRow[]
  openIncidents?: number
}) {
  const workspaceBase = useOrganizerWorkspacePath(eventSlug)
  const signupsHref = organizerTabHref(workspaceBase, 'people', { peopleTab: 'signups' })
  const coverageHref = organizerTabHref(workspaceBase, 'people', { peopleTab: 'coverage' })
  const incidentsHref = organizerTabHref(workspaceBase, 'people', { peopleTab: 'incidents' })
  const [data, setData] = useState<LivePayload | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const beforeStart = isEventBeforeStart(event)
  const live = isEventWindowActive(event)
  const nextSlot = useMemo(() => nextUpcomingSlot(slots), [slots])

  const load = useCallback(async () => {
    setErr(null)
    try {
      const res = await organizerDancecardFetch<LivePayload>(eventSlug, '/ops/live')
      setData(res)
    } catch (e) {
      setData(null)
      setErr(e instanceof Error ? e.message : 'Failed to load live ops')
    }
  }, [eventSlug])

  useEffect(() => {
    void load()
    const t = window.setInterval(() => void load(), 45_000)
    return () => window.clearInterval(t)
  }, [load])

  const staffingGaps = (data?.dmGapsNow.length ?? 0) + (data?.unpublishedStartingSoon.length ?? 0)

  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-serif text-lg text-dc-text">Live operations</h2>
          <p className="text-xs text-dc-muted">
            {live ? 'Event window active. Refreshes every 45s' : 'Operational snapshot for check-in and coverage'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-dc-border px-3 py-1.5 text-xs text-dc-muted hover:bg-dc-surface-muted"
        >
          Refresh
        </button>
      </div>

      {beforeStart && !live ? (
        <div className="rounded-xl border border-dc-border bg-dc-elevated-muted px-4 py-3 text-sm text-dc-muted">
          <p className="font-medium text-dc-text">Event has not started yet</p>
          <p className="mt-1 text-xs">
            Live room and session tracking activates during the event window.
            {nextSlot ? (
              <>
                {' '}
                Next session: <span className="text-dc-text">{nextSlot.title}</span>
                {nextSlot.startsAt ? ` · ${new Date(nextSlot.startsAt).toLocaleString()}` : null}
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      {err ? (
        <p className="text-sm text-dc-danger">
          {err}{' '}
          <Link href={signupsHref} className="font-semibold text-dc-accent underline">
            Open signups
          </Link>
        </p>
      ) : null}

      {data ? (
        <div className="mt-4 space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-dc-border bg-dc-elevated-muted p-3">
              <p className="text-xs text-dc-muted">On-site</p>
              <p className="text-2xl font-semibold text-dc-text">{data.checkIn.onSite}</p>
              <p className="text-xs text-dc-muted">of {data.checkIn.registered} registered</p>
            </div>
            <div className="rounded-xl border border-dc-border bg-dc-elevated-muted p-3">
              <p className="text-xs text-dc-muted">Check-in timing</p>
              <p className="mt-1 text-xs text-dc-text">
                {Object.entries(data.checkIn.byTiming)
                  .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
                  .join(' · ') || '-'}
              </p>
            </div>
            <div className="rounded-xl border border-dc-border bg-dc-elevated-muted p-3">
              <p className="text-xs text-dc-muted">Sessions now</p>
              <p className="text-2xl font-semibold text-dc-text">
                {data.happeningNow.reduce((n, loc) => n + loc.slots.length, 0)}
              </p>
              <p className="text-xs text-dc-muted">Published & in progress</p>
            </div>
            <div className="rounded-xl border border-dc-border bg-dc-elevated-muted p-3">
              <p className="text-xs text-dc-muted">Staffing gaps</p>
              <p className={staffingGaps > 0 ? 'text-2xl font-semibold text-amber-200' : 'text-2xl font-semibold text-dc-text'}>
                {staffingGaps}
              </p>
              <p className="text-xs text-dc-muted">Coverage + unpublished soon</p>
            </div>
          </div>

          {nextSlot && !live ? (
            <section className="rounded-xl border border-dc-border bg-dc-elevated-muted/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-dc-muted">Upcoming next session</p>
              <p className="mt-1 font-medium text-dc-text">{nextSlot.title}</p>
              {nextSlot.startsAt ? (
                <p className="text-xs text-dc-muted">{new Date(nextSlot.startsAt).toLocaleString()}</p>
              ) : null}
            </section>
          ) : null}

          {live ? (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-dc-muted">Rooms active now</h3>
              {!data.happeningNow.length ? (
                <p className="text-dc-muted">No published sessions in progress right now.</p>
              ) : (
                <ul className="space-y-2">
                  {data.happeningNow.map((loc) => (
                    <li key={loc.locationName} className="rounded-xl border border-dc-border p-3">
                      <p className="font-medium text-dc-text">
                        {loc.locationName}
                        {loc.capacity != null ? (
                          <span className="ml-2 text-xs text-dc-muted">
                            {loc.slots.length}/{loc.capacity} concurrent
                          </span>
                        ) : null}
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-dc-muted">
                        {loc.slots.map((s) => (
                          <li key={s.id}>
                            <Link
                              href={organizerTabHref(workspaceBase, 'program', { slot: s.id })}
                              className="text-dc-accent hover:underline"
                            >
                              {s.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {data.dmGapsNow.length ? (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-200">Current staffing gaps</h3>
              <ul className="space-y-1 text-xs text-amber-100">
                {data.dmGapsNow.map((g, i) => (
                  <li key={i}>
                    {g.title}
                    {g.detail ? ` · ${g.detail}` : ''}
                  </li>
                ))}
              </ul>
              <Link href={coverageHref} className="mt-2 inline-block text-xs font-semibold text-dc-accent hover:underline">
                Open DM coverage →
              </Link>
            </section>
          ) : null}

          {openIncidents > 0 ? (
            <section className="rounded-xl border border-red-500/30 bg-red-950/20 p-3">
              <p className="text-sm font-medium text-red-200">{openIncidents} open incident{openIncidents === 1 ? '' : 's'}</p>
              <Link href={incidentsHref} className="mt-1 inline-block text-xs font-semibold text-dc-accent hover:underline">
                Review incidents →
              </Link>
            </section>
          ) : null}

          {data.unpublishedStartingSoon.length ? (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-dc-warning">Unpublished starting soon</h3>
              <ul className="space-y-1 text-xs text-amber-100">
                {data.unpublishedStartingSoon.map((s) => (
                  <li key={s.id}>
                    {s.title}. Starts {new Date(s.startsAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : !err ? (
        <p className="text-sm text-dc-muted">Loading live ops…</p>
      ) : null}
    </Panel>
  )
}
