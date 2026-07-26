import { Link } from 'react-router-dom'

const DIRECTORY_LINKS = [
  { href: '/events', label: 'Events' },
  { href: '/groups', label: 'Groups' },
  { href: '/orgs', label: 'Organizations' },
  { href: '/presenters', label: 'Presenters' },
  { href: '/vendors', label: 'Vendors' },
  { href: '/places', label: 'Places' },
] as const

type Props = {
  className?: string
}

export default function DiscoveryBrowseLinks({ className = '' }: Props) {
  return (
    <p className={`text-sm text-dc-text-muted ${className}`.trim()}>
      <span className="font-medium text-dc-text">Also browse:</span>{' '}
      {DIRECTORY_LINKS.map((link, i) => (
        <span key={link.href}>
          {i > 0 ? ' · ' : null}
          <Link to={link.href} className="text-dc-accent hover:underline">
            {link.label}
          </Link>
        </span>
      ))}
    </p>
  )
}
