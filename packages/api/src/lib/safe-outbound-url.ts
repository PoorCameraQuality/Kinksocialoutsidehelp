/**
 * PR 3 (M3 + M7): SSRF guard for server-side fetches of user-supplied URLs
 * (podcast RSS sync, org-import image rehosting).
 *
 * Policy: https-only; reject loopback, RFC1918, link-local, CGNAT, unspecified,
 * and cloud-metadata hosts; resolve DNS and check every address (defeats
 * hostnames pointed at internal IPs); redirects are followed manually and each
 * hop is re-validated.
 */
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export class UnsafeOutboundUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafeOutboundUrlError'
  }
}

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal', 'metadata'])

const MAX_REDIRECTS = 3

function ipv4IsPrivate(ip: string): boolean {
  const octets = ip.split('.').map((n) => Number(n))
  if (octets.length !== 4 || octets.some((n) => Number.isNaN(n))) return true
  const [a, b] = octets as [number, number, number, number]
  if (a === 0) return true // 0.0.0.0/8 unspecified
  if (a === 10) return true // RFC1918
  if (a === 127) return true // loopback
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64/10
  if (a === 169 && b === 254) return true // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true // RFC1918
  if (a === 192 && b === 168) return true // RFC1918
  if (a === 192 && b === 0) return true // 192.0.0.0/24 special
  if (a === 198 && (b === 18 || b === 19)) return true // benchmarking
  if (a >= 224) return true // multicast + reserved
  return false
}

function ipv4MappedFromV6(lower: string): string | null {
  // Dotted form: ::ffff:10.0.0.1
  const dotted = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (dotted) return dotted[1]!
  // Node URL.hostname normalizes to hex: ::ffff:a00:1
  const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (!hex) return null
  const hi = Number.parseInt(hex[1]!, 16)
  const lo = Number.parseInt(hex[2]!, 16)
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
}

function ipIsPrivate(ip: string): boolean {
  const version = isIP(ip)
  if (version === 4) return ipv4IsPrivate(ip)
  if (version !== 6) return true
  const lower = ip.toLowerCase()
  const mapped = ipv4MappedFromV6(lower)
  if (mapped) return ipv4IsPrivate(mapped)
  if (lower === '::' || lower === '::1') return true // unspecified / loopback
  if (lower.startsWith('fe80:')) return true // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true // ULA fc00::/7
  if (lower.startsWith('ff')) return true // multicast
  return false
}

/**
 * Validate that a URL is a safe https target for a server-side fetch.
 * Resolves DNS for hostnames and rejects when any resolved address is
 * private/internal. Returns the parsed URL on success.
 */
export async function assertSafeOutboundHttpsUrl(rawUrl: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new UnsafeOutboundUrlError('Invalid URL')
  }

  if (url.protocol !== 'https:') {
    throw new UnsafeOutboundUrlError('Only https URLs are allowed')
  }
  if (url.username || url.password) {
    throw new UnsafeOutboundUrlError('URLs with embedded credentials are not allowed')
  }

  // Strip IPv6 brackets for literal checks.
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local')
  ) {
    throw new UnsafeOutboundUrlError('Host is not reachable from the public internet')
  }

  if (isIP(hostname)) {
    if (ipIsPrivate(hostname)) {
      throw new UnsafeOutboundUrlError('IP address is private or reserved')
    }
    return url
  }

  let addresses: { address: string }[]
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw new UnsafeOutboundUrlError('Host did not resolve')
  }
  if (addresses.length === 0) {
    throw new UnsafeOutboundUrlError('Host did not resolve')
  }
  for (const { address } of addresses) {
    if (ipIsPrivate(address)) {
      throw new UnsafeOutboundUrlError('Host resolves to a private or reserved address')
    }
  }
  return url
}

export type SafeOutboundFetchOptions = {
  headers?: Record<string, string>
  timeoutMs?: number
  /** Injectable for tests. */
  fetchImpl?: typeof fetch
}

/**
 * Fetch a user-supplied URL with the SSRF guard applied to the initial URL and
 * to every redirect hop (redirects are never followed blindly).
 */
export async function fetchSafeOutboundUrl(
  rawUrl: string,
  options: SafeOutboundFetchOptions = {}
): Promise<Response> {
  const doFetch = options.fetchImpl ?? fetch
  let currentUrl = rawUrl

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertSafeOutboundHttpsUrl(currentUrl)
    const res = await doFetch(url.toString(), {
      headers: options.headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
    })

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) {
        throw new UnsafeOutboundUrlError('Redirect without a Location header')
      }
      // Resolve relative redirects against the current URL; the next loop
      // iteration re-validates the target.
      currentUrl = new URL(location, url).toString()
      continue
    }

    return res
  }

  throw new UnsafeOutboundUrlError('Too many redirects')
}
