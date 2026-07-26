import { Link } from 'react-router-dom'

import type { EducationRecentTextItem } from '@/lib/education-discover-data'

type Props = {
  item: EducationRecentTextItem
}

export default function EducationRecentTextCard({ item }: Props) {
  const href = `/education/${encodeURIComponent(item.slug)}`

  return (
    <article className="w-[min(100%,260px)] shrink-0 rounded-2xl border border-dc-border bg-dc-elevated-solid p-4 shadow-[var(--dc-shadow-soft)]">
      <Link to={href} className="block min-w-0">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-dc-accent">{item.category}</span>
        <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-dc-text">{item.title}</h3>
        <p className="mt-1 text-[11px] text-dc-muted">{item.addedLabel}</p>
        {item.excerpt ?
          <p className="mt-2 line-clamp-3 text-xs text-dc-text-muted">{item.excerpt}</p>
        : null}
      </Link>
    </article>
  )
}
