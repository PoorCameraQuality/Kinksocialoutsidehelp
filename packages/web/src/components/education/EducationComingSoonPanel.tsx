import { Link } from 'react-router-dom'
import type { EducationHubView } from '@/lib/education-section-mode'
import { EDUCATION_VIEW_META } from '@/lib/education-section-mode'

type Props = {
  view: Exclude<EducationHubView, 'overview' | 'paths' | 'articles'>
}

export default function EducationComingSoonPanel({ view }: Props) {
  const meta = EDUCATION_VIEW_META[view]

  return (
    <div
      className="rounded-2xl border border-dc-border bg-dc-elevated-solid px-6 py-12 text-center shadow-[var(--dc-shadow-soft)]"
      role="status"
    >
      <span className="inline-block rounded-full border border-dc-accent-border/50 bg-dc-accent-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-dc-accent">
        Coming soon
      </span>
      <h2 className="mt-4 text-xl font-semibold text-dc-text">{meta.title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-dc-text-muted">{meta.subtitle}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/education?view=articles"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-dc-accent px-5 text-sm font-semibold text-dc-accent-foreground hover:bg-dc-accent-hover"
        >
          Browse articles
        </Link>
        <Link
          to="/education?view=paths"
          className="inline-flex min-h-11 items-center rounded-xl border border-dc-border px-5 text-sm font-semibold text-dc-text-muted hover:text-dc-text"
        >
          Learning paths
        </Link>
      </div>
    </div>
  )
}
