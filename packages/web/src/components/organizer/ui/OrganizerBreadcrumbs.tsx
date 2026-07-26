import { Link } from 'react-router-dom'

export type BreadcrumbItem = {
  label: string
  href?: string
}

type Props = {
  items: BreadcrumbItem[]
}

export default function OrganizerBreadcrumbs({ items }: Props) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-dc-muted">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1.5">
          {i > 0 ? <span aria-hidden className="text-dc-text/20">/</span> : null}
          {item.href ?
            <Link to={item.href} className="hover:text-dc-accent">
              {item.label}
            </Link>
          : <span className="text-dc-text-muted">{item.label}</span>}
        </span>
      ))}
    </nav>
  )
}
