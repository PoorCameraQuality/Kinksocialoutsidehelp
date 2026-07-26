import { Helmet } from 'react-helmet-async'
import { APP_NAME, APP_URL, KINK_SOCIAL_PUBLIC_LAUNCH_ROBOTS_META, KINK_SOCIAL_ROBOTS_META } from '@c2k/shared'
import {
  LANDING_FAQ_ITEMS,
  LANDING_OG_DESCRIPTION,
  LANDING_OG_TITLE,
  LANDING_SEO_DESCRIPTION,
  LANDING_SEO_KEYWORDS,
  LANDING_SEO_TITLE,
} from '@/components/landing/landing-beta-content'

const publicLaunch = import.meta.env.VITE_PUBLIC_LAUNCH === 'true'

function siteOrigin(): string {
  const raw = import.meta.env.VITE_SITE_URL ?? (typeof window !== 'undefined' ? window.location.origin : APP_URL)
  return String(raw).replace(/\/$/, '')
}

function faqSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: LANDING_FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

/** Landing page SEO — primary indexable brand URL (see KINK_SOCIAL_PUBLIC_SITEMAP_PATHS). */
export default function LandingPageMeta() {
  const origin = siteOrigin()
  const robots = publicLaunch ? KINK_SOCIAL_PUBLIC_LAUNCH_ROBOTS_META : KINK_SOCIAL_ROBOTS_META
  const image = `${origin}/og-default.png`

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: APP_NAME,
    url: `${origin}/`,
    logo: `${origin}/og-default.png`,
    description: LANDING_SEO_DESCRIPTION,
  }

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: APP_NAME,
    url: `${origin}/`,
    description: LANDING_SEO_DESCRIPTION,
    inLanguage: 'en-US',
  }

  return (
    <Helmet>
      <title>{LANDING_SEO_TITLE}</title>
      <meta name="description" content={LANDING_SEO_DESCRIPTION} />
      <meta name="keywords" content={LANDING_SEO_KEYWORDS} />
      <meta name="robots" content={robots} />
      <meta name="googlebot" content={robots} />
      <link rel="canonical" href={`${origin}/`} />
      <meta property="og:site_name" content={APP_NAME} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={`${origin}/`} />
      <meta property="og:title" content={LANDING_OG_TITLE} />
      <meta property="og:description" content={LANDING_OG_DESCRIPTION} />
      <meta property="og:image" content={image} />
      <meta
        property="og:image:alt"
        content="Kink Social — kink events, groups, education, and community. Public beta."
      />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={LANDING_OG_TITLE} />
      <meta name="twitter:description" content={LANDING_SEO_DESCRIPTION} />
      <meta name="twitter:image" content={image} />
      <script type="application/ld+json">{JSON.stringify(organizationSchema)}</script>
      <script type="application/ld+json">{JSON.stringify(websiteSchema)}</script>
      <script type="application/ld+json">{JSON.stringify(faqSchema())}</script>
    </Helmet>
  )
}
