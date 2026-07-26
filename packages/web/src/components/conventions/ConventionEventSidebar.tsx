import { useCallback, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import ConventionGetInvolvedPanel from '@/components/conventions/ConventionGetInvolvedPanel'
import ConventionParticipationStrip from '@/components/conventions/ConventionParticipationStrip'
import HostedByCard, { type HostedByOrg } from '@/components/conventions/HostedByCard'
import type { ConventionSettings } from '@/hooks/useConventionHub'
import { buildGoogleCalendarUrl } from '@/lib/event-calendar-links'

const VENUE_LABELS: Record<string, string> = {
  single_venue: 'Single venue',
  hotel_takeover: 'Hotel takeover',
  camping: 'Camping / outdoor',
  urban_multi_venue: 'Multi-venue (urban)',
  other: 'Other',
}

type RegistrationCta = {
  href: string
  label: string
  registered?: boolean
}

type CalendarSource = {
  title: string
  startsAt: string
  endsAt?: string | null
  location?: string | null
  description?: string | null
  pagePath: string
  /** When set, Apple / iCal use the convention program feed. */
  programIcsPath?: string | null
  showProgramIcs?: boolean
}

type Props = {
  conventionSlug: string
  isAuthenticated: boolean
  dateLabel: string | null
  locationLabel: string | null
  eventTypeLabel?: string | null
  settings?: ConventionSettings | null
  organization?: HostedByOrg | null
  registrationCta?: RegistrationCta | null
  calendar?: CalendarSource | null
  showKeyDetails?: boolean
  /** Compact mode for mobile footer (skip register + calendar duplicate). */
  variant?: 'desktop' | 'mobile'
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-sm">
      <dt className="pt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-dc-muted">{label}</dt>
      <dd className="min-w-0 font-semibold leading-snug text-dc-text">{children}</dd>
    </div>
  )
}

function SidebarButton({
  href,
  external,
  primary,
  children,
  onClick,
}: {
  href?: string
  external?: boolean
  primary?: boolean
  children: React.ReactNode
  onClick?: () => void
}) {
  const className = primary
    ? 'inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-dc-accent px-4 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover'
    : 'inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-dc-border bg-dc-elevated-muted/30 px-4 text-sm font-semibold text-dc-text hover:bg-dc-elevated-muted'

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {children}
      </button>
    )
  }
  if (!href) return null
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    )
  }
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  )
}

export default function ConventionEventSidebar({
  conventionSlug,
  isAuthenticated,
  dateLabel,
  locationLabel,
  eventTypeLabel = 'Convention',
  settings,
  organization,
  registrationCta,
  calendar,
  showKeyDetails = true,
  variant = 'desktop',
}: Props) {
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const venueLabel = settings?.venueProfile ? VENUE_LABELS[settings.venueProfile] ?? settings.venueProfile : null
  const hotelNote = settings?.hotelBlocks?.some((b) => b.url)
  const mobile = variant === 'mobile'

  const googleUrl =
    calendar ?
      buildGoogleCalendarUrl({
        title: calendar.title,
        startsAt: calendar.startsAt,
        endsAt: calendar.endsAt,
        location: calendar.location,
        description: calendar.description,
        eventPageUrl:
          typeof window !== 'undefined' ? `${window.location.origin}${calendar.pagePath}` : calendar.pagePath,
      })
    : ''

  const icsPath = calendar?.programIcsPath ?? null
  const webcalUrl =
    icsPath && typeof window !== 'undefined' ?
      `${window.location.origin}${icsPath}`.replace(/^https:/i, 'webcal:')
    : icsPath ?
      icsPath
    : null

  const onShare = useCallback(async () => {
    const path = calendar?.pagePath ?? `/conventions/${encodeURIComponent(conventionSlug)}`
    const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: calendar?.title ?? 'Event', url })
        return
      }
      await navigator.clipboard.writeText(url)
      setShareMsg('Link copied')
      window.setTimeout(() => setShareMsg(null), 2000)
    } catch {
      setShareMsg(null)
    }
  }, [calendar?.pagePath, calendar?.title, conventionSlug])

  return (
    <aside className="space-y-3" aria-label="Event information">
      {/* Primary actions + labeled meta (ECKE-style density) */}
      <section className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-5 shadow-[var(--dc-shadow-soft)]">
        {!mobile && registrationCta ?
          <div className="space-y-2">
            <SidebarButton href={registrationCta.href} primary>
              {registrationCta.registered ? 'Manage registration' : registrationCta.label}
            </SidebarButton>
            <SidebarButton onClick={() => void onShare()}>Share event</SidebarButton>
            {shareMsg ? <p className="text-center text-xs text-dc-accent">{shareMsg}</p> : null}
            {hotelNote ?
              <p className="pt-1 text-xs leading-relaxed text-dc-text/70">Hotel booking is separate from registration</p>
            : null}
          </div>
        : null}

        {mobile ?
          <div className="space-y-2">
            <SidebarButton onClick={() => void onShare()}>Share event</SidebarButton>
            {shareMsg ? <p className="text-center text-xs text-dc-accent">{shareMsg}</p> : null}
          </div>
        : null}

        {showKeyDetails ?
          <dl className={`${registrationCta && !mobile ? 'mt-5 border-t border-dc-border pt-5' : mobile ? '' : ''} space-y-3.5`}>
            {dateLabel ? <MetaRow label="When">{dateLabel}</MetaRow> : null}
            {locationLabel ? <MetaRow label="Where">{locationLabel}</MetaRow> : null}
            {eventTypeLabel || venueLabel ?
              <MetaRow label="Type">{eventTypeLabel || venueLabel}</MetaRow>
            : null}
            {organization ?
              <MetaRow label="Organizer">
                <Link
                  to={`/orgs/${encodeURIComponent(organization.slug)}`}
                  className="text-dc-accent hover:underline"
                >
                  {organization.displayName}
                </Link>
              </MetaRow>
            : null}
          </dl>
        : null}
      </section>

      {calendar && (googleUrl || (calendar.showProgramIcs && icsPath)) ?
        <section className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-5">
          <h2 className="text-base font-bold text-dc-text">Add to calendar</h2>
          <p className="mt-1 text-xs leading-relaxed text-dc-text/70">
            Save the event dates locally or open them in Google Calendar.
          </p>
          <div className="mt-3 space-y-2">
            {googleUrl ?
              <SidebarButton href={googleUrl} external>
                Google Calendar
              </SidebarButton>
            : null}
            {calendar.showProgramIcs && webcalUrl ?
              <SidebarButton href={webcalUrl} external>
                Apple Calendar
              </SidebarButton>
            : null}
            {calendar.showProgramIcs && icsPath ?
              <SidebarButton href={icsPath} external>
                Download iCal
              </SidebarButton>
            : null}
          </div>
        </section>
      : null}

      {isAuthenticated ?
        <ConventionParticipationStrip conventionKey={conventionSlug} variant="sidebar" />
      : null}

      {organization ?
        <div className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-4">
          <HostedByCard org={organization} variant="sidebar" />
        </div>
      : null}

      <ConventionGetInvolvedPanel
        conventionSlug={conventionSlug}
        isAuthenticated={isAuthenticated}
        variant="sidebar"
      />
    </aside>
  )
}
