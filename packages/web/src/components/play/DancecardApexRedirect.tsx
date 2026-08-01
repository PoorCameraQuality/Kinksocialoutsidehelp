'use client'

import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  apexSiteHref,
  isDancecardHost,
  isDancecardLoginLandingSearch,
  isDancecardStayPath,
} from '@/lib/dancecard-host'
import { buildLoginHrefFromLegacySearch } from '@/lib/auth-links'

/**
 * On dancecard.*, keep Play / Chat / Me; send community routes to kink.social
 * so the wine product theme never paints the main feed.
 *
 * Host-boundary rules (must stay loop-free):
 * - `/` product entry → `/play` (directory is public)
 * - legacy `/?login=1` → `/login` (never paint Landing LoginCard first)
 * - stay-paths never hard-navigate
 * - everything else leaves once via location.replace (guarded against repeats)
 */
export default function DancecardApexRedirect() {
  const { pathname, search, hash } = useLocation()
  const navigate = useNavigate()
  const lastHardNav = useRef<string | null>(null)

  useEffect(() => {
    if (!isDancecardHost()) return

    if (pathname === '/') {
      if (isDancecardLoginLandingSearch(search) || /(?:^|[?&])signup=1(?:&|$)/.test(search)) {
        navigate(buildLoginHrefFromLegacySearch(search), { replace: true })
        return
      }
      navigate('/play', { replace: true })
      return
    }

    if (isDancecardStayPath(pathname, search)) {
      lastHardNav.current = null
      return
    }

    const target = apexSiteHref(`${pathname}${search}${hash}`)
    if (lastHardNav.current === target) return
    lastHardNav.current = target
    window.location.replace(target)
  }, [pathname, search, hash, navigate])

  return null
}
