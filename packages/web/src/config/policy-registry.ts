/**
 * Kink Social Policy Hub registry - single source for index listings and route aliases.
 * Copy is original Kink Social language only; do not import third-party policy text.
 */
export type PolicyCategory = 'core' | 'safety' | 'community' | 'legal' | 'organizer'

export type PolicyEntry = {
  /** Canonical public path (may differ from policies hub slug). */
  href: string
  /** Hub slug under /policies (without prefix). */
  slug: string
  title: string
  description: string
  category: PolicyCategory
  /** When true, /policies/:slug redirects to href instead of a dedicated page file. */
  alias?: boolean
}

export const POLICY_CATEGORIES: { id: PolicyCategory; label: string }[] = [
  { id: 'core', label: 'Platform agreements' },
  { id: 'safety', label: 'Safety & trust' },
  { id: 'legal', label: 'Legal & copyright' },
  { id: 'community', label: 'Community scope' },
  { id: 'organizer', label: 'Organizers & events' },
]

export const POLICY_REGISTRY: PolicyEntry[] = [
  {
    slug: 'terms',
    href: '/terms',
    title: 'Terms of Service',
    description: 'Account rules, anti-abuse obligations, and your relationship with the platform.',
    category: 'core',
    alias: true,
  },
  {
    slug: 'privacy',
    href: '/privacy',
    title: 'Privacy Policy',
    description: 'What we collect, why, retention, export/delete, and privacy-first defaults.',
    category: 'core',
    alias: true,
  },
  {
    slug: 'community-guidelines',
    href: '/guidelines',
    title: 'Community Guidelines',
    description: 'Consent-first standards, harassment rules, content warnings, and spirit-over-loopholes enforcement.',
    category: 'core',
    alias: true,
  },
  {
    slug: 'adult-content-and-consent',
    href: '/adult-content-consent',
    title: 'Adult Content & Consent',
    description: 'Beta media posture, attestation, and consent expectations for adult-oriented content.',
    category: 'core',
    alias: true,
  },
  {
    slug: 'minor-safety',
    href: '/minor-safety',
    title: 'Minor Safety',
    description: 'Adults-only platform. How we handle suspected minors and CSAM escalation.',
    category: 'safety',
    alias: true,
  },
  {
    slug: 'ncii',
    href: '/ncii',
    title: 'NCII Policy',
    description: 'Non-consensual intimate imagery prohibition, reporting, and human review.',
    category: 'safety',
    alias: true,
  },
  {
    slug: 'appeals',
    href: '/policies/appeals',
    title: 'Appeals',
    description: 'How to appeal moderation decisions after a report becomes a case.',
    category: 'safety',
  },
  {
    slug: 'moderator-code-of-conduct',
    href: '/policies/moderator-code-of-conduct',
    title: 'Moderator Code of Conduct',
    description: 'Service to the community, recusal, confidentiality, and one-strike power abuse enforcement.',
    category: 'safety',
  },
  {
    slug: 'dmca',
    href: '/dmca',
    title: 'DMCA & Copyright',
    description: 'Takedown notices, counter-notices, designated agent, and repeat-infringer policy.',
    category: 'legal',
    alias: true,
  },
  {
    slug: 'law-enforcement',
    href: '/law-enforcement',
    title: 'Law Enforcement Guidelines',
    description: 'Valid legal process, required credentials, preservation holds, and what data Kink Social actually stores.',
    category: 'legal',
    alias: true,
  },
  {
    slug: 'adult-content-records',
    href: '/policies/adult-content-records',
    title: 'User-Generated Content',
    description: 'Kink Social hosts member uploads. We are not a commercial explicit producer and do not collect IDs for 2257-style records.',
    category: 'legal',
  },
  {
    slug: 'groups',
    href: '/policies/groups',
    title: 'Group Guidelines',
    description: 'Member-led groups, local moderation, platform escalation, and owner responsibility.',
    category: 'community',
  },
  {
    slug: 'events',
    href: '/policies/events',
    title: 'Event Guidelines',
    description: 'Consent, on-site staffing, and accountability. Listing on Kink Social is not a safety endorsement.',
    category: 'organizer',
  },
  {
    slug: 'payments',
    href: '/policies/payments',
    title: 'Payments & Disputes',
    description:
      'Sellers own payment processing. kink.social is not merchant of record; refunds and chargebacks go to the seller and your card issuer.',
    category: 'legal',
  },
  {
    slug: 'organizers',
    href: '/vendor-organizer-terms',
    title: 'Vendor & Organizer Terms',
    description: 'Organizer data use, vendor listings, shop rules, and seller-owned payments.',
    category: 'organizer',
    alias: true,
  },
]

export function policiesByCategory(category: PolicyCategory): PolicyEntry[] {
  return POLICY_REGISTRY.filter((p) => p.category === category)
}
