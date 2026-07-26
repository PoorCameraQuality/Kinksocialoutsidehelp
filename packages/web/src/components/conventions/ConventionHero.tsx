import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import CopyLinkOverflowMenu from '@/components/ui/CopyLinkOverflowMenu'
import { conventionTarget } from '@/lib/moderation/report-targets'

export type ConventionHeroPreviewRole = 'attendee' | 'staff' | 'safety' | 'public'

type RegistrationCta = {
  href: string
  label: string
  /** When true, renders the secondary "You're registered" pill instead of a CTA button. */
  registered?: boolean
}

type OrgChip = {
  href: string
  label: string
}

type AnchorChip = {
  href: string
  label: string
}

export type ConventionHeroProps = {
  banner: string | null
  logo: string | null
  eyebrow: string | null
  title: string
  /** Short 2–3 line summary only — never the full description. */
  summary: string | null
  locationLabel?: string | null
  startsAt: string | null
  endsAt: string | null
  timezone: string | null
  themeAccent?: string | null
  organization?: OrgChip | null
  anchorEvent?: AnchorChip | null
  registrationCta?: RegistrationCta | null
  organizerConsoleHref?: string | null
  showPin?: boolean
  isPinned?: boolean
  onTogglePin?: () => void | Promise<void>
  onReadFullDescription?: () => void
  hasFullDescription?: boolean
  /**
   * `flyer` (default): blurred cover background + contained artwork.
   * `banner`: full-bleed photographic cover (organizer opt-in later).
   */
  mediaMode?: 'flyer' | 'banner'
  previewRole?: ConventionHeroPreviewRole | null
  onExitPreview?: () => void
  /** Convention UUID — enables entity Report in the hero overflow. */
  conventionId?: string | null
  /** Path for copy-link, e.g. `/conventions/slug`. */
  conventionPath?: string | null
  showReport?: boolean
}

export function formatConventionDateRange(
  startsAt: string | null,
  endsAt: string | null,
  timezone: string | null,
): string {
  if (!startsAt) return ''
  try {
    const tz = timezone ?? 'America/New_York'
    const start = new Date(startsAt)
    const end = endsAt ? new Date(endsAt) : null
    const dayFmt = new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: tz,
    })
    const startLabel = dayFmt.format(start)
    if (!end) return startLabel
    const sameDay =
      start.toDateString() === end.toDateString() || dayFmt.format(start) === dayFmt.format(end)
    if (sameDay) {
      const timeFmt = new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: tz,
      })
      return `${startLabel} · ${timeFmt.format(start)}\u2013${timeFmt.format(end)}`
    }
    return `${startLabel} \u2013 ${dayFmt.format(end)}`
  } catch {
    return ''
  }
}

function PreviewBanner({
  role,
  onExitPreview,
}: {
  role: ConventionHeroPreviewRole
  onExitPreview?: () => void
}) {
  const roleLabel: Record<ConventionHeroPreviewRole, string> = {
    attendee: 'Attendee',
    staff: 'Staff',
    safety: 'Safety team',
    public: 'Public (signed out)',
  }
  return (
    <div className="bg-dc-accent text-dc-accent-foreground text-sm font-semibold">
      <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-3 px-4 py-2">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-dc-surface-muted animate-pulse" />
          Previewing as <span className="underline decoration-dc-surface/40 underline-offset-2">{roleLabel[role]}</span>
        </span>
        <button
          type="button"
          onClick={onExitPreview}
          className="rounded-full bg-dc-surface-muted px-3 py-1 text-xs font-bold uppercase tracking-wide text-dc-accent hover:opacity-90"
        >
          Exit preview
        </button>
      </div>
    </div>
  )
}

/**
 * Public convention hero: darkened info card + contained flyer artwork over a
 * blurred cover, so organizer uploads cannot break readability or layout height.
 */
export default function ConventionHero({
  banner,
  logo,
  eyebrow,
  title,
  summary,
  locationLabel,
  startsAt,
  endsAt,
  timezone,
  themeAccent,
  organization,
  registrationCta,
  organizerConsoleHref,
  showPin,
  isPinned,
  onTogglePin,
  onReadFullDescription,
  hasFullDescription,
  mediaMode = 'flyer',
  previewRole,
  onExitPreview,
  conventionId,
  conventionPath,
  showReport = false,
}: ConventionHeroProps) {
  const dateLabel = formatConventionDateRange(startsAt, endsAt, timezone)
  const accentStyle: CSSProperties = themeAccent
    ? { ['--hero-accent' as string]: themeAccent, ['--event-accent' as string]: themeAccent }
    : {
        ['--hero-accent' as string]: 'var(--dc-accent, rgba(45, 212, 191, 0.95))',
        ['--event-accent' as string]: 'var(--dc-accent, rgba(45, 212, 191, 0.95))',
      }

  const metaLine = [dateLabel, locationLabel?.trim()].filter(Boolean).join(' · ')
  const reportTarget =
    showReport && conventionId ? conventionTarget(conventionId) : null

  const actions: ReactNode = (
    <div className="flex flex-wrap items-center gap-2">
      {registrationCta?.registered ?
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-300/40">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          Registered
        </span>
      : null}
      {registrationCta ?
        <Link
          to={registrationCta.href}
          className={`inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold ${
            registrationCta.registered ?
              'border border-white/25 bg-white/10 text-dc-text hover:bg-white/15'
            : 'bg-dc-accent text-dc-accent-foreground hover:bg-dc-accent-hover'
          }`}
          style={
            registrationCta.registered ?
              undefined
            : { backgroundColor: 'var(--hero-accent, var(--event-accent))', color: 'var(--dc-surface, #0b0d12)' }
          }
        >
          {registrationCta.registered ? 'Manage registration' : registrationCta.label}
        </Link>
      : null}
      {showPin && onTogglePin ?
        <button
          type="button"
          onClick={() => void onTogglePin()}
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-4 text-sm font-semibold ${
            isPinned ?
              'border-dc-accent-border/50 bg-dc-accent/20 text-dc-accent'
            : 'border-white/25 bg-white/10 text-dc-text hover:bg-white/15'
          }`}
          aria-pressed={isPinned}
          aria-label={isPinned ? 'Unfollow event' : 'Follow event'}
        >
          <span aria-hidden>{isPinned ? '★' : '☆'}</span>
          {isPinned ? 'Following' : 'Follow event'}
        </button>
      : null}
      {conventionPath ?
        <CopyLinkOverflowMenu
          path={conventionPath}
          className="[&_button]:border [&_button]:border-white/25 [&_button]:bg-white/10 [&_button]:text-dc-text [&_button]:hover:bg-white/15"
          report={
            reportTarget ?
              {
                targetType: reportTarget.targetType,
                targetId: reportTarget.targetId,
                targetLabel: 'convention',
              }
            : undefined
          }
        />
      : null}
    </div>
  )

  const infoCard = (
    <div className="relative z-[1] flex min-w-0 flex-1 flex-col justify-between gap-6 rounded-2xl border border-white/10 bg-[#0c0e14]/92 p-6 shadow-[var(--dc-shadow-soft)] backdrop-blur-md sm:p-8">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {eyebrow ?
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-dc-text/90 ring-1 ring-white/15">
              {eyebrow}
            </span>
          : null}
          {organization ?
            <Link
              to={organization.href}
              className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-dc-text/90 ring-1 ring-white/10 hover:bg-white/15"
            >
              {organization.label}
            </Link>
          : null}
          {organizerConsoleHref ?
            <Link
              to={organizerConsoleHref}
              className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold text-dc-text hover:bg-white/15"
            >
              Organizer dashboard
            </Link>
          : null}
        </div>

        <div className="flex items-start gap-4">
          {logo ?
            <div className="hidden h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/95 p-1.5 ring-1 ring-white/30 sm:flex">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt="" className="h-full w-full object-contain" />
            </div>
          : null}
          <div className="min-w-0">
            <h1 className="font-serif text-2xl font-bold leading-tight text-dc-text sm:text-3xl lg:text-[2.35rem]">
              {title}
            </h1>
            {(dateLabel || locationLabel) ?
              <div className="mt-3 flex flex-wrap gap-2">
                {dateLabel ?
                  <span className="rounded-full border border-amber-400/35 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">
                    {dateLabel}
                  </span>
                : null}
                {locationLabel ?
                  <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-dc-text/90">
                    {locationLabel}
                  </span>
                : null}
              </div>
            : metaLine ?
              <p className="mt-2 text-sm text-dc-text/90 sm:text-base">{metaLine}</p>
            : null}
          </div>
        </div>

        {summary ?
          <div className="max-w-xl">
            <p className="text-sm leading-relaxed text-dc-text/85 sm:text-[15px] line-clamp-3">{summary}</p>
            {hasFullDescription && onReadFullDescription ?
              <button
                type="button"
                onClick={onReadFullDescription}
                className="mt-2 text-sm font-semibold text-dc-accent underline-offset-2 hover:underline"
              >
                Read full description
              </button>
            : null}
          </div>
        : hasFullDescription && onReadFullDescription ?
          <button
            type="button"
            onClick={onReadFullDescription}
            className="text-sm font-semibold text-dc-accent underline-offset-2 hover:underline"
          >
            Read full description
          </button>
        : null}
      </div>

      {actions}
    </div>
  )

  const artwork =
    banner ?
      <div className="relative z-[1] mx-auto w-full max-w-sm shrink-0 lg:max-w-none lg:w-[min(100%,22rem)] xl:w-[24rem]">
        <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#0c0e14] shadow-[var(--dc-shadow-soft)] ring-1 ring-black/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={banner}
            alt=""
            className="mx-auto block h-auto max-h-[28rem] w-full object-contain"
          />
        </div>
      </div>
    : null

  return (
    <header className="convention-hero border-b border-dc-border" style={accentStyle}>
      {previewRole ? <PreviewBanner role={previewRole} onExitPreview={onExitPreview} /> : null}

      {mediaMode === 'banner' && banner ?
        <div className="relative isolate min-h-[14rem] overflow-hidden sm:min-h-[20rem]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0e14] via-[#0c0e14]/75 to-[#0c0e14]/35" />
          <div className="relative mx-auto flex max-w-[1360px] flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:flex-row lg:items-end">
            {infoCard}
          </div>
        </div>
      : (
        <div className="relative isolate overflow-hidden bg-[#0a0b10]">
          {banner ?
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={banner}
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
              />
              <div className="absolute inset-0 bg-[#0a0b10]/72" />
            </>
          : (
            <div
              className="absolute inset-0 opacity-80"
              style={{
                backgroundImage: `linear-gradient(135deg, var(--hero-accent) 0%, rgba(15, 23, 42, 0.95) 75%)`,
              }}
            />
          )}

          <div className="relative mx-auto grid max-w-[1360px] gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,24rem)] lg:items-stretch">
            {/* Mobile: artwork first */}
            <div className="order-1 lg:hidden">{artwork}</div>
            <div className="order-2 lg:order-1">{infoCard}</div>
            <div className="order-3 hidden lg:flex lg:items-center lg:justify-end">{artwork}</div>
          </div>
        </div>
      )}
    </header>
  )
}
