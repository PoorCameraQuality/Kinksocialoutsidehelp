import { Link } from 'react-router-dom'
import SiteWordmark from '@/components/brand/SiteWordmark'

type Props = {
  minimal?: boolean
  loginFocus?: boolean
}

const anchorLinks = [
  { href: '#discover', label: 'Discover' },
  { href: '#organizers', label: 'For organizers' },
  { href: '#safety', label: 'Safety' },
  { href: '#faq', label: 'Questions' },
] as const

export default function PublicNav({ minimal = false, loginFocus = false }: Props) {
  if (loginFocus) {
    return (
      <nav className="beta-nav" aria-label="Site">
        <div className="public-container beta-nav__inner">
          <Link to="/" className="public-nav__brand" aria-label="Kink Social home">
            <SiteWordmark className="text-xl font-semibold tracking-tight text-[var(--beta-text)]" />
          </Link>
        </div>
      </nav>
    )
  }

  return (
    <nav className="beta-nav" aria-label="Site">
      <div className="public-container beta-nav__inner">
        <Link to="/" className="public-nav__brand" aria-label="Kink Social home">
          <SiteWordmark className="text-xl font-semibold tracking-tight text-[var(--beta-text)]" />
        </Link>
        {!minimal ?
          <div className="beta-nav__links">
            {anchorLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </div>
        : null}
        <div className="beta-nav__actions">
          <Link to="/?login=1" className="beta-btn beta-btn--secondary beta-nav__signin-desktop">
            Sign in
          </Link>
          <a href="#join" className="beta-btn beta-btn--primary">
            Join free
          </a>
        </div>
      </div>
    </nav>
  )
}
