type Props = {
  highlights: string[]
  title?: string
}

/** ECKE-style “Why go” highlight cards — short organizer bullets. */
export default function ConventionHighlightsGrid({ highlights, title = 'Why go' }: Props) {
  const items = highlights.map((h) => h.trim()).filter(Boolean).slice(0, 8)
  if (!items.length) return null

  return (
    <section aria-labelledby="convention-why-go-heading" className="space-y-4">
      <h2 id="convention-why-go-heading" className="text-xl font-bold tracking-tight text-dc-text sm:text-2xl">
        {title}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((text) => (
          <li
            key={text}
            className="rounded-2xl border border-dc-border bg-dc-elevated-solid px-4 py-4 text-sm leading-relaxed text-dc-text/90 shadow-[var(--dc-shadow-soft)]"
          >
            {text}
          </li>
        ))}
      </ul>
    </section>
  )
}
