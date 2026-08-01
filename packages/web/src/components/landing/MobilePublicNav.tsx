import { Link } from 'react-router-dom'
import SiteWordmark from '@/components/brand/SiteWordmark'
import { isDancecardHost } from '@/lib/dancecard-host'

type Props = {
  minimal?: boolean
  loginFocus?: boolean
}

export default function MobilePublicNav({ loginFocus = false }: Props) {
  const brandHref = loginFocus ? '/login' : isDancecardHost() ? '/play' : '/'

  return (
    <header className="mobile-public-nav--beta" aria-label="Site mobile">
      <Link to={brandHref} className="inline-flex min-h-touch items-center" aria-label="Kink Social home">
        <SiteWordmark className="text-base font-semibold tracking-tight text-[var(--beta-text)]" />
      </Link>
      {!loginFocus ?
        <div className="ml-auto flex gap-2">
          <Link to="/login" className="beta-btn beta-btn--secondary" style={{ minHeight: 40, padding: '0 14px', fontSize: 13 }}>
            Sign in
          </Link>
          <a href="#join" className="beta-btn beta-btn--primary" style={{ minHeight: 40, padding: '0 14px', fontSize: 13 }}>
            Join
          </a>
        </div>
      : null}
    </header>
  )
}
