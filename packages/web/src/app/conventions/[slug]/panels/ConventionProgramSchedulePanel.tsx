import { Link } from 'react-router-dom'
import { buildLoginHref } from '@/lib/auth-links'
import ConventionScheduleAgenda, { type ScheduleLayout } from '@/components/conventions/ConventionScheduleAgenda'
import DancecardScheduleEmbed from '@/components/conventions/DancecardScheduleEmbed'
import { Panel } from '@/components/dancecard/ui/Panel'
import { DancecardPanelSkeleton } from '@/components/ui/skeleton'
import type { ContributorPreview } from '@/hooks/useConventionHub'
import type { HostedByOrg } from '@/components/conventions/HostedByCard'
import type { ScheduleSlot } from '@/components/conventions/convention-schedule-types'
import type { MyScheduleItem } from '@/hooks/useConventionHub'
import SectionHeader from '@/components/ui/SectionHeader'

function ProgramPartnersStrip({ items }: { items: ContributorPreview[] }) {
  if (!items.length) return null
  return (
    <Panel variant="muted" aria-label="Program partners">
      <SectionHeader
        eyebrow="Program"
        title="Partners and supporters"
        description="Anchor contributors for this event. Presenters and crew still appear on each session."
      />
      <ul className="mt-4 flex flex-wrap gap-2">
        {items.map((c) => (
          <li key={c.id}>
            {c.vendorSlug ?
              <Link
                to={`/vendors/${encodeURIComponent(c.vendorSlug)}`}
                className="inline-flex max-w-full items-center gap-2 rounded-lg border border-dc-border bg-dc-elevated-muted px-3 py-2 text-sm text-dc-text hover:border-dc-accent-border"
              >
                <span className="text-[10px] uppercase tracking-wide text-dc-muted">{c.kind}</span>
                <span className="truncate font-medium">{c.label}</span>
              </Link>
            : c.username ?
              <Link
                to={`/profile/${encodeURIComponent(c.username)}`}
                className="inline-flex max-w-full items-center gap-2 rounded-lg border border-dc-border bg-dc-elevated-muted px-3 py-2 text-sm text-dc-text hover:border-dc-accent-border"
              >
                <span className="text-[10px] uppercase tracking-wide text-dc-muted">{c.kind}</span>
                <span className="truncate font-medium">{c.label}</span>
              </Link>
            : <span className="inline-flex max-w-full items-center gap-2 rounded-lg border border-dc-border bg-dc-elevated-muted px-3 py-2 text-sm text-dc-text-muted">
                <span className="text-[10px] uppercase tracking-wide text-dc-muted">{c.kind}</span>
                <span className="truncate font-medium text-dc-text">{c.label}</span>
              </span>
            }
          </li>
        ))}
      </ul>
    </Panel>
  )
}

type SlotsByDay = { day: string; items: ScheduleSlot[] }[]

function scheduleKindLabel(kind: string): string {
  switch (kind) {
    case 'presenting':
      return 'Presenting'
    case 'staff_slot':
      return 'Staff slot'
    case 'staff_duty':
      return 'Staff duty'
    case 'volunteer':
      return 'Volunteer'
    default:
      return kind.replace(/_/g, ' ')
  }
}

function formatScheduleWhen(startsAt: string, endsAt: string, timezone: string): string {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const dateOpts: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }
  const timeOpts: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
  }
  const sameDay = start.toLocaleDateString([], { timeZone: timezone }) === end.toLocaleDateString([], { timeZone: timezone })
  if (sameDay) {
    return `${start.toLocaleString([], { ...dateOpts, ...timeOpts })} – ${end.toLocaleTimeString([], timeOpts)}`
  }
  return `${start.toLocaleString([], { ...dateOpts, ...timeOpts })} – ${end.toLocaleString([], { ...dateOpts, ...timeOpts })}`
}

type Props = {
  encodedSlug: string
  loading: boolean
  scheduleLocked: boolean
  isAuthenticated: boolean
  anchorEventId: string | null
  organization: HostedByOrg | null
  embedScheduleUrl: string | null
  dancecardLinked: boolean
  contributorsPreview: ContributorPreview[]
  slots: ScheduleSlot[] | null
  slotsByDay: SlotsByDay
  timezone: string
  attendeeOk: boolean
  myScheduleItems: MyScheduleItem[]
  programLayout: ScheduleLayout
  onProgramLayoutChange: (layout: ScheduleLayout) => void
  onAddToDancecard: (slotId: string) => void | Promise<void>
  onOpenDancecardTab: () => void
  /** Optional follow/pin CTA for unpublished program empty state. */
  onFollowEvent?: () => void | Promise<void>
  isFollowing?: boolean
  canFollow?: boolean
}

export function ConventionScheduleLockedPanel({
  isAuthenticated,
  anchorEventId,
  organization,
}: Pick<Props, 'isAuthenticated' | 'anchorEventId' | 'organization'>) {
  return (
    <Panel>
      <SectionHeader
        eyebrow="Program"
        title="Schedule for attendees only"
        description="The organizer has not published a public program listing."
      />
      <div className="mt-4 space-y-3 text-sm text-dc-text-muted">
        {!isAuthenticated && (
          <p>
            <Link to={buildLoginHref()} className="font-medium text-dc-accent hover:underline">
              Sign in
            </Link>{' '}
            with the account that RSVP&apos;d, then return to this page.
          </p>
        )}
        {isAuthenticated && anchorEventId && (
          <p>
            Open the{' '}
            <Link
              to={`/events/${encodeURIComponent(anchorEventId)}`}
              className="font-medium text-dc-accent hover:underline"
            >
              anchor event
            </Link>{' '}
            to RSVP or check your status. After you have access, the schedule will load here.
          </p>
        )}
        {organization && (
          <p>
            Hosted by{' '}
            <Link
              to={`/orgs/${encodeURIComponent(organization.slug)}`}
              className="font-medium text-dc-accent hover:underline"
            >
              {organization.displayName}
            </Link>
            .
          </p>
        )}
      </div>
    </Panel>
  )
}

export default function ConventionProgramSchedulePanel({
  encodedSlug,
  loading,
  embedScheduleUrl,
  dancecardLinked,
  contributorsPreview,
  slots,
  slotsByDay,
  timezone,
  attendeeOk,
  myScheduleItems,
  programLayout,
  onProgramLayoutChange,
  onAddToDancecard,
  onOpenDancecardTab,
  onFollowEvent,
  isFollowing,
  canFollow,
}: Props) {
  if (loading) {
    return (
      <div className="dc-panel-enter space-y-4" aria-busy="true">
        <p className="text-sm text-dc-muted">Loading program…</p>
        <DancecardPanelSkeleton lines={5} />
      </div>
    )
  }

  const hideNativeAgenda = dancecardLinked && Boolean(embedScheduleUrl)
  const showEmptyProgram = !hideNativeAgenda && slots && slots.length === 0
  const showProgramAgenda = !hideNativeAgenda && slots && slots.length > 0

  return (
    <div className="dc-tab-content-enter space-y-6">
      {dancecardLinked ?
        <p className="text-sm text-dc-muted">
          Personal availability and compare live on the{' '}
          <button type="button" className="text-dc-accent hover:underline" onClick={onOpenDancecardTab}>
            Dancecard
          </button>{' '}
          tab.
        </p>
      : null}
      {embedScheduleUrl ? <DancecardScheduleEmbed src={embedScheduleUrl} /> : null}
      <ProgramPartnersStrip items={contributorsPreview} />
      {dancecardLinked && !embedScheduleUrl ?
        <p className="text-sm text-dc-muted">
          Add an embed token in Manage → Logistics to show the published program embed here. The Kink Social schedule below is still available.
        </p>
      : null}
      {showEmptyProgram ?
        <Panel variant="muted">
          <SectionHeader
            title="Schedule not published yet"
            description="The event schedule has not been published yet. Follow the event to receive an announcement when the program becomes available."
          />
          {canFollow && onFollowEvent ?
            <button
              type="button"
              onClick={() => void onFollowEvent()}
              className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-dc-border bg-dc-elevated-solid px-4 text-sm font-semibold text-dc-text hover:bg-dc-elevated-muted"
            >
              {isFollowing ? 'Following event' : 'Follow event'}
            </button>
          : null}
        </Panel>
      : null}
      {showProgramAgenda ?
        <div className="space-y-10">
          {attendeeOk && myScheduleItems.length > 0 && (
            <Panel>
              <SectionHeader title="My event schedule" description="Your obligations and sign-ups for this convention." />
              <ul className="mt-4 space-y-2" aria-label="My schedule items">
                {myScheduleItems.map((item, idx) => (
                  <li
                    key={`${item.kind}-${item.startsAt}-${idx}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border border-dc-border-subtle bg-dc-elevated-muted/40 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-dc-text">{item.title}</p>
                      {item.detail ?
                        <p className="mt-0.5 text-xs text-dc-text-muted">{item.detail}</p>
                      : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-dc-muted">
                        {scheduleKindLabel(item.kind)}
                      </p>
                      <p className="text-xs text-dc-text-muted">
                        {formatScheduleWhen(item.startsAt, item.endsAt, timezone)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-dc-muted">
                Personal blocks and compare live on the{' '}
                <button type="button" className="text-dc-accent hover:underline" onClick={onOpenDancecardTab}>
                  Dancecard
                </button>{' '}
                tab.
              </p>
              <a
                href={`/api/v1/conventions/${encodedSlug}/my-staff-duties.ics`}
                className="mt-2 inline-block text-xs text-dc-accent hover:underline"
              >
                Download my duties (.ics)
              </a>
            </Panel>
          )}
          <div className={attendeeOk && myScheduleItems.length > 0 ? 'border-t border-dc-border-subtle pt-8' : ''}>
            <ConventionScheduleAgenda
              slotsByDay={slotsByDay}
              timezone={timezone}
              onAddToDancecard={onAddToDancecard}
              programLayout={programLayout}
              onProgramLayoutChange={onProgramLayoutChange}
            />
          </div>
        </div>
      : null}
    </div>
  )
}
