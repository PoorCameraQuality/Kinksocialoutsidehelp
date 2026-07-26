/**
 * kink.social is the private member app.
 * Public indexing is an allowlist of brand and legal pages only.
 * Event, vendor, and directory SEO live on ECKE. Never index member profiles, feed, DMs, or home.
 */

export const KINK_SOCIAL_X_ROBOTS_TAG = 'noindex, nofollow, noarchive, nosnippet'

export const KINK_SOCIAL_ROBOTS_META = 'noindex, nofollow, noarchive, nosnippet'

/** Robots meta for allowlisted public marketing / legal URLs when VITE_PUBLIC_LAUNCH is on. */
export const KINK_SOCIAL_PUBLIC_LAUNCH_ROBOTS_META = 'index, follow'

/**
 * Indexable kink.social paths (no user-generated member surfaces).
 * Keep in sync with Caddy `@not_landing` exceptions and `public/robots.txt`.
 */
export const KINK_SOCIAL_PUBLIC_SITEMAP_PATHS = [
  '/',
  '/about',
  '/terms',
  '/privacy',
  '/guidelines',
  '/adult-content-consent',
  '/minor-safety',
  '/ncii',
  '/dmca',
  '/law-enforcement',
  '/security',
  '/policies',
  '/policies/appeals',
  '/policies/moderator-code-of-conduct',
  '/policies/adult-content-records',
  '/policies/groups',
  '/policies/events',
  '/policies/payments',
  '/vendor-organizer-terms',
] as const

/** Normalize pathname for allowlist checks. Strip query. Drop trailing slash except root. */
export function normalizeKinkSocialPathname(pathname: string): string {
  const raw = (pathname.split('?')[0] ?? '/').trim() || '/'
  if (raw.length > 1 && raw.endsWith('/')) return raw.slice(0, -1)
  return raw
}

/** True when this HTML path may be indexed under public launch (brand/legal allowlist only). */
export function isKinkSocialPublicIndexPath(pathname: string): boolean {
  const path = normalizeKinkSocialPathname(pathname)
  if (path === '/') return true
  for (const allowed of KINK_SOCIAL_PUBLIC_SITEMAP_PATHS) {
    if (allowed === '/') continue
    if (path === allowed) return true
    // /policies covers hub children if a new policy page is added under the hub.
    if (allowed === '/policies' && path.startsWith('/policies/')) return true
  }
  return false
}

/**
 * robots.txt Allow lines for public launch.
 * Exact paths use $ where Google supports end-anchors. /policies is a prefix for the hub tree.
 */
export function kinkSocialPublicRobotsAllowLines(): string[] {
  // Put sitemap first so some parsers do not lose it under Disallow: /.
  const lines: string[] = ['Allow: /sitemap.xml', 'Allow: /$']
  for (const path of KINK_SOCIAL_PUBLIC_SITEMAP_PATHS) {
    if (path === '/') continue
    if (path === '/policies') {
      lines.push('Allow: /policies')
      continue
    }
    // Covered by the /policies prefix Allow above.
    if (path.startsWith('/policies/')) continue
    lines.push(`Allow: ${path}$`)
  }
  return lines
}

/**
 * Caddy `@not_landing` exceptions: crawl files + brand/legal HTML.
 * Paths ending in `*` are prefix matchers (Caddy path syntax).
 */
export function kinkSocialPublicCaddyExemptPaths(): string[] {
  const paths = new Set<string>(['/', '/robots.txt', '/sitemap.xml'])
  for (const path of KINK_SOCIAL_PUBLIC_SITEMAP_PATHS) {
    // Hub children are covered by the `/policies/*` prefix matcher.
    if (path.startsWith('/policies/')) continue
    paths.add(path)
  }
  paths.add('/policies/*')
  return [...paths]
}

export function isKinkSocialPublicLaunchEnabled(flag?: string | boolean | null): boolean {

  if (typeof flag === 'boolean') return flag

  const raw = flag ?? ''

  return raw === 'true' || raw === '1'

}



export function buildKinkSocialRobotsTxt(
  publicLaunch: boolean,
  siteUrl = 'https://kink.social',
): string {

  if (!publicLaunch) {

    return 'User-agent: *\nDisallow: /\n'

  }

  const base = siteUrl.replace(/\/$/, '')

  return [
    'User-agent: *',
    // Allow lines before Disallow: /. Helps GSC and older parsers find the sitemap.
    ...kinkSocialPublicRobotsAllowLines(),
    'Disallow: /',
    '',
    // Google needs an absolute Sitemap URL. Relative paths are ignored.
    `Sitemap: ${base}/sitemap.xml`,
  ].join('\n')
}



/** RFC 9116 security contact file for kink.social (/.well-known/security.txt). */

export const KINK_SOCIAL_SECURITY_TXT_CONTACT = 'mailto:sheldonkinneymmo.tm@gmail.com'

export const KINK_SOCIAL_SECURITY_TXT_EXPIRES = '2027-06-30T09:27:00.000Z'

export const KINK_SOCIAL_SECURITY_POLICY_PATH = '/security'



export type KinkSocialCsafProviderMetadata = {

  canonical_url: string

  last_updated: string

  list_on_CSAF_aggregators: boolean

  mirror_on_CSAF_aggregators: boolean

  metadata_version: '2.0'

  publisher: {

    category: 'vendor'

    contact_details: string

    name: string

    namespace: string

  }

  role: 'csaf_trusted_provider'

}



export function buildKinkSocialCsafProviderMetadata(siteUrl: string): KinkSocialCsafProviderMetadata {

  const base = siteUrl.replace(/\/$/, '')

  return {

    canonical_url: `${base}/.well-known/csaf/provider-metadata.json`,

    last_updated: new Date().toISOString(),

    list_on_CSAF_aggregators: false,

    mirror_on_CSAF_aggregators: false,

    metadata_version: '2.0',

    publisher: {

      category: 'vendor',

      contact_details: KINK_SOCIAL_SECURITY_TXT_CONTACT,

      name: 'Kink Social',

      namespace: base,

    },

    role: 'csaf_trusted_provider',

  }

}



export function buildKinkSocialSecurityTxt(siteUrl: string): string {

  const base = siteUrl.replace(/\/$/, '')

  return [

    `Contact: ${KINK_SOCIAL_SECURITY_TXT_CONTACT}`,

    `Expires: ${KINK_SOCIAL_SECURITY_TXT_EXPIRES}`,

    'Preferred-Languages: en',

    `Policy: ${base}${KINK_SOCIAL_SECURITY_POLICY_PATH}`,

    `CSAF: ${base}/.well-known/csaf/provider-metadata.json`,

    `Canonical: ${base}/.well-known/security.txt`,

    '',

  ].join('\n')

}



export function buildKinkSocialSitemapXml(siteUrl: string): string {

  const base = siteUrl.replace(/\/$/, '')

  const urls = KINK_SOCIAL_PUBLIC_SITEMAP_PATHS.map((path) => {

    const loc = path === '/' ? `${base}/` : `${base}${path}`

    return `  <url><loc>${loc}</loc></url>`

  }).join('\n')

  return [

    '<?xml version="1.0" encoding="UTF-8"?>',

    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',

    urls,

    '</urlset>',

  ].join('\n')

}

/**
 * Re-exports from ecke-publish-safety.ts so older seo-policy imports still work.
 */
export {
  ECKE_DOMAIN,
  ECKE_URL,
  ECKE_KINK_SOCIAL_EXPLAINER_PATH,
  ECKE_EDUCATION_ATTRIBUTION_URL_KEYS,
  eckePayloadContainsPrivateAppUrls,
  educationEckePayloadContainsLeakedPrivateUrls,
  isEckePublishEligible,
  sanitizeEckeArticleSlug,
  sanitizeEckeEducationBodyHtml,
  sanitizeEckeEducationPublicText,
  sanitizeEckeExternalUrl,
  sanitizeEckeHeroImageUrl,
  sanitizeEckePublicText,
  type EckePublishEligibilityInput,
} from './ecke-publish-safety.js'

