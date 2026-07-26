import { Link } from 'react-router-dom'
import RailCard from '@/components/ui/RailCard'
import { railAsideClass } from '@/lib/card-surface'

const QUICK_LINKS = [
  { href: '/events', label: 'Events' },
  { href: '/education', label: 'Education' },
  { href: '/media', label: 'Media' },
  { href: '/vendors', label: 'Vendors' },
] as const

export default function SavedRightRail() {
  return (
    <aside className={railAsideClass} aria-label="Saved page tips">
      <RailCard title="Save things for later">
        <div className="flex gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-dc-accent-muted text-dc-accent"
            aria-hidden
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-4 7 4V5c0-1.1-.9-2-2-2z" />
            </svg>
          </span>
          <p className="text-xs leading-relaxed text-dc-text-muted">
            Use the bookmark icon on events, articles, media, vendors, and posts.
          </p>
        </div>
      </RailCard>

      <RailCard title="Quick browse">
        <ul className="space-y-2">
          {QUICK_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                to={link.href}
                className="block rounded-lg px-2 py-1.5 text-sm text-dc-text-muted transition-colors hover:bg-dc-elevated-muted hover:text-dc-text"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </RailCard>

      <RailCard title="Recently viewed">
        <p className="text-xs leading-relaxed text-dc-text-muted">
          Your recently viewed events and profiles will appear here when browsing history is enabled.
        </p>
        <Link to="/events" className="mt-3 inline-block text-xs font-medium text-dc-accent hover:underline">
          Browse events
        </Link>
      </RailCard>
    </aside>
  )
}
