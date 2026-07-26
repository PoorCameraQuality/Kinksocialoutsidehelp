/** Client-side guard for ticket widget iframe src (keep aligned with API allowlist). */
const DEFAULT_HOSTS = ['eventbrite.com', 'www.eventbrite.com', 'universe.com', 'www.universe.com']

function hostAllowed(hostname: string, hosts: string[]): boolean {
  const h = hostname.toLowerCase()
  return hosts.some((x) => h === x || h.endsWith(`.${x}`))
}

export function isTicketEmbedUrlAllowed(urlStr: string): boolean {
  try {
    const u = new URL(urlStr)
    if (u.protocol !== 'https:') return false
    return hostAllowed(u.hostname, DEFAULT_HOSTS)
  } catch {
    return false
  }
}
