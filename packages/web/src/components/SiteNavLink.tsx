import { Link } from 'react-router-dom'
import { isExternalHref, resolveCrossHostNavHref } from '@/lib/dancecard-host'

/** Resolve `/play` ↔ dancecard host and bounce community links off dancecard.*. */
export function resolveSiteNavHref(href: string): string {
  return resolveCrossHostNavHref(href)
}

type Props = {
  href: string
  className?: string
  onClick?: () => void
  children: React.ReactNode
  /** Force full-page navigation even for same-origin paths. */
  external?: boolean
}

/** Footer / header nav link that can cross dancecard.* ↔ apex. */
export default function SiteNavLink({ href, className, onClick, children, external }: Props) {
  const resolved = resolveSiteNavHref(href)
  const leaveSpa = external || isExternalHref(resolved)
  if (leaveSpa) {
    return (
      <a href={resolved} className={className} onClick={onClick}>
        {children}
      </a>
    )
  }
  return (
    <Link to={resolved} className={className} onClick={onClick}>
      {children}
    </Link>
  )
}
