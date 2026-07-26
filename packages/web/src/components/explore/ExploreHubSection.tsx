import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

type Props = {
  title: string
  description?: string
  href?: string
  linkLabel?: string
  children: ReactNode
  className?: string
  /** Panel tiles for dashboard grids; stack = full-width sections with dividers. */
  layout?: 'stack' | 'panel'
}

export default function ExploreHubSection({
  title,
  description,
  href,
  linkLabel,
  children,
  className = '',
  layout = 'stack',
}: Props) {
  const isPanel = layout === 'panel'

  return (
    <section
      className={cn(
        isPanel ? 'xpl-section--panel' : 'xpl-section--stack',
        className,
      )}
    >
      <div className="xpl-section__head">
        <div className="min-w-0">
          <h2 className="xpl-section__title">{title}</h2>
          {description ? <p className="xpl-section__desc">{description}</p> : null}
        </div>
        {href && linkLabel ?
          <Link to={href} className="xpl-section__link">
            {linkLabel}
            <span aria-hidden>→</span>
          </Link>
        : null}
      </div>
      <div>{children}</div>
    </section>
  )
}
