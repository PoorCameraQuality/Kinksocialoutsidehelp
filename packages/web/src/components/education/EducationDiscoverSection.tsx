import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Props = {
  title: string
  viewAllHref?: string
  viewAllLabel?: string
  children: ReactNode
  className?: string
}

export default function EducationDiscoverSection({
  title,
  viewAllHref = '/education',
  viewAllLabel = 'View all',
  children,
  className = '',
}: Props) {
  return (
    <section className={`edu-block ${className}`.trim()} aria-labelledby={`edu-section-${title.replace(/\s+/g, '-')}`}>
      <div className="edu-block__head mb-3 flex items-center justify-between gap-3">
        <h2
          id={`edu-section-${title.replace(/\s+/g, '-')}`}
          className="edu-discover-section__title"
        >
          {title}
        </h2>
        <Link
          to={viewAllHref}
          className="shrink-0 text-xs font-semibold text-dc-accent hover:underline"
        >
          {viewAllLabel}
        </Link>
      </div>
      {children}
    </section>
  )
}
