import type { ReactNode } from 'react'
import ConventionConnectLinks from '@/components/conventions/ConventionConnectLinks'
import ConventionHighlightsGrid from '@/components/conventions/ConventionHighlightsGrid'
import ConventionVenueTravelCard from '@/components/conventions/ConventionVenueTravelCard'
import MarkdownContent from '@/components/ui/MarkdownContent'
import type { ConventionOfficialLink } from '@/lib/convention-description'
import { stripStandaloneUrls } from '@/lib/convention-description'
import type { PublicAttendeeGuide } from '@/lib/dancecard/attendeeGuideJson'

type Props = {
  guide: PublicAttendeeGuide
  convention: { name: string; description: string | null }
  highlights?: string[]
  officialLinks?: ConventionOfficialLink[]
  venue?: {
    locationLabel: string | null
    venueLabel: string | null
    venueName?: string | null
    accessibilityNotes?: string | null
    hotelBlocks?: Array<{ label: string; url?: string; code?: string }> | null
  } | null
  /** Extra structured logistics (CoC cards, etc.) after venue. */
  logisticsSlot?: ReactNode
}

function MarkdownBlock({ value }: { value: string }) {
  const trimmed = value.trim()
  if (!trimmed) return null
  return (
    <MarkdownContent
      markdown={trimmed}
      className="c2k-rich-html text-[15px] leading-relaxed text-dc-text/90"
    />
  )
}

export default function ConventionWelcomeTab({
  guide,
  convention,
  highlights = [],
  officialLinks = [],
  venue,
  logisticsSlot,
}: Props) {
  const sections = (guide.sections ?? []).filter(
    (s) => (s.markdown ?? '').trim().length > 0 || (s.title ?? '').trim().length > 0,
  )
  const aboutBody = stripStandaloneUrls(convention.description)
  const hasGuideContent =
    guide.checkInMarkdown.trim().length > 0 ||
    Boolean(guide.rabbitsignUrl) ||
    sections.length > 0 ||
    guide.conductCheckpoints.length > 0

  return (
    <article className="convention-welcome space-y-10">
      <ConventionHighlightsGrid highlights={highlights} />

      <section aria-labelledby="convention-overview-heading" className="space-y-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-dc-muted">Overview</p>
          <h2 id="convention-overview-heading" className="text-xl font-bold tracking-tight text-dc-text sm:text-2xl">
            About this event
          </h2>
          <p className="text-sm text-dc-text/65">
            Organizer-provided details — confirm registration, policies, and final logistics on linked official pages.
          </p>
        </div>
        {aboutBody ?
          <div className="rounded-2xl border border-dc-border bg-dc-elevated-solid/60 p-5 sm:p-6">
            <div className="text-[15px] leading-[1.7] text-dc-text/90 whitespace-pre-wrap">{aboutBody}</div>
          </div>
        : !hasGuideContent && !highlights.length ?
          <p className="text-sm text-dc-text-muted">The organizer has not published a full description yet.</p>
        : null}
      </section>

      {guide.checkInMarkdown.trim().length > 0 ?
        <section className="space-y-3">
          <h2 className="text-xl font-bold tracking-tight text-dc-text sm:text-2xl">What to expect</h2>
          <div className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-5 sm:p-6">
            <MarkdownBlock value={guide.checkInMarkdown} />
          </div>
        </section>
      : null}

      <ConventionConnectLinks links={officialLinks} />

      {venue ?
        <ConventionVenueTravelCard
          locationLabel={venue.locationLabel}
          venueLabel={venue.venueLabel}
          venueName={venue.venueName}
          accessibilityNotes={venue.accessibilityNotes}
          hotelBlocks={venue.hotelBlocks}
        />
      : null}

      {guide.rabbitsignUrl ?
        <section className="space-y-3 rounded-2xl border border-dc-border bg-dc-elevated-solid p-6">
          <h2 className="text-lg font-bold text-dc-text">Waivers</h2>
          <a
            href={guide.rabbitsignUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex text-sm font-medium text-dc-accent underline-offset-2 hover:underline"
          >
            Sign waivers (RabbitSign) →
          </a>
        </section>
      : null}

      {logisticsSlot ?
        <section className="space-y-3">
          <h2 className="text-xl font-bold tracking-tight text-dc-text sm:text-2xl">Policies &amp; logistics</h2>
          {logisticsSlot}
        </section>
      : null}

      {sections.map((section) => (
        <section key={section.id} className="space-y-3">
          <h2 className="text-xl font-bold tracking-tight text-dc-text sm:text-2xl">{section.title}</h2>
          <div className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-5 sm:p-6">
            <MarkdownBlock value={section.markdown ?? ''} />
          </div>
        </section>
      ))}

      {guide.conductCheckpoints.length > 0 ?
        <section className="space-y-3 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-6">
          <h2 className="text-lg font-bold text-amber-100">Policies &amp; safety</h2>
          <ul className="space-y-3 text-sm text-dc-text/85">
            {guide.conductCheckpoints.map((cp) => (
              <li key={cp.id}>
                <p className="font-semibold text-dc-text">{cp.title}</p>
                {cp.body ? <MarkdownBlock value={cp.body} /> : null}
              </li>
            ))}
          </ul>
        </section>
      : null}
    </article>
  )
}
