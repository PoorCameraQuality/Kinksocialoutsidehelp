import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ConventionScheduleAgenda from '@/components/conventions/ConventionScheduleAgenda'
import type { ScheduleSlot } from '@/components/conventions/convention-schedule-types'
import { dayHeading, sortSlotsForAgenda } from '@/components/conventions/convention-schedule-utils'

type LoadState = 'idle' | 'loading' | 'ok' | 'forbidden' | 'error'

/**
 * Loads convention timezone + program slots and renders {@link ConventionScheduleAgenda}.
 * Used on the event page when an event is anchored to a convention program.
 */
export default function ConventionProgramSchedulePanel({ conventionSlug }: { conventionSlug: string }) {
  const [slots, setSlots] = useState<ScheduleSlot[]>([])
  const [timezone, setTimezone] = useState('UTC')
  const [loadState, setLoadState] = useState<LoadState>('idle')

  const load = useCallback(async () => {
    const slug = conventionSlug.trim()
    if (!slug) return
    setLoadState('loading')
    const k = encodeURIComponent(slug)
    try {
      const [rConv, rSlots] = await Promise.all([
        fetch(`/api/v1/conventions/${k}`, { credentials: 'include' }),
        fetch(`/api/v1/conventions/${k}/slots`, { credentials: 'include' }),
      ])
      if (rConv.ok) {
        const d = (await rConv.json()) as { convention?: { timezone?: string | null } }
        const tz = d.convention?.timezone?.trim()
        if (tz) setTimezone(tz)
      }
      if (rSlots.status === 403) {
        setSlots([])
        setLoadState('forbidden')
        return
      }
      if (!rSlots.ok) {
        setSlots([])
        setLoadState('error')
        return
      }
      const d = (await rSlots.json()) as { items?: ScheduleSlot[] }
      setSlots(d.items ?? [])
      setLoadState('ok')
    } catch {
      setSlots([])
      setLoadState('error')
    }
  }, [conventionSlug])

  useEffect(() => {
    void load()
  }, [load])

  const slotsByDay = useMemo(() => {
    if (!slots.length) return [] as { day: string; items: ScheduleSlot[] }[]
    const sorted = sortSlotsForAgenda(slots)
    const map = new Map<string, ScheduleSlot[]>()
    for (const s of sorted) {
      const label = dayHeading(s.startsAt, timezone)
      if (!map.has(label)) map.set(label, [])
      map.get(label)!.push(s)
    }
    return Array.from(map.entries()).map(([day, items]) => ({ day, items }))
  }, [slots, timezone])

  const addToDancecard = useCallback(
    async (slotId: string) => {
      const k = encodeURIComponent(conventionSlug.trim())
      await fetch(`/api/v1/conventions/${k}/slots/${encodeURIComponent(slotId)}/signup`, {
        method: 'POST',
        credentials: 'include',
      })
    },
    [conventionSlug],
  )

  const hub = `/conventions/${encodeURIComponent(conventionSlug.trim())}`

  if (loadState === 'loading' || loadState === 'idle') {
    return <p className="text-sm text-dc-muted">Loading program…</p>
  }
  if (loadState === 'forbidden') {
    return (
      <div className="rounded-2xl border border-dc-border bg-dc-elevated/95 p-6 text-sm text-dc-text-muted shadow-[var(--dc-shadow-soft)]">
        <p>This program is only visible to confirmed attendees and staff.</p>
        <p className="mt-2 text-xs text-dc-muted">
          After you have access, open the full hub for chat, documents, and your dancecard.
        </p>
        <Link to={`${hub}?tab=Schedule`} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-medium text-dc-text hover:bg-dc-accent-hover">
          Open convention hub
        </Link>
      </div>
    )
  }
  if (loadState === 'error') {
    return (
      <p className="text-sm text-dc-muted">
        Could not load the program.{' '}
        <Link to={`${hub}?tab=Schedule`} className="text-dc-accent hover:underline">
          Try the convention hub
        </Link>
        .
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {slotsByDay.length === 0 ?
        <p className="text-sm text-dc-muted">No schedule slots published yet.</p>
      : <ConventionScheduleAgenda slotsByDay={slotsByDay} timezone={timezone} onAddToDancecard={addToDancecard} />}
      <p className="text-xs text-dc-muted">
        <Link to={`${hub}?tab=Schedule`} className="text-dc-accent hover:underline">
          Full convention hub
        </Link>
        {' · '}
        <Link to={`${hub}?tab=Dancecard`} className="text-dc-accent hover:underline">
          Dancecard &amp; my schedule
        </Link>
        {' · '}
        <Link to={`${hub}?tab=Schedule&programView=list`} className="text-dc-accent hover:underline">
          Shareable time-list view
        </Link>
      </p>
    </div>
  )
}
