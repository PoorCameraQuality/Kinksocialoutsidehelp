import { Link } from 'react-router-dom'
import { EVENTS_SECTION_NAV } from '@/components/events/events-section-nav'
import { resolveEventsSectionNavMatch } from '@/lib/events-section-mode'

type Props = {
  pathname: string
  search: string
  className?: string
}

export default function EventsSectionNavLinks({ pathname, search, className = '' }: Props) {
  const current = resolveEventsSectionNavMatch(pathname, search)

  return (
    <nav aria-label="Events sections" className={className}>
      <ul className="space-y-0.5">
        {EVENTS_SECTION_NAV.map((item) => {
          const active = item.match === current
          return (
            <li key={item.label}>
              <Link
                to={item.href}
                className={`flex min-h-10 items-center rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  active ?
                    'bg-dc-accent-muted text-dc-accent'
                  : 'text-dc-text-muted hover:bg-dc-elevated-hover hover:text-dc-text'
                }`}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
