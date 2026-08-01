import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import TabButton from '@/components/ui/TabButton'
import PlaceholderAvatar from '@/components/PlaceholderAvatar'
import type { ScheduleSlot, SlotPresenter } from './convention-schedule-types'
import { trackTintWashClass } from './track-accent'
import SchedulePersonChip from './SchedulePersonChip'

const ALL_DAYS_KEY = '__all__'

export type ScheduleLayout = 'cards' | 'time-list'

function groupSlotsByStartTime(slots: ScheduleSlot[]): { startIso: string; slots: ScheduleSlot[] }[] {
  const sorted = [...slots].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  const out: { startIso: string; slots: ScheduleSlot[] }[] = []
  for (const s of sorted) {
    const last = out[out.length - 1]
    if (last && last.startIso === s.startsAt) last.slots.push(s)
    else out.push({ startIso: s.startsAt, slots: [s] })
  }
  return out
}

function formatTimeHeading(startIso: string, timeZone: string): string {
  const d = new Date(startIso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone })
}

function formatDuration(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const min = Math.round(ms / 60000)
  if (min >= 120) {
    const h = Math.floor(min / 60)
    const m = min % 60
    return m ? `${h} hr ${m} min` : `${h} hr`
  }
  if (min >= 60) {
    const h = 1
    const m = min - 60
    return m ? `${h} hr ${m} min` : `${h} hr`
  }
  return `${min} min`
}

function dayTabShortLabel(firstSlotStartsAt: string | undefined, timeZone: string): string {
  if (!firstSlotStartsAt) return ''
  const d = new Date(firstSlotStartsAt)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' })
}

/** Matches {@link SchedulePersonChip} with `variant="presenter"` (always program presenter profile route). */
function presenterProfileHref(p: SlotPresenter): string {
  return `/presenters/${encodeURIComponent(p.username)}`
}

function VendorIconLink({
  vendorSlug,
  contextLabel,
  compact,
}: {
  vendorSlug: string
  contextLabel: string
  /** Slightly smaller hit target when embedded in a text row. */
  compact?: boolean
}) {
  const box = compact ? 'h-9 w-9 min-h-9 min-w-9' : 'h-11 w-11'
  return (
    <Link
      to={`/vendors/${encodeURIComponent(vendorSlug.trim())}`}
      className={`inline-flex ${box} shrink-0 items-center justify-center rounded-lg text-dc-muted transition-colors hover:bg-white/[0.06] hover:text-dc-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dc-accent`}
      aria-label={`Vendor shop for ${contextLabel}`}
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    </Link>
  )
}

function PropertyPills({
  trackLabel,
  roomLabel,
  location,
}: {
  trackLabel?: string | null
  roomLabel?: string | null
  location?: string | null
}) {
  const pills: { key: string; text: string }[] = []
  if (trackLabel?.trim()) pills.push({ key: 'track', text: trackLabel.trim() })
  if (roomLabel?.trim()) pills.push({ key: 'room', text: roomLabel.trim() })
  if (location?.trim()) pills.push({ key: 'loc', text: location.trim() })
  if (pills.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1.5" role="list" aria-label="Session details">
      {pills.map((p) => (
        <span
          key={p.key}
          role="listitem"
          className="inline-flex max-w-full items-center rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-dc-text-muted transition-colors motion-safe:duration-150 hover:bg-white/[0.09] hover:text-dc-text/90"
        >
          <span className="truncate">{p.text}</span>
        </span>
      ))}
    </div>
  )
}

function PresenterFacepile({ presenters }: { presenters: SlotPresenter[] }) {
  if (presenters.length === 0) return null

  const maxAvatars = 4
  const shown = presenters.slice(0, maxAvatars)
  const overflowAvatar = Math.max(0, presenters.length - maxAvatars)

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex shrink-0 items-center -space-x-1.5">
          {shown.map((p, i) => {
            const label = p.displayName?.trim() || p.username
            return (
              <Link
                key={p.userId}
                to={presenterProfileHref(p)}
                style={{ zIndex: i + 1 }}
                title={label}
                aria-label={`${label}, presenter profile`}
                className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-full ring-2 ring-[var(--dc-surface-card)] transition-[opacity,box-shadow,transform] motion-safe:duration-150 hover:opacity-100 hover:shadow-md hover:ring-dc-accent/40 motion-safe:hover:scale-[1.04] focus-visible:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dc-accent motion-reduce:hover:scale-100"
              >
                {p.avatarUrl ?
                  <img src={p.avatarUrl} alt="" width={28} height={28} loading="lazy" decoding="async" className="h-7 w-7 rounded-full object-cover" />
                : <PlaceholderAvatar size="sm" className="!h-7 !w-7 !min-h-[1.75rem] !min-w-[1.75rem] !rounded-full [&>svg]:!h-3.5 [&>svg]:!w-3.5" />}
              </Link>
            )
          })}
          {overflowAvatar > 0 ?
            <span
              className="relative z-[6] flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-white/[0.08] px-1 text-[10px] font-semibold tabular-nums text-dc-text-muted ring-2 ring-[var(--dc-surface-card)]"
              aria-label={`${overflowAvatar} more presenters not shown as avatars`}
            >
              +{overflowAvatar}
            </span>
          : null}
        </div>
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-dc-text-muted">
          {presenters.map((p, i) => {
            const label = p.displayName?.trim() || p.username
            const slug = p.vendorSlug?.trim()
            return (
              <span key={p.userId} className="inline-flex flex-wrap items-center align-middle">
                {i > 0 ?
                  <span className="text-dc-muted" aria-hidden>
                    {' '}
                    ·{' '}
                  </span>
                : null}
                <Link
                  to={presenterProfileHref(p)}
                  className="font-medium text-dc-text/90 underline-offset-2 hover:text-dc-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dc-accent"
                >
                  {label}
                </Link>
                {slug ?
                  <VendorIconLink vendorSlug={slug} contextLabel={label} compact />
                : null}
              </span>
            )
          })}
        </p>
      </div>
    </div>
  )
}

function SessionMaterials({ materials }: { materials: NonNullable<ScheduleSlot['materials']> }) {
  if (materials.length === 0) return null

  const linkClass =
    'inline-flex min-h-11 items-center rounded-lg px-2 text-sm text-dc-accent underline-offset-2 transition-colors motion-safe:duration-150 hover:bg-dc-accent/10 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dc-accent active:bg-dc-accent/15'

  if (materials.length <= 2) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {materials.map((m) => (
          <a key={m.id} href={m.url} className={linkClass}>
            {m.title}
          </a>
        ))}
      </div>
    )
  }

  const [first, second, ...rest] = materials
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <a href={first!.url} className={linkClass}>
        {first!.title}
      </a>
      <a href={second!.url} className={linkClass}>
        {second!.title}
      </a>
      <details className="relative min-h-11">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg px-2 text-sm font-medium text-dc-text-muted marker:content-none transition-colors motion-safe:duration-150 hover:bg-white/[0.06] hover:text-dc-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dc-accent active:bg-white/[0.08] [&::-webkit-details-marker]:hidden">
          More materials
          <span className="ml-1.5 tabular-nums text-dc-muted">({rest.length})</span>
        </summary>
        <ul className="absolute left-0 top-full z-20 mt-1 min-w-[12rem] rounded-xl border border-dc-border bg-dc-elevated-solid py-1 shadow-lg">
          {rest.map((m) => (
            <li key={m.id}>
              <a href={m.url} className="block px-3 py-2 text-sm text-dc-accent hover:bg-white/[0.06]">
                {m.title}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

function SessionBlock({
  slot,
  onAddToDancecard,
  showDancecard,
  timeZone,
}: {
  slot: ScheduleSlot
  onAddToDancecard: (slotId: string) => void
  showDancecard: boolean
  timeZone: string
}) {
  const [descOpen, setDescOpen] = useState(false)
  const wash = trackTintWashClass(slot.trackLabel)
  const timeStart = new Date(slot.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone })
  const timeEnd = new Date(slot.endsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone })
  const duration = formatDuration(slot.startsAt, slot.endsAt)
  const desc = slot.description?.trim() ?? ''
  const descLong = desc.length > 220

  return (
    <li
      id={`conv-slot-${slot.id}`}
      className="relative scroll-mt-28 rounded-2xl border border-white/[0.07] bg-dc-elevated/95 shadow-[var(--dc-shadow-soft)] transition-[border-color,box-shadow,transform] motion-safe:duration-200 hover:border-white/[0.14] hover:shadow-lg motion-safe:hover:-translate-y-px focus-within:border-white/[0.14] focus-within:ring-1 focus-within:ring-dc-accent/30 motion-reduce:hover:translate-y-0"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden>
        <div className={`absolute inset-0 opacity-[0.11] ${wash}`} />
      </div>
      <div className="relative z-[1] px-3 py-3 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-2 md:grid md:grid-cols-[minmax(0,6.25rem)_1fr] md:items-start md:gap-x-6 md:gap-y-3">
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-dc-border-subtle pb-2 md:flex-col md:items-start md:gap-1 md:border-b-0 md:border-r md:border-dc-border-subtle md:pb-0 md:pr-6">
            <p className="text-[11px] font-medium tabular-nums text-dc-muted">
              <time dateTime={slot.startsAt}>
                {timeStart} – {timeEnd}
              </time>
            </p>
            {duration ?
              <p className="text-[11px] tabular-nums text-dc-muted/90">{duration}</p>
            : null}
          </div>

          <div className="min-w-0 space-y-0">
            <h4 className="dc-session-title text-base font-semibold leading-snug tracking-tight md:-mt-0.5">{slot.title}</h4>

            {slot.presenters.length > 0 ?
              <PresenterFacepile presenters={slot.presenters} />
            : null}

            {(slot.staff ?? []).length > 0 ?
              <div className="mt-3 border-t border-dashed border-white/[0.08] pt-3">
                <p className="text-[10px] font-normal normal-case tracking-normal text-dc-muted/85">Staff &amp; ops</p>
                <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1">
                  {(slot.staff ?? []).map((st) => (
                    <SchedulePersonChip
                      key={st.id}
                      variant="staff"
                      density="compact"
                      username={st.username}
                      displayName={st.displayName}
                      avatarUrl={st.avatarUrl}
                      vendorSlug={st.vendorSlug}
                      presenterPublic={st.presenterPublic}
                      roleLabel={st.roleLabel}
                      station={st.station}
                    />
                  ))}
                </div>
              </div>
            : null}

            <PropertyPills trackLabel={slot.trackLabel} roomLabel={slot.roomLabel} location={slot.location} />

            {slot.presenterOffering ?
              <p className="mt-2 text-xs text-dc-muted">
                From catalog:{' '}
                <Link
                  to={`/presenters/${encodeURIComponent(slot.presenterOffering.ownerUsername)}`}
                  className="font-medium text-dc-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dc-accent"
                >
                  {slot.presenterOffering.title}
                </Link>
              </p>
            : null}

            {desc ?
              <div className="mt-2">
                <p
                  className={`text-sm leading-relaxed text-dc-text-muted ${
                    descOpen ? '' : 'line-clamp-2 md:line-clamp-3'
                  }`}
                >
                  {desc}
                </p>
                {(descLong || desc.length > 90) && !descOpen ?
                  <button
                    type="button"
                    className="mt-1 min-h-11 rounded-lg px-2 text-left text-sm font-medium text-dc-accent hover:underline"
                    onClick={() => setDescOpen(true)}
                    aria-expanded={false}
                  >
                    More
                  </button>
                : null}
                {descOpen ?
                  <button
                    type="button"
                    className="mt-1 min-h-11 rounded-lg px-2 text-left text-sm font-medium text-dc-accent hover:underline"
                    onClick={() => setDescOpen(false)}
                    aria-expanded
                  >
                    Show less
                  </button>
                : null}
              </div>
            : null}

            <div className="mt-4 flex flex-col gap-3 border-t border-dc-border-subtle pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                {showDancecard ?
                  <button
                    type="button"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground shadow-sm transition-[background-color,box-shadow,transform] motion-safe:duration-150 hover:bg-dc-accent-hover hover:shadow-md motion-safe:hover:-translate-y-px active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dc-accent motion-reduce:hover:translate-y-0 sm:w-auto"
                    onClick={() => onAddToDancecard(slot.id)}
                  >
                    Add to dancecard
                  </button>
                : null}
                {slot.linkUrl ?
                  <a
                    href={slot.linkUrl}
                    className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-dc-text-muted underline-offset-2 transition-colors motion-safe:duration-150 hover:bg-white/[0.06] hover:text-dc-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dc-accent active:bg-white/[0.08]"
                    target="_blank"
                    rel="noreferrer"
                  >
                    External details
                  </a>
                : null}
              </div>
              {slot.materials && slot.materials.length > 0 ?
                <SessionMaterials materials={slot.materials} />
              : null}
            </div>
          </div>
        </div>
      </div>
    </li>
  )
}

function CompactSlotRow({
  slot,
  onAddToDancecard,
  showDancecard,
}: {
  slot: ScheduleSlot
  onAddToDancecard: (slotId: string) => void
  showDancecard: boolean
}) {
  const [open, setOpen] = useState(false)
  const desc = slot.description?.trim() ?? ''
  const duration = formatDuration(slot.startsAt, slot.endsAt)
  const metaBits = [
    duration,
    slot.trackLabel?.trim(),
    slot.roomLabel?.trim(),
    slot.location?.trim(),
  ].filter(Boolean) as string[]
  const presenterLine = slot.presenters
    .slice(0, 4)
    .map((p) => p.displayName?.trim() || p.username)
    .join(' · ')
  const overflow = Math.max(0, slot.presenters.length - 4)
  const actionCount = (desc ? 1 : 0) + (showDancecard ? 1 : 0) + (slot.linkUrl ? 1 : 0)

  return (
    <li
      id={`conv-slot-${slot.id}`}
      className="scroll-mt-28 rounded-xl border border-dc-border bg-dc-elevated p-3 shadow-[var(--dc-shadow-soft)]"
    >
      <div className="min-w-0">
        <p className="dc-session-title text-base font-semibold leading-snug text-dc-text">{slot.title}</p>
        {metaBits.length > 0 ?
          <p className="mt-1 text-xs leading-snug text-dc-muted">{metaBits.join(' · ')}</p>
        : null}
        {presenterLine ?
          <p className="mt-1 text-xs leading-snug text-dc-text-muted">
            {presenterLine}
            {overflow > 0 ? <span className="text-dc-muted"> · +{overflow}</span> : null}
          </p>
        : null}
        {open && desc ?
          <p className="mt-2 whitespace-pre-wrap rounded-lg border border-dc-border/70 bg-dc-surface-muted/80 px-2.5 py-2 text-xs leading-relaxed text-dc-text-muted">
            {desc}
          </p>
        : null}
      </div>

      {actionCount > 0 ?
        <div
          className={`mt-3 grid gap-2 ${
            actionCount === 1 ? 'grid-cols-1' : actionCount === 2 ? 'grid-cols-2' : 'grid-cols-3'
          }`}
        >
          {desc ?
            <button
              type="button"
              className={`inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-semibold transition-colors ${
                open ?
                  'bg-dc-accent text-dc-accent-foreground'
                : 'border border-dc-border bg-dc-surface-muted text-dc-text hover:border-dc-accent/50 hover:bg-dc-accent-muted'
              }`}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? 'Hide' : 'Description'}
            </button>
          : null}
          {showDancecard ?
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-2.5 text-sm font-semibold leading-tight text-dc-accent-foreground hover:bg-dc-accent-hover sm:px-3"
              onClick={() => onAddToDancecard(slot.id)}
            >
              Add to dancecard
            </button>
          : null}
          {slot.linkUrl ?
            <a
              href={slot.linkUrl}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dc-border bg-dc-surface-muted px-3 text-sm font-semibold text-dc-text hover:border-dc-accent/50"
              target="_blank"
              rel="noreferrer"
            >
              Link
            </a>
          : null}
        </div>
      : null}
    </li>
  )
}

function CompactDaySchedule({
  items,
  onAddToDancecard,
  showDancecard,
  timeZone,
}: {
  items: ScheduleSlot[]
  onAddToDancecard: (slotId: string) => void
  showDancecard: boolean
  timeZone: string
}) {
  const buckets = useMemo(() => groupSlotsByStartTime(items), [items])
  if (buckets.length === 0) return <p className="text-sm text-dc-muted">No sessions this day.</p>

  return (
    <div className="space-y-4">
      {buckets.map(({ startIso, slots }) => (
        <section key={startIso} aria-labelledby={`conv-time-${slots[0]!.id}`} className="space-y-2">
          <div className="flex items-center gap-2">
            <h4
              id={`conv-time-${slots[0]!.id}`}
              className="inline-flex min-h-9 items-center rounded-lg bg-dc-accent px-2.5 text-sm font-semibold tabular-nums text-dc-accent-foreground"
            >
              {formatTimeHeading(startIso, timeZone)}
            </h4>
            {slots.length > 1 ?
              <span className="text-[11px] text-dc-muted">
                {slots.length} sessions
              </span>
            : null}
          </div>
          <ul className="space-y-2">
            {slots.map((s) => (
              <CompactSlotRow key={s.id} slot={s} onAddToDancecard={onAddToDancecard} showDancecard={showDancecard} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export default function ConventionScheduleAgenda({
  slotsByDay,
  timezone,
  onAddToDancecard,
  programLayout: programLayoutProp,
  onProgramLayoutChange,
  showDancecard = true,
}: {
  slotsByDay: { day: string; items: ScheduleSlot[] }[]
  timezone: string
  onAddToDancecard: (slotId: string) => void
  /** When set, layout is controlled (e.g. from `?programView=list` on the convention page). */
  programLayout?: ScheduleLayout
  onProgramLayoutChange?: (layout: ScheduleLayout) => void
  /** Hide convention dancecard actions (e.g. read-only external calendars). */
  showDancecard?: boolean
}) {
  const [selectedDay, setSelectedDay] = useState(() => slotsByDay[0]?.day ?? '')
  const [internalLayout, setInternalLayout] = useState<ScheduleLayout>('cards')
  const layoutControlled = programLayoutProp !== undefined
  const layout = layoutControlled ? programLayoutProp! : internalLayout
  const setLayout = useCallback(
    (next: ScheduleLayout) => {
      onProgramLayoutChange?.(next)
      if (!layoutControlled) setInternalLayout(next)
    },
    [layoutControlled, onProgramLayoutChange],
  )
  const tablistRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (slotsByDay.length === 0) return
    if (selectedDay === ALL_DAYS_KEY) return
    if (!selectedDay || !slotsByDay.some((d) => d.day === selectedDay)) {
      setSelectedDay(slotsByDay[0]!.day)
    }
  }, [slotsByDay, selectedDay])

  const active = useMemo(() => slotsByDay.find((d) => d.day === selectedDay), [slotsByDay, selectedDay])

  const activeTabLabelId = useMemo(() => {
    if (selectedDay === ALL_DAYS_KEY) return 'conv-schedule-tab-all'
    const i = slotsByDay.findIndex((d) => d.day === selectedDay)
    return i >= 0 ? `conv-schedule-tab-${i}` : undefined
  }, [selectedDay, slotsByDay])

  const focusTabByIndex = useCallback(
    (idx: number) => {
      const root = tablistRef.current
      if (!root) return
      const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      const len = tabs.length
      if (len === 0) return
      const i = ((idx % len) + len) % len
      tabs[i]?.focus()
    },
    [],
  )

  const onTabListKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const root = tablistRef.current
      if (!root) return
      const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      const currentIndex = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true')
      if (currentIndex < 0) return

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        focusTabByIndex(currentIndex + 1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        focusTabByIndex(currentIndex - 1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        focusTabByIndex(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        focusTabByIndex(tabs.length - 1)
      }
    },
    [focusTabByIndex],
  )

  if (slotsByDay.length === 0) {
    return <p className="text-sm text-dc-muted">No schedule slots yet.</p>
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-[6.75rem] z-10 -mx-1 border-b border-dc-border-subtle bg-dc-elevated-solid/90 px-1 pb-2 pt-0.5 backdrop-blur-md supports-[backdrop-filter]:bg-dc-elevated-solid/75 md:top-0 md:pb-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="hidden text-[11px] font-medium uppercase tracking-wide text-dc-muted md:block">
            Program days
          </p>
          <nav
            className="flex shrink-0 flex-wrap items-center justify-end gap-1"
            role="tablist"
            aria-label="Program layout"
          >
            <TabButton
              label="Cards"
              size="small"
              isActive={layout === 'cards'}
              onClick={() => setLayout('cards')}
            />
            <TabButton
              label="Time list"
              size="small"
              isActive={layout === 'time-list'}
              onClick={() => setLayout('time-list')}
            />
          </nav>
        </div>
        <div
          ref={tablistRef}
          className="mt-2 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Select program day"
          onKeyDown={onTabListKeyDown}
        >
          <button
            type="button"
            role="tab"
            id="conv-schedule-tab-all"
            aria-selected={selectedDay === ALL_DAYS_KEY}
            aria-controls="conv-schedule-panel"
            className={`snap-start shrink-0 min-h-11 rounded-xl px-3 py-2 text-left transition-[background-color,box-shadow,color,transform] motion-safe:duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dc-accent active:scale-[0.99] motion-reduce:active:scale-100 ${
              selectedDay === ALL_DAYS_KEY ?
                'bg-dc-accent text-dc-accent-foreground shadow-sm'
              : 'border border-dc-border bg-dc-elevated text-dc-text-muted hover:border-dc-accent/40 hover:text-dc-text'
            }`}
            onClick={() => setSelectedDay(ALL_DAYS_KEY)}
          >
            <span
              className={`block text-sm font-semibold leading-tight ${
                selectedDay === ALL_DAYS_KEY ? 'text-dc-accent-foreground' : 'text-dc-text'
              }`}
            >
              All days
            </span>
            <span
              className={`mt-0.5 block text-[10px] font-normal ${
                selectedDay === ALL_DAYS_KEY ? 'text-dc-accent-foreground/80' : 'text-dc-muted'
              }`}
            >
              {slotsByDay.reduce((n, d) => n + d.items.length, 0)} sessions
            </span>
            <span className="sr-only">Full program, all days combined</span>
          </button>
          {slotsByDay.map(({ day, items }, dayIndex) => {
            const selected = day === selectedDay
            const short = dayTabShortLabel(items[0]?.startsAt, timezone)
            return (
              <button
                key={day}
                type="button"
                role="tab"
                id={`conv-schedule-tab-${dayIndex}`}
                aria-selected={selected}
                aria-label={`${day}, ${items.length} session${items.length === 1 ? '' : 's'}`}
                aria-controls={selected ? 'conv-schedule-panel' : undefined}
                className={`snap-start shrink-0 min-h-11 min-w-[4.75rem] rounded-xl px-3 py-2 text-left transition-[background-color,box-shadow,color,transform] motion-safe:duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dc-accent active:scale-[0.99] motion-reduce:active:scale-100 ${
                  selected ?
                    'bg-dc-accent text-dc-accent-foreground shadow-sm'
                  : 'border border-dc-border bg-dc-elevated text-dc-text-muted hover:border-dc-accent/40 hover:text-dc-text'
                }`}
                onClick={() => setSelectedDay(day)}
              >
                <span
                  className={`block text-sm font-semibold leading-tight ${
                    selected ? 'text-dc-accent-foreground' : 'text-dc-text'
                  }`}
                >
                  {short || 'Day'}
                </span>
                <span
                  className={`mt-0.5 block text-[10px] font-normal ${
                    selected ? 'text-dc-accent-foreground/80' : 'text-dc-muted'
                  }`}
                >
                  {items.length} session{items.length === 1 ? '' : 's'}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 hidden text-xs text-dc-muted md:block">
          All session times are shown in <span className="text-dc-text-muted">{timezone}</span>.
        </p>
      </div>

      <div id="conv-schedule-panel" role="tabpanel" aria-labelledby={activeTabLabelId}>
        {selectedDay === ALL_DAYS_KEY ?
          <div className="space-y-10">
            {slotsByDay.map(({ day, items }, dayIndex) => (
              <section key={day} aria-labelledby={`conv-sched-section-${dayIndex}`}>
                <h3 id={`conv-sched-section-${dayIndex}`} className="border-b border-dc-border-subtle pb-2 text-sm font-semibold text-dc-text-muted">
                  {day}
                </h3>
                {layout === 'cards' ?
                  <ol className="mt-4 space-y-4">
                    {items.map((s) => (
                      <SessionBlock
                        key={s.id}
                        slot={s}
                        onAddToDancecard={onAddToDancecard}
                        showDancecard={showDancecard}
                        timeZone={timezone}
                      />
                    ))}
                  </ol>
                : <div className="mt-4">
                    <CompactDaySchedule
                      items={items}
                      onAddToDancecard={onAddToDancecard}
                      showDancecard={showDancecard}
                      timeZone={timezone}
                    />
                  </div>}
              </section>
            ))}
          </div>
        : active ?
          <section aria-labelledby="conv-schedule-active-day">
            <h3 id="conv-schedule-active-day" className="sr-only">
              {active.day}
            </h3>
            {layout === 'cards' ?
              <ol className="space-y-4">
                {active.items.map((s) => (
                  <SessionBlock
                    key={s.id}
                    slot={s}
                    onAddToDancecard={onAddToDancecard}
                    showDancecard={showDancecard}
                    timeZone={timezone}
                  />
                ))}
              </ol>
            : <CompactDaySchedule
                items={active.items}
                onAddToDancecard={onAddToDancecard}
                showDancecard={showDancecard}
                timeZone={timezone}
              />}
          </section>
        : null}
      </div>
    </div>
  )
}
