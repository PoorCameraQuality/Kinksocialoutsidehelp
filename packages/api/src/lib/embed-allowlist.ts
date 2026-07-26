/** Hostnames allowed for ticketing widget / checkout embed URLs (https only). */
const DEFAULT_TICKET_EMBED_HOSTS = ['eventbrite.com', 'www.eventbrite.com', 'universe.com', 'www.universe.com']

function parseHostList(envValue: string | undefined): string[] {
  if (!envValue?.trim()) return []
  return envValue
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

function hostnameMatchesAllowlist(hostname: string, hosts: string[]): boolean {
  const h = hostname.toLowerCase()
  return hosts.some((allowed) => h === allowed || h.endsWith(`.${allowed}`))
}

export function getTicketEmbedAllowlist(): string[] {
  const fromEnv = parseHostList(process.env.C2K_EMBED_ALLOWLIST_HOSTS)
  return fromEnv.length > 0 ? fromEnv : DEFAULT_TICKET_EMBED_HOSTS
}

/**
 * Org “lazy” external site iframe. Empty env = disallow all (feature stays safe-by-default).
 * Set `C2K_EXTERNAL_SITE_EMBED_HOSTS=example.com,www.example.com` to permit.
 */
export function getExternalSiteEmbedAllowlist(): string[] {
  return parseHostList(process.env.C2K_EXTERNAL_SITE_EMBED_HOSTS)
}

export function isAllowedHttpsUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr)
    return u.protocol === 'https:'
  } catch {
    return false
  }
}

export function isAllowedTicketEmbedUrl(urlStr: string): boolean {
  if (!isAllowedHttpsUrl(urlStr)) return false
  try {
    const host = new URL(urlStr).hostname
    return hostnameMatchesAllowlist(host, getTicketEmbedAllowlist())
  } catch {
    return false
  }
}

export function isAllowedExternalOrgEmbedUrl(urlStr: string): boolean {
  if (!isAllowedHttpsUrl(urlStr)) return false
  const hosts = getExternalSiteEmbedAllowlist()
  if (hosts.length === 0) return false
  try {
    const host = new URL(urlStr).hostname
    return hostnameMatchesAllowlist(host, hosts)
  } catch {
    return false
  }
}
