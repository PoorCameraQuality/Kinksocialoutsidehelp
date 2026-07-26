import type { ReactNode } from 'react'

type Props = {
  title?: string
  description?: string
  children?: ReactNode
  className?: string
  actions?: ReactNode
}

export default function OrganizerPanel({ title, description, children, className = '', actions }: Props) {
  return (
    <section className={`organizer-panel ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title ? <h2 className="text-base font-semibold text-dc-text">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-xs text-dc-text-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  )
}
