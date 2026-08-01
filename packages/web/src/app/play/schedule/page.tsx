import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { buildLoginHref } from '@/lib/auth-links'
import {
  buildGoogleCalendarUrl,
  buildSingleEventIcs,
  downloadIcsFile,
} from '@/lib/event-calendar-links'
import {
  scheduleExportUrl,
  useMyPlaySchedule,
  type MyScheduleItem,
  type ScheduleRange,
} from '@/hooks/useMyPlaySchedule'
import {
  appearanceVarsToStyle,
  getAppearancePreset,
  PLAY_SURFACE_APPEARANCE,
} from '@/lib/dancecard/appearancePresets'
import { dancecardEntryIdForApi } from '@/lib/dancecard/dancecardApiScope'
import {
  formatUtcMsAsDatetimeLocalInZone,
  parseDatetimeLocalInZone,
} from '@/components/dancecard/time'
import { useConfirm } from '@/hooks/useConfirm'

function kindLabel(kind: string): string {
  switch (kind) {
    case 'dancecard_slot_signup':
      return 'Program'
    case 'dancecard_scene_booking':
      return 'Scene'
    case 'dancecard_manual':
      return 'Block'
    default:
      return kind.replace(/^dancecard_/, '') || 'Item'
  }
}

function dayKey(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

function formatDayHeading(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

function formatTimeRange(startsAt: string, endsAt: string, timeZone: string): string {
  try {
    const opts: Intl.DateTimeFormatOptions = { timeZone, hour: 'numeric', minute: '2-digit' }
    const a = new Date(startsAt).toLocaleTimeString(undefined, opts)
    const b = new Date(endsAt).toLocaleTimeString(undefined, opts)
    return `${a} – ${b}`
  } catch {
    return ''
  }
}

function isUpcoming(item: MyScheduleItem): boolean {
  return Date.parse(item.endsAt) >= Date.now()
}

function apiBase(slug: string): string {
  return `/api/v1/play-spaces/${encodeURIComponent(slug)}`
}

function ScheduleItemCard({
  item,
  onChanged,
  confirm,
}: {
  item: MyScheduleItem
  onChanged: () => void
  confirm: (
    title: string,
    description?: string,
    opts?: { destructive?: boolean; confirmLabel?: string },
  ) => Promise<boolean>
}) {
  const [panel, setPanel] = useState<'none' | 'reschedule'>('none')
  const [start, setStart] = useState(() =>
    formatUtcMsAsDatetimeLocalInZone(Date.parse(item.startsAt), item.timezone),
  )
  const [end, setEnd] = useState(() =>
    formatUtcMsAsDatetimeLocalInZone(Date.parse(item.endsAt), item.timezone),
  )
  const [busy, setBusy] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)

  const spacePath = `/play/${encodeURIComponent(item.playSpaceSlug)}`
  const spaceUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${spacePath}` : spacePath
  const gcal = buildGoogleCalendarUrl({
    title: item.title,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    description: [item.subtitle, `Play space: ${item.playSpaceTitle}`].filter(Boolean).join('\n'),
    location: item.location ?? item.playSpaceTitle,
    eventPageUrl: spaceUrl,
  })

  const upcoming = isUpcoming(item)
  const isScene = item.kind === 'dancecard_scene_booking'
  const isBlock = item.kind === 'dancecard_manual'
  const isProgram = item.kind === 'dancecard_slot_signup'
  const canReschedule = upcoming && (isScene || isBlock)
  const canCancelScene = upcoming && isScene && Boolean(item.sourceId)
  const canRemove = isBlock || isProgram

  function downloadItemIcs() {
    const ics = buildSingleEventIcs({
      uid: `${item.id}@dancecard.kink.social`,
      title: item.title,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      description: [item.subtitle, `Play space: ${item.playSpaceTitle}`].filter(Boolean).join('\n'),
      location: item.location ?? item.playSpaceTitle,
      url: spaceUrl,
    })
    const safe = item.title.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'session'
    downloadIcsFile(`${safe}.ics`, ics)
  }

  async function cancelScene() {
    if (!item.sourceId) return
    if (
      !(await confirm(
        'Cancel this scene?',
        'Both you and the other person will lose this reservation.',
        { destructive: true, confirmLabel: 'Cancel scene' },
      ))
    ) {
      return
    }
    setBusy(true)
    setLocalErr(null)
    try {
      const r = await fetch(
        `${apiBase(item.playSpaceSlug)}/dancecard/booking-requests/${encodeURIComponent(item.sourceId)}/cancel`,
        { method: 'POST', credentials: 'include' },
      )
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setLocalErr(typeof j.error === 'string' ? j.error : 'Could not cancel scene')
        return
      }
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function removeEntry() {
    const title = isProgram ? 'Remove from your dancecard?' : 'Remove this busy block?'
    const body =
      isProgram ?
        'This does not cancel the program — it only clears it from your personal schedule.'
      : 'It will no longer appear on your dancecard.'
    if (
      !(await confirm(title, body, {
        destructive: true,
        confirmLabel: isProgram ? 'Remove' : 'Remove block',
      }))
    ) {
      return
    }
    setBusy(true)
    setLocalErr(null)
    try {
      const entryId = dancecardEntryIdForApi(item.id)
      const r = await fetch(
        `${apiBase(item.playSpaceSlug)}/dancecard/entries/${encodeURIComponent(entryId)}`,
        { method: 'DELETE', credentials: 'include' },
      )
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string }
        setLocalErr(typeof j.error === 'string' ? j.error : 'Could not remove')
        return
      }
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function saveReschedule() {
    const startMs = parseDatetimeLocalInZone(start, item.timezone)
    const endMs = parseDatetimeLocalInZone(end, item.timezone)
    if (startMs == null || endMs == null || endMs <= startMs) {
      setLocalErr('Pick a valid start and end time.')
      return
    }
    setBusy(true)
    setLocalErr(null)
    try {
      if (isScene) {
        if (!item.sourceId) {
          setLocalErr('Missing booking id — open the play space dancecard to reschedule.')
          return
        }
        const r = await fetch(
          `${apiBase(item.playSpaceSlug)}/dancecard/booking-requests/${encodeURIComponent(item.sourceId)}`,
          {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              startsAt: new Date(startMs).toISOString(),
              endsAt: new Date(endMs).toISOString(),
            }),
          },
        )
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          setLocalErr(typeof j.error === 'string' ? j.error : 'Could not reschedule')
          return
        }
      } else if (isBlock) {
        const entryId = dancecardEntryIdForApi(item.id)
        const r = await fetch(
          `${apiBase(item.playSpaceSlug)}/dancecard/entries/${encodeURIComponent(entryId)}`,
          {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              startsAt: new Date(startMs).toISOString(),
              endsAt: new Date(endMs).toISOString(),
            }),
          },
        )
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string }
          setLocalErr(typeof j.error === 'string' ? j.error : 'Could not reschedule')
          return
        }
      }
      setPanel('none')
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded-2xl border border-dc-border bg-dc-elevated p-3.5 shadow-[var(--dc-shadow-soft)]">
      <div className="min-w-0">
        <p className="text-base font-semibold leading-snug text-dc-text">{item.title}</p>
        <p className="mt-1 text-sm text-dc-text-muted">
          {formatTimeRange(item.startsAt, item.endsAt, item.timezone)}
          {item.location?.trim() ? ` · ${item.location.trim()}` : ''}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-md border border-dc-border bg-dc-elevated-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dc-muted">
            {kindLabel(item.kind)}
          </span>
          <Link
            to={spacePath}
            className="rounded-md border border-dc-border/80 px-2 py-0.5 text-[10px] font-medium text-dc-muted hover:border-dc-accent/40 hover:text-dc-text"
          >
            {item.playSpaceTitle}
          </Link>
        </div>
        {item.subtitle ?
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-dc-text-muted">{item.subtitle}</p>
        : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <a
          href={gcal}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-dc-border bg-dc-elevated-muted px-2 text-center text-sm font-semibold text-dc-text hover:bg-dc-elevated-hover"
        >
          Google Cal
        </a>
        <button
          type="button"
          onClick={downloadItemIcs}
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-dc-border bg-dc-elevated-muted px-2 text-center text-sm font-semibold text-dc-text hover:bg-dc-elevated-hover"
        >
          iCal
        </button>
      </div>

      {upcoming && (canCancelScene || canRemove || canReschedule) ?
        <div className="mt-2 grid grid-cols-2 gap-2">
          {canCancelScene ?
            <button
              type="button"
              disabled={busy}
              onClick={() => void cancelScene()}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-dc-danger-border bg-transparent px-2 text-sm font-semibold text-dc-danger disabled:opacity-50"
            >
              Cancel
            </button>
          : null}
          {canRemove ?
            <button
              type="button"
              disabled={busy}
              onClick={() => void removeEntry()}
              className={`inline-flex min-h-10 items-center justify-center rounded-xl border border-dc-danger-border bg-transparent px-2 text-sm font-semibold text-dc-danger disabled:opacity-50 ${
                !canReschedule ? 'col-span-2' : ''
              }`}
            >
              {isProgram ? 'Remove from dancecard' : 'Remove'}
            </button>
          : null}
          {canReschedule ?
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setStart(formatUtcMsAsDatetimeLocalInZone(Date.parse(item.startsAt), item.timezone))
                setEnd(formatUtcMsAsDatetimeLocalInZone(Date.parse(item.endsAt), item.timezone))
                setLocalErr(null)
                setPanel((p) => (p === 'reschedule' ? 'none' : 'reschedule'))
              }}
              className={`inline-flex min-h-10 items-center justify-center rounded-xl px-2 text-sm font-semibold disabled:opacity-50 ${
                panel === 'reschedule' ?
                  'border border-dc-accent bg-dc-accent-muted text-dc-accent-hover'
                : 'bg-dc-accent text-dc-accent-foreground hover:bg-dc-accent-hover'
              } ${!canCancelScene && !canRemove ? 'col-span-2' : ''}`}
            >
              {panel === 'reschedule' ? 'Close' : 'Reschedule'}
            </button>
          : null}
        </div>
      : null}

      {isProgram && upcoming ?
        <p className="mt-2 text-[11px] leading-snug text-dc-muted">
          Program from the space — remove clears your dancecard only.
        </p>
      : null}

      {panel === 'reschedule' ?
        <div className="mt-3 space-y-2 rounded-xl border border-dc-border bg-dc-surface-muted/60 p-3">
          <label className="block text-xs font-semibold text-dc-muted">
            Start
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-dc-border bg-dc-elevated px-3 text-sm text-dc-text"
            />
          </label>
          <label className="block text-xs font-semibold text-dc-muted">
            End
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-dc-border bg-dc-elevated px-3 text-sm text-dc-text"
            />
          </label>
          <p className="text-[11px] text-dc-muted">Times use {item.timezone}.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveReschedule()}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-dc-accent text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save new time'}
          </button>
        </div>
      : null}

      {localErr ?
        <p className="mt-2 text-xs text-dc-danger" role="alert">
          {localErr}
        </p>
      : null}
    </li>
  )
}

export default function PlayMySchedulePage() {
  const { isAuthenticated, status: authStatus } = useAuth()
  const { confirm, confirmDialog } = useConfirm()
  const [range, setRange] = useState<ScheduleRange>('upcoming')
  const [space, setSpace] = useState<string>('')
  const [exportsOpen, setExportsOpen] = useState(false)

  const theme = getAppearancePreset(PLAY_SURFACE_APPEARANCE)
  const themeStyle = appearanceVarsToStyle(theme.vars, theme.mode)

  const schedule = useMyPlaySchedule({
    range,
    space: space || undefined,
    enabled: authStatus === 'ready' && isAuthenticated,
  })

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; items: MyScheduleItem[] }>()
    for (const it of schedule.items) {
      const key = `${it.playSpaceSlug}:${dayKey(it.startsAt, it.timezone)}`
      const label = formatDayHeading(it.startsAt, it.timezone)
      if (!map.has(key)) map.set(key, { label, items: [] })
      map.get(key)!.items.push(it)
    }
    return [...map.entries()].map(([key, v]) => ({ key, ...v }))
  }, [schedule.items])

  const icsHref = scheduleExportUrl('ics', { range, space: space || undefined })
  const csvHref = scheduleExportUrl('csv', {
    range: range === 'upcoming' ? 'all' : range,
    space: space || undefined,
  })

  if (authStatus === 'ready' && !isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center text-dc-text">
        <h1 className="font-serif text-2xl">My schedule</h1>
        <p className="mt-2 text-sm text-dc-muted">Sign in to see sessions on your dancecard and export them.</p>
        <Link
          to={buildLoginHref('/play/schedule')}
          className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground"
        >
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <div
      className="dc-gold-chrome mx-auto max-w-2xl px-3 pb-28 pt-4 text-dc-text sm:px-4 sm:py-8 sm:pb-8"
      data-dc-appearance={PLAY_SURFACE_APPEARANCE}
      data-dc-theme="event"
      style={themeStyle as CSSProperties}
    >
      {confirmDialog}
      <header className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dc-accent">Dancecard</p>
        <h1 className="mt-1 font-serif text-3xl text-dc-text">My schedule</h1>
        <p className="mt-1 text-sm text-dc-muted">
          Your scenes, blocks, and program across play spaces — export or manage from here.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ['upcoming', 'Upcoming'],
            ['past', 'Past'],
            ['all', 'All'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setRange(id)}
            className={`min-h-11 rounded-xl px-3.5 text-sm font-semibold ${
              range === id ?
                'bg-dc-accent text-dc-accent-foreground'
              : 'border border-dc-border bg-dc-elevated text-dc-muted hover:text-dc-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {schedule.spaces.length > 1 ?
        <label className="mb-4 block text-xs font-semibold uppercase tracking-wide text-dc-muted">
          Play space
          <select
            value={space}
            onChange={(e) => setSpace(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border border-dc-border bg-dc-surface-muted px-3 text-sm text-dc-text"
          >
            <option value="">All spaces</option>
            {schedule.spaces.map((s) => (
              <option key={s.id} value={s.slug}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
      : null}

      {schedule.status === 'loading' && schedule.items.length === 0 ?
        <p className="text-sm text-dc-muted">Loading schedule…</p>
      : null}
      {schedule.status === 'error' ?
        <p className="text-sm text-dc-danger" role="alert">
          {schedule.errorMessage}
        </p>
      : null}

      {schedule.status === 'ready' && schedule.items.length === 0 ?
        <div className="rounded-2xl border border-dashed border-dc-border bg-dc-elevated/50 px-4 py-8 text-center">
          <p className="text-sm text-dc-muted">
            {range === 'upcoming' ?
              'Nothing upcoming on your dancecards yet.'
            : 'No items in this view.'}
          </p>
          <Link
            to="/play"
            className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground"
          >
            Browse play spaces
          </Link>
        </div>
      : null}

      <div className="space-y-5">
        {grouped.map((group) => (
          <section key={group.key} className="space-y-2">
            <h2 className="inline-flex min-h-9 items-center rounded-lg bg-dc-accent px-2.5 text-sm font-semibold text-dc-accent-foreground">
              {group.label}
            </h2>
            <ul className="space-y-2.5">
              {group.items.map((it) => (
                <ScheduleItemCard
                  key={it.id}
                  item={it}
                  onChanged={schedule.reload}
                  confirm={confirm}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-8 hidden gap-2 sm:flex sm:flex-wrap">
        <a
          href={icsHref}
          className="inline-flex min-h-11 items-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
        >
          Download iCal
        </a>
        <a
          href={csvHref}
          className="inline-flex min-h-11 items-center rounded-xl border border-dc-border bg-dc-elevated px-4 text-sm font-semibold text-dc-text hover:border-dc-accent/50"
        >
          Export CSV (Sheets)
        </a>
        <p className="w-full text-xs text-dc-muted">
          Full-schedule iCal for Apple Calendar, Outlook, or Google Calendar → Import. CSV opens in Sheets.
        </p>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-dc-border bg-dc-elevated/95 backdrop-blur-md safe-area-pb c2k-fixed-above-bottom-nav sm:hidden">
        {exportsOpen ?
          <div className="space-y-2 border-b border-dc-border px-4 py-3">
            <a
              href={icsHref}
              className="flex min-h-11 items-center justify-center rounded-xl bg-dc-accent text-sm font-semibold text-dc-accent-foreground"
            >
              Download full iCal (.ics)
            </a>
            <a
              href={csvHref}
              className="flex min-h-11 items-center justify-center rounded-xl border border-dc-border bg-dc-surface-muted text-sm font-semibold text-dc-text"
            >
              Export CSV for Sheets
            </a>
            <p className="text-[11px] leading-snug text-dc-muted">
              Or use Google Cal / iCal on each session above.
            </p>
          </div>
        : null}
        <div className="flex gap-2 px-4 py-2.5">
          <button
            type="button"
            onClick={() => setExportsOpen((v) => !v)}
            className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-dc-accent text-sm font-semibold text-dc-accent-foreground"
          >
            {exportsOpen ? 'Close exports' : 'Export schedule'}
          </button>
          <button
            type="button"
            onClick={() => schedule.reload()}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dc-border px-3 text-sm font-semibold text-dc-text"
            aria-label="Refresh schedule"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  )
}
