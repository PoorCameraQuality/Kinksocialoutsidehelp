import type { FastifyRequest } from 'fastify'

/** Whether Fastify should treat X-Forwarded-* as client IP (production behind Caddy). */
export function isTrustProxyEnabled(): boolean {
  if (process.env.C2K_TRUST_PROXY === 'true') return true
  if (process.env.C2K_TRUST_PROXY === 'false') return false
  return process.env.NODE_ENV === 'production' || process.env.C2K_ENV === 'production'
}

/**
 * Client IP for rate limits and registration bans.
 * Never reads X-Forwarded-For directly — uses Fastify's proxy-aware req.ip when trust is enabled.
 */
export function getRequestIpRaw(req: FastifyRequest): string {
  if (isTrustProxyEnabled()) {
    const ip = req.ip?.trim()
    if (ip && ip.length > 0) return ip
  }
  const addr = req.socket?.remoteAddress
  return addr && addr.length > 0 ? addr : '127.0.0.1'
}

/**
 * Registration / ban bucket: IPv4 as-is (strip IPv4-mapped IPv6 wrapper).
 * IPv6: store the first four hextets (IPv6 slash-64 style grouping).
 */
export function registrationIpPrefixFromRequest(req: FastifyRequest): string {
  const raw = getRequestIpRaw(req)
  const v4mapped = raw.replace(/^::ffff:/i, '')
  if (!v4mapped.includes(':')) {
    return v4mapped.slice(0, 64)
  }
  const host = v4mapped.split('%')[0] ?? v4mapped
  const parts = host.split(':').filter((p) => p.length > 0)
  if (parts.length >= 4) {
    return parts.slice(0, 4).join(':').toLowerCase()
  }
  return host.toLowerCase().slice(0, 64)
}

/** Full normalized client IP for reputation events (best-effort). */
export function clientIpLabel(req: FastifyRequest): string {
  return getRequestIpRaw(req).replace(/^::ffff:/i, '').slice(0, 64)
}
