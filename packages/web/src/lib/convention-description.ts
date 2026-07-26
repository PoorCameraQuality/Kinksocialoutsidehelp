import { stripHtml } from '@/lib/stripHtml'

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi

/** Lines that only introduce a link — drop after URLs are moved to structured fields. */
const ORPHAN_LINK_LABEL_RE =
  /^(?:[-*•]\s*)?(?:our\s+)?(?:official\s+)?(?:website|web\s*site|event\s*page|fetlife(?:\s+(?:group|event|page))?|discord|bluesky|instagram|facebook|twitter|x|tiktok|registration|register(?:\s+here)?|tickets?)[:：.]?\s*$/i

export type ConventionOfficialLink = {
  href: string
  label: string
  kind:
    | 'website'
    | 'registration'
    | 'fetlife'
    | 'discord'
    | 'instagram'
    | 'bluesky'
    | 'hotel'
    | 'conduct'
    | 'other'
}

const HERO_SUMMARY_MAX = 220

export function plainConventionText(input: string | null | undefined): string {
  if (!input?.trim()) return ''
  const raw = input.includes('<') ? stripHtml(input) : input
  return raw.replace(/\s+/g, ' ').trim()
}

/** Hero preview: 180–240 characters, never the full description dump. */
export function truncateHeroSummary(input: string | null | undefined, max = HERO_SUMMARY_MAX): string {
  const text = plainConventionText(input)
  if (!text) return ''
  if (text.length <= max) return text
  const slice = text.slice(0, max)
  const breakAt = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '), slice.lastIndexOf(' '))
  const cut = breakAt > max * 0.55 ? breakAt + (slice[breakAt] === ' ' ? 0 : 1) : max
  return `${text.slice(0, cut).trim().replace(/[.,;:]+$/, '')}…`
}

export function extractUrlsFromText(input: string | null | undefined): string[] {
  const text = plainConventionText(input)
  if (!text) return []
  const found = text.match(URL_RE) ?? []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of found) {
    const href = raw.replace(/[.,;:!?)]+$/, '')
    const key = normalizeUrlKey(href)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(href)
  }
  return out
}

export function normalizeUrlKey(href: string): string {
  try {
    const u = new URL(href.trim())
    const host = u.hostname.replace(/^www\./i, '').toLowerCase()
    const path = u.pathname.replace(/\/+$/, '') || ''
    return `${u.protocol}//${host}${path}${u.search}`.toLowerCase()
  } catch {
    return href.trim().replace(/\/+$/, '').toLowerCase()
  }
}

/** Remove standalone URL lines / bare URLs so the About body stays editorial. */
export function stripStandaloneUrls(input: string | null | undefined): string {
  if (!input?.trim()) return ''
  const hasHtml = input.includes('<')
  const text = hasHtml ? stripHtml(input) : input
  const lines = text.split(/\r?\n/).map((line) => {
    const trimmed = line.trim()
    if (!trimmed) return ''
    if (/^https?:\/\/\S+$/i.test(trimmed)) return ''
    const withoutUrls = trimmed.replace(URL_RE, '').replace(/\s{2,}/g, ' ').trim()
    if (!withoutUrls) return ''
    if (ORPHAN_LINK_LABEL_RE.test(withoutUrls)) return ''
    // "Our Website: https://…" → after strip becomes "Our Website:" — already handled;
    // also catch trailing colon-only leftovers like "Discord:"
    if (/^[\w\s/&'-]{1,40}:\s*$/i.test(withoutUrls) && ORPHAN_LINK_LABEL_RE.test(withoutUrls)) return ''
    return withoutUrls
  })

  // Collapse runs of blank lines left by removed link blocks
  const out: string[] = []
  for (const line of lines) {
    if (!line) {
      if (out.length && out[out.length - 1] !== '') out.push('')
      continue
    }
    out.push(line)
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function labelForUrl(href: string): ConventionOfficialLink['kind'] {
  const u = href.toLowerCase()
  if (u.includes('fetlife.com')) return 'fetlife'
  if (u.includes('discord.gg') || u.includes('discord.com')) return 'discord'
  if (u.includes('instagram.com')) return 'instagram'
  if (u.includes('bsky.app') || u.includes('bluesky')) return 'bluesky'
  if (
    u.includes('reg.') ||
    u.includes('register') ||
    u.includes('ticket') ||
    u.includes('eventbrite') ||
    u.includes('ticketspice') ||
    u.includes('passwork')
  ) {
    return 'registration'
  }
  if (u.includes('hotel') || u.includes('marriott') || u.includes('hilton') || u.includes('booking.com')) {
    return 'hotel'
  }
  return 'website'
}

const KIND_LABEL: Record<ConventionOfficialLink['kind'], string> = {
  website: 'Official website',
  registration: 'Registration',
  fetlife: 'FetLife',
  discord: 'Discord',
  instagram: 'Instagram',
  bluesky: 'Bluesky',
  hotel: 'Hotel booking',
  conduct: 'Code of conduct',
  other: 'Link',
}

export function labelOfficialLink(kind: ConventionOfficialLink['kind'], href: string): string {
  if (kind === 'fetlife') {
    if (href.toLowerCase().includes('/group')) return 'FetLife group'
    if (href.toLowerCase().includes('/event')) return 'FetLife event'
    return 'FetLife'
  }
  return KIND_LABEL[kind]
}

function hostLabel(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./i, '')
  } catch {
    return 'Website'
  }
}

export function buildOfficialLinks(input: {
  description?: string | null
  cocUrl?: string | null
  websiteUrl?: string | null
  hotelBlocks?: Array<{ label: string; url?: string; code?: string }> | null
  ticketingUrl?: string | null
  extra?: Array<{ href: string; label?: string; kind?: ConventionOfficialLink['kind'] }> | null
}): ConventionOfficialLink[] {
  const out: ConventionOfficialLink[] = []
  const seen = new Set<string>()
  let websiteCount = 0

  const push = (href: string, kind: ConventionOfficialLink['kind'], label?: string) => {
    const clean = href.trim()
    if (!clean || !/^https?:\/\//i.test(clean)) return
    const key = normalizeUrlKey(clean)
    if (!key || seen.has(key)) return

    let resolvedKind = kind
    let resolvedLabel = label ?? labelOfficialLink(kind, clean)

    // Prefer a single primary website; extra hosts get a hostname label instead of "Official website" × N.
    if (resolvedKind === 'website') {
      websiteCount += 1
      if (websiteCount > 1) {
        resolvedLabel = hostLabel(clean)
      }
    }

    seen.add(key)
    out.push({ href: clean, kind: resolvedKind, label: resolvedLabel })
  }

  if (input.websiteUrl) push(input.websiteUrl, 'website', 'Official website')
  if (input.ticketingUrl) push(input.ticketingUrl, 'registration', 'Registration')
  for (const href of extractUrlsFromText(input.description)) {
    push(href, labelForUrl(href))
  }
  if (input.cocUrl) push(input.cocUrl, 'conduct', 'Code of conduct')
  for (const block of input.hotelBlocks ?? []) {
    if (block.url) push(block.url, 'hotel', block.label?.trim() || 'Hotel booking')
  }
  for (const extra of input.extra ?? []) {
    push(extra.href, extra.kind ?? labelForUrl(extra.href), extra.label)
  }

  const order: ConventionOfficialLink['kind'][] = [
    'registration',
    'website',
    'fetlife',
    'discord',
    'instagram',
    'bluesky',
    'hotel',
    'conduct',
    'other',
  ]
  out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
  return out
}
