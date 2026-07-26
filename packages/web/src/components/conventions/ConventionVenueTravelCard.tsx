type Props = {
  locationLabel: string | null
  venueLabel: string | null
  venueName?: string | null
  accessibilityNotes?: string | null
  hotelBlocks?: Array<{ label: string; url?: string; code?: string }> | null
}

export default function ConventionVenueTravelCard({
  locationLabel,
  venueLabel,
  venueName,
  accessibilityNotes,
  hotelBlocks,
}: Props) {
  const hotels = (hotelBlocks ?? []).filter((b) => b.label?.trim())
  if (!locationLabel && !venueLabel && !venueName && !accessibilityNotes && !hotels.length) {
    return null
  }

  return (
    <section aria-labelledby="convention-venue-heading" className="space-y-4">
      <h2 id="convention-venue-heading" className="text-xl font-bold tracking-tight text-dc-text sm:text-2xl">
        Venue &amp; travel
      </h2>
      <div className="rounded-2xl border border-dc-border bg-dc-elevated-solid p-5 sm:p-6">
        {locationLabel || venueName ?
          <p className="text-lg font-semibold text-dc-text">{venueName?.trim() || locationLabel}</p>
        : null}
        {locationLabel && venueName ?
          <p className="mt-1 text-sm text-dc-text/75">{locationLabel}</p>
        : null}
        {venueLabel ?
          <p className="mt-2 inline-flex rounded-full border border-dc-border bg-dc-elevated-muted px-3 py-1 text-xs font-medium text-dc-text/85">
            {venueLabel}
          </p>
        : null}
        <p className="mt-3 text-sm leading-relaxed text-dc-text/75">
          Exact venue details may be shared after registration when the organizer uses a private address.
        </p>
        {accessibilityNotes?.trim() ?
          <p className="mt-4 border-t border-dc-border pt-4 text-sm leading-relaxed text-dc-text/85">
            <span className="font-semibold text-dc-text">Accessibility. </span>
            {accessibilityNotes.trim()}
          </p>
        : null}
        {hotels.length > 0 ?
          <ul className="mt-4 space-y-2 border-t border-dc-border pt-4">
            {hotels.map((h) => (
              <li key={h.label} className="text-sm">
                {h.url ?
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-dc-accent underline-offset-2 hover:underline"
                  >
                    {h.label}
                    {h.code ? ` · code ${h.code}` : ''} →
                  </a>
                : <span className="text-dc-text/85">
                    {h.label}
                    {h.code ? ` · code ${h.code}` : ''}
                  </span>
                }
              </li>
            ))}
          </ul>
        : null}
      </div>
    </section>
  )
}
