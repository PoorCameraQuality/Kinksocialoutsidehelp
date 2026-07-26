import { Link } from 'react-router-dom'
import { siteConfig } from '@/config/site.config'

const LEGAL_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/support', label: 'Safety' },
  { href: '/policies', label: 'Policies' },
  { href: '/guidelines', label: 'Community Guidelines' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/contact', label: 'Contact' },
] as const

export default function LandingLegalStrip() {
  return (
    <footer className="border-t border-dc-border bg-dc-surface/80 py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs leading-relaxed text-dc-muted sm:text-left">
          {siteConfig.name} · {siteConfig.tagline}. {siteConfig.description}
          Adult platform · Privacy-first profiles · No payment processing on this site.
        </p>
        <nav
          className="mt-6 flex flex-col items-stretch gap-1 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-8 lg:justify-start"
          aria-label="Legal and support"
        >
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="inline-flex min-h-11 items-center text-sm text-dc-text-muted transition-colors hover:text-dc-text"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
