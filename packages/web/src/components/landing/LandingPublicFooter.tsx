import { Link } from 'react-router-dom'
import SiteWordmark from '@/components/brand/SiteWordmark'

const footerLinks = [
  { href: '/about', label: 'About' },
  { href: '/events', label: 'Events' },
  { href: '/groups', label: 'Groups' },
  { href: '/education', label: 'Education' },
  { href: '#safety', label: 'Safety' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/guidelines', label: 'Community guidelines' },
] as const

export default function LandingPublicFooter() {
  return (
    <footer className="beta-footer">
      <div className="public-container beta-footer__grid">
        <div>
          <SiteWordmark className="text-lg font-bold text-[var(--beta-rose)]" />
          <p className="beta-footer__meta">18+ · Free to join · public beta</p>
        </div>
        <ul className="beta-footer__links">
          {footerLinks.map((link) => (
            <li key={link.label}>
              {link.href.startsWith('#') ?
                <a href={link.href}>{link.label}</a>
              : <Link to={link.href}>{link.label}</Link>}
            </li>
          ))}
        </ul>
      </div>
    </footer>
  )
}
