import { createHmac } from 'node:crypto'

export type ImgproxyConfig = {
  enabled: boolean
  operational: boolean
  baseUrl: string
  key: string | null
  salt: string | null
  useHttps: boolean
  defaultQuality: number
  maxWidth: number
  allowUnsigned: boolean
  fallbackToOriginal: boolean
  sourceBaseUrl: string | null
  /** When enabled but misconfigured, imgproxy is treated as off. */
  disableReason: string | null
}

let cachedConfig: ImgproxyConfig | null = null

function envBool(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return defaultValue
  return raw === 'true' || raw === '1'
}

function envInt(name: string, defaultValue: number): number {
  const raw = process.env[name]
  if (!raw) return defaultValue
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : defaultValue
}

function normalizeBaseUrl(raw: string | undefined, useHttps: boolean): string {
  const trimmed = raw?.trim() ?? ''
  if (!trimmed) return ''
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/$/, '')
  }
  return `${useHttps ? 'https' : 'http'}://${trimmed.replace(/\/$/, '')}`
}

export function loadImgproxyConfig(force = false): ImgproxyConfig {
  if (cachedConfig && !force) return cachedConfig

  const enabled = envBool('IMGPROXY_ENABLED', false)
  const useHttps = envBool('IMGPROXY_USE_HTTPS', true)
  const baseUrl = normalizeBaseUrl(process.env.IMGPROXY_BASE_URL, useHttps)
  const key = process.env.IMGPROXY_KEY?.trim() || null
  const salt = process.env.IMGPROXY_SALT?.trim() || null
  const allowUnsigned = envBool('IMGPROXY_ALLOW_UNSIGNED', false)
  const fallbackToOriginal = envBool('IMGPROXY_FALLBACK_TO_ORIGINAL', true)

  let disableReason: string | null = null
  let operational = false

  if (!enabled) {
    disableReason = 'IMGPROXY_ENABLED is not true'
  } else if (!baseUrl) {
    disableReason = 'IMGPROXY_BASE_URL is missing'
  } else if (!key || !salt) {
    if (allowUnsigned) {
      operational = true
    } else {
      disableReason = 'IMGPROXY_KEY or IMGPROXY_SALT missing (set IMGPROXY_ALLOW_UNSIGNED=true for local unsigned only)'
    }
  } else {
    operational = true
  }

  cachedConfig = {
    enabled,
    operational,
    baseUrl,
    key,
    salt,
    useHttps,
    defaultQuality: envInt('IMGPROXY_DEFAULT_QUALITY', 82),
    maxWidth: envInt('IMGPROXY_MAX_WIDTH', 2400),
    allowUnsigned,
    fallbackToOriginal,
    sourceBaseUrl: process.env.IMGPROXY_SOURCE_BASE_URL?.trim() || null,
    disableReason: operational ? null : disableReason,
  }
  return cachedConfig
}

export function resetImgproxyConfigCache(): void {
  cachedConfig = null
}

export function imgproxyStartupDiagnostic(): {
  enabled: boolean
  operational: boolean
  warning: string | null
} {
  const cfg = loadImgproxyConfig()
  if (!cfg.enabled) {
    return { enabled: false, operational: false, warning: null }
  }
  if (!cfg.operational) {
    return {
      enabled: true,
      operational: false,
      warning: cfg.disableReason ?? 'imgproxy disabled due to configuration',
    }
  }
  if (cfg.allowUnsigned && (!cfg.key || !cfg.salt)) {
    return {
      enabled: true,
      operational: true,
      warning: 'imgproxy unsigned mode enabled — not for production',
    }
  }
  return { enabled: true, operational: true, warning: null }
}

const MEDIA_PROXY_PATH_RE = /^\/api\/v1\/media\/assets\/[0-9a-f-]{36}\/content(?:\?|$)/i

function hostFromUrl(raw: string): string | null {
  try {
    return new URL(raw).hostname.toLowerCase()
  } catch {
    return null
  }
}

function collectAllowedSourceHosts(): Set<string> {
  const hosts = new Set<string>()
  for (const raw of [
    process.env.S3_PUBLIC_BASE_URL,
    process.env.S3_ENDPOINT,
    process.env.IMGPROXY_SOURCE_BASE_URL,
    process.env.APP_URL,
    process.env.API_PUBLIC_URL,
    process.env.VITE_API_URL,
  ]) {
    if (!raw?.trim()) continue
    const host = hostFromUrl(raw.startsWith('http') ? raw : `https://${raw}`)
    if (host) hosts.add(host)
  }
  return hosts
}

/** Resolve root-relative API paths to an absolute URL imgproxy can fetch. */
export function resolveImgproxySourceUrl(sourceUrl: string): string | null {
  const trimmed = sourceUrl.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  if (!trimmed.startsWith('/')) return null

  const base =
    process.env.IMGPROXY_SOURCE_BASE_URL?.trim() ||
    process.env.API_PUBLIC_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.VITE_API_URL?.trim() ||
    ''
  if (!base) return null
  return `${base.replace(/\/$/, '')}${trimmed}`
}

/**
 * True when imgproxy may transform this source. Blocks auth-gated proxy paths and arbitrary external URLs.
 */
export function isAllowedImgproxySource(sourceUrl: string): boolean {
  const trimmed = sourceUrl.trim()
  if (!trimmed) return false
  if (MEDIA_PROXY_PATH_RE.test(trimmed)) return false

  const absolute =
    trimmed.startsWith('http://') || trimmed.startsWith('https://') ?
      trimmed
    : trimmed.startsWith('/api/public-seed/') || trimmed.startsWith('/landing/') || trimmed.startsWith('/seed/') ?
      resolveImgproxySourceUrl(trimmed)
    : null

  if (!absolute) return false
  if (!(absolute.startsWith('http://') || absolute.startsWith('https://'))) return false

  const host = hostFromUrl(absolute)
  if (!host) return false
  const allowed = collectAllowedSourceHosts()
  if (allowed.size === 0) return false
  return allowed.has(host)
}

function signImgproxyPath(path: string, cfg: ImgproxyConfig): string {
  if (cfg.allowUnsigned && (!cfg.key || !cfg.salt)) {
    return `/insecure${path}`
  }
  if (!cfg.key || !cfg.salt) {
    throw new Error('imgproxy signing requires IMGPROXY_KEY and IMGPROXY_SALT')
  }
  const hmac = createHmac('sha256', Buffer.from(cfg.key, 'hex'))
  hmac.update(cfg.salt + path)
  const signature = hmac.digest('hex')
  return `/${signature}${path}`
}

export function buildImgproxyProcessingSegment(
  ops: readonly string[],
  cfg: Pick<ImgproxyConfig, 'defaultQuality' | 'maxWidth'>,
): string {
  const parts = [...ops]
  const hasQuality = parts.some((p) => p.startsWith('q:'))
  const hasMaxWidth = parts.some((p) => p.startsWith('w:') || p.startsWith('rs:'))
  if (!hasMaxWidth) parts.push(`w:${cfg.maxWidth}`)
  if (!hasQuality) parts.push(`q:${cfg.defaultQuality}`)
  return parts.join('/')
}

/** Build a signed imgproxy URL for an already-allowed absolute source URL. */
export function buildSignedImgproxyUrl(
  absoluteSourceUrl: string,
  processing: string,
  cfg?: ImgproxyConfig,
): string | null {
  const config = cfg ?? loadImgproxyConfig()
  if (!config.operational || !config.baseUrl) return null
  if (!isAllowedImgproxySource(absoluteSourceUrl)) return null

  const resolved =
    absoluteSourceUrl.startsWith('http') ?
      absoluteSourceUrl
    : resolveImgproxySourceUrl(absoluteSourceUrl)
  if (!resolved) return null

  const encoded = Buffer.from(resolved, 'utf8').toString('base64url')
  const path = `/${processing}/plain/${encoded}@webp`
  const signedPath = signImgproxyPath(path, config)
  return `${config.baseUrl.replace(/\/$/, '')}${signedPath}`
}
