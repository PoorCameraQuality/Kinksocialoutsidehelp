import { Helmet } from 'react-helmet-async'
import {
  APP_NAME,
  KINK_SOCIAL_PUBLIC_LAUNCH_ROBOTS_META,
  KINK_SOCIAL_ROBOTS_META,
  resolveShareImageUrl,
} from '@c2k/shared'
import { mediaDisplayUrl } from '@/lib/media-display-url'

type Props = {
  title: string
  description?: string
  path: string
  shareImageUrl?: string | null
  bannerUrl?: string | null
  logoUrl?: string | null
  heroImageUrl?: string | null
  noIndex?: boolean
}

function siteOrigin(): string {
  const raw = import.meta.env.VITE_SITE_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')
  return String(raw).replace(/\/$/, '')
}

export default function ScopePageMeta({
  title,
  description,
  path,
  shareImageUrl,
  bannerUrl,
  logoUrl,
  heroImageUrl,
  noIndex,
}: Props) {
  const origin = siteOrigin()
  const robots =
    noIndex === false ? KINK_SOCIAL_PUBLIC_LAUNCH_ROBOTS_META : KINK_SOCIAL_ROBOTS_META
  const canonical = path.startsWith('http') ? path : `${origin}${path.startsWith('/') ? path : `/${path}`}`
  const desc = (description ?? `${title} on ${APP_NAME}`).slice(0, 300)
  const image = resolveShareImageUrl({
    shareImageUrl,
    bannerUrl,
    logoUrl,
    heroImageUrl,
    siteDefault: `${origin}/og-default.png`,
  })
  const ogImage = mediaDisplayUrl(image) ?? image

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={desc} />
      <meta name="robots" content={robots} />
      <meta name="googlebot" content={robots} />
      <link rel="canonical" href={canonical} />
      <meta property="og:site_name" content={APP_NAME} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={canonical} />
      {ogImage ? <meta property="og:image" content={ogImage} /> : null}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={desc} />
      {ogImage ? <meta name="twitter:image" content={ogImage} /> : null}
    </Helmet>
  )
}
