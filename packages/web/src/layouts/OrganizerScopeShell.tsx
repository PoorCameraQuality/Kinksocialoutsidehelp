import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Props = {
  backHref?: string
  backLabel?: string
  eyebrow: string
  title: string
  subtitle?: string
  roleBadge?: string | null
  tabNav?: ReactNode
  children: ReactNode
}

export default function OrganizerScopeShell({
  backHref = '/organizer',
  backLabel = 'Organizer hub',
  eyebrow,
  title,
  subtitle,
  roleBadge,
  tabNav,
  children,
}: Props) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6 space-y-3">
        <Link to={backHref} className="text-sm text-dc-muted hover:text-dc-accent">
          ← {backLabel}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-dc-accent/90">{eyebrow}</p>
            <h1 className="text-2xl font-bold text-dc-text mt-1">{title}</h1>
            {subtitle ? <p className="text-sm text-dc-text-muted mt-1 max-w-2xl">{subtitle}</p> : null}
          </div>
          {roleBadge ?
            <span className="rounded-full border border-dc-border px-3 py-1 text-xs text-dc-text-muted">{roleBadge}</span>
          : null}
        </div>
        {tabNav ? <div className="pt-2 border-b border-dc-border">{tabNav}</div> : null}
      </div>
      {children}
    </div>
  )
}
