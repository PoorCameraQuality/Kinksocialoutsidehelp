import { Helmet } from 'react-helmet-async'
import { useLocation } from 'react-router-dom'

import {
  isKinkSocialPublicIndexPath,
  KINK_SOCIAL_PUBLIC_LAUNCH_ROBOTS_META,
  KINK_SOCIAL_ROBOTS_META,
} from '@c2k/shared'

const publicLaunch = import.meta.env.VITE_PUBLIC_LAUNCH === 'true'

/**
 * Global robots meta — member surfaces stay noindex.
 * Brand/legal allowlist paths opt into indexing when VITE_PUBLIC_LAUNCH is on.
 */
export default function AppRobotsMeta() {
  const { pathname } = useLocation()
  const robots =
    publicLaunch && isKinkSocialPublicIndexPath(pathname)
      ? KINK_SOCIAL_PUBLIC_LAUNCH_ROBOTS_META
      : KINK_SOCIAL_ROBOTS_META

  return (
    <Helmet>
      <meta name="robots" content={robots} />
      <meta name="googlebot" content={robots} />
    </Helmet>
  )
}
