/**
 * Production runtime guards - auth fallback and destructive DB operations.
 * Import from server/worker startup and destructive DB scripts only.
 */

import {
  isProductionRuntime as sharedIsProductionRuntime,
  isStrictScannerRuntime,
  listForbiddenScannerOverridesForStrictRuntime,
  readMediaScannerStartupConfig,
} from '@c2k/shared'
import { createHash } from 'node:crypto'

export function isProductionRuntime(): boolean {
  return sharedIsProductionRuntime()
}

function authFallbackEnvValue(): string | undefined {
  return process.env.AUTH_ALLOW_FALLBACK ?? process.env.VITE_AUTH_ALLOW_FALLBACK
}

/** True only when env explicitly sets fallback to "true". */
export function isAuthFallbackExplicitlyEnabled(): boolean {
  return authFallbackEnvValue() === 'true'
}

/**
 * Session mock viewer (RopeDreamer) for unauthenticated reads in dev/demo.
 * Always false in production; in non-production, disabled only when env is literally "false".
 */
export function allowAuthFallback(): boolean {
  if (isProductionRuntime()) return false
  return authFallbackEnvValue() !== 'false'
}

/**
 * Refuse API/worker startup when auth fallback is explicitly enabled in production.
 */
const DEV_AUTH_SECRET = 'dev-insecure-auth-secret-change-me-in-env'
const DEV_COOKIE_SECRET = 'dev-cookie-secret-change-in-production'
const DEV_EXTERNAL_STORE_SECRET = 'dev-insecure-external-store-key'

/**
 * Refuse API/worker startup when production uses missing or dev-default session/cookie secrets.
 */
export function assertProductionSecretsForStartup(log: Pick<Console, 'info' | 'error'> = console): void {
  if (!isProductionRuntime()) return

  const authSecret = process.env.AUTH_SECRET?.trim() ?? ''
  const cookieSecret = process.env.COOKIE_SECRET?.trim() ?? ''
  const externalStoreSecret = process.env.EXTERNAL_STORE_SECRET?.trim() ?? ''
  const problems: string[] = []

  if (!authSecret || authSecret === DEV_AUTH_SECRET) {
    problems.push('AUTH_SECRET must be set to a strong unique value in production')
  }
  if (!cookieSecret || cookieSecret === DEV_COOKIE_SECRET) {
    problems.push('COOKIE_SECRET must be set to a strong unique value in production')
  }
  if (!externalStoreSecret) {
    problems.push('EXTERNAL_STORE_SECRET must be set in production (encrypts Woo/Shopify/Etsy OAuth tokens)')
  } else {
    const derivedDevKey = createHash('sha256').update('dev-insecure-external-store-key').digest('hex')
    const derivedConfigured = createHash('sha256').update(externalStoreSecret, 'utf8').digest('hex')
    if (derivedConfigured === derivedDevKey) {
      problems.push('EXTERNAL_STORE_SECRET must not use the dev default in production')
    }
  }

  if (problems.length > 0) {
    for (const msg of problems) log.error(`Fatal: ${msg}`)
    process.exit(1)
  }

  log.info('Production auth/cookie secrets configured.')
}

export function assertAuthFallbackSafeForStartup(log: Pick<Console, 'info' | 'error'> = console): void {
  if (!isProductionRuntime()) {
    if (allowAuthFallback()) {
      log.info('Auth fallback enabled for non-production (mock viewer when unauthenticated).')
    }
    return
  }

  if (isAuthFallbackExplicitlyEnabled()) {
    log.error(
      'Fatal: auth fallback cannot be enabled in production. Set AUTH_ALLOW_FALLBACK=false or unset AUTH_ALLOW_FALLBACK.',
    )
    process.exit(1)
  }

  log.info('Auth fallback disabled in production.')
}

/**
 * Refuse API/worker startup when production/staging carries scanner-weakening
 * env overrides (launch-hardening PR 3, M8 + M9). The overrides are also
 * hard-ignored at runtime; refusing startup makes the misconfiguration loud
 * instead of silently corrected. No ack escape hatch.
 */
export function assertMediaScannerSafeForStartup(log: Pick<Console, 'info' | 'error'> = console): void {
  const config = readMediaScannerStartupConfig()
  log.info(
    `Media scanner profile=${config.runtimeProfile} strict=${config.strictMode} allowNoop=${config.allowNoop} malwareMode=${config.malwareMode}`,
  )

  if (!isStrictScannerRuntime()) return

  const forbidden = listForbiddenScannerOverridesForStrictRuntime()
  if (forbidden.length > 0) {
    log.error(
      `Fatal: scanner-weakening env overrides must not be set in ${config.runtimeProfile}: ${forbidden.join(', ')}. Remove them (noop/simulate hooks are ignored under the strict scanner runtime).`,
    )
    process.exit(1)
  }

  log.info('Media scanner strict runtime: noop/simulate overrides absent.')
}

/**
 * Refuse API startup when production boots without a database (launch-hardening
 * PR 3, A3): without USE_DATABASE=true the login route falls through to the
 * static demo-password branch, which must never be reachable in production.
 */
export function assertDatabaseConfiguredForStartup(log: Pick<Console, 'info' | 'error'> = console): void {
  if (!isProductionRuntime()) return
  if (process.env.USE_DATABASE !== 'true') {
    log.error(
      'Fatal: production requires USE_DATABASE=true. Demo/mock login is refused in production; set USE_DATABASE=true and DATABASE_URL.',
    )
    process.exit(1)
  }
  log.info('Database-backed auth enforced in production.')
}

/**
 * Refuse API startup when production disables rate limiting (launch-hardening
 * PR 3, A5): C2K_RATE_LIMIT_DISABLE removes login/reset throttling globally.
 */
export function assertRateLimitEnabledForStartup(log: Pick<Console, 'info' | 'error'> = console): void {
  if (!isProductionRuntime()) return
  if (process.env.C2K_RATE_LIMIT_DISABLE === 'true') {
    log.error(
      'Fatal: C2K_RATE_LIMIT_DISABLE=true cannot be set in production. Remove it to keep auth endpoints throttled.',
    )
    process.exit(1)
  }
  log.info('Rate limiting enabled in production.')
}

/**
 * Refuse API startup when production has no usable CORS allowlist.
 * Empty/whitespace `CORS_ORIGIN=` would otherwise collapse to a broken allowlist.
 */
export function assertCorsOriginForStartup(log: Pick<Console, 'info' | 'error'> = console): void {
  if (!isProductionRuntime()) return
  const raw = process.env.CORS_ORIGIN
  const origins = raw?.split(',').map((s) => s.trim()).filter(Boolean) ?? []
  if (origins.length === 0) {
    log.error(
      'Fatal: production requires CORS_ORIGIN with at least one non-empty origin (comma-separated). Example: https://kink.social',
    )
    process.exit(1)
  }
  log.info(`CORS origin allowlist configured (${origins.length}).`)
}

/**
 * Block seed/wipe in production unless operator sets C2K_ALLOW_DESTRUCTIVE_DB_RESET=true.
 */
export function assertDestructiveDbAllowed(
  operation: 'seed' | 'wipe',
  log: Pick<Console, 'error' | 'warn'> = console,
): void {
  if (!isProductionRuntime()) return

  if (process.env.C2K_ALLOW_DESTRUCTIVE_DB_RESET !== 'true') {
    log.error(
      `Fatal: db:${operation} refused in production. Do not run destructive commands against production data.`,
    )
    log.error(
      'If you truly intend to destroy production data, set C2K_ALLOW_DESTRUCTIVE_DB_RESET=true (not recommended).',
    )
    process.exit(1)
  }

  log.warn(`WARNING: destructive db:${operation} running in production (C2K_ALLOW_DESTRUCTIVE_DB_RESET=true).`)
}

/** Warn when DATABASE_URL hostname looks like a managed/production host (non-blocking). */
export function warnIfProductionDatabaseUrl(log: Pick<Console, 'warn'> = console): void {
  const url = process.env.DATABASE_URL
  if (!url) return
  try {
    const host = new URL(url.replace(/^postgresql:\/\//, 'postgres://')).hostname.toLowerCase()
    const suspicious =
      /(?:\.rds\.|\.supabase\.|neon\.tech|render\.com|railway\.|planetscale|azure|cloud\.google)/.test(host) ||
      (!isProductionRuntime() && !['localhost', '127.0.0.1', 'postgres', 'host.docker.internal'].includes(host))
    if (suspicious && !isProductionRuntime()) {
      log.warn(
        `DATABASE_URL host "${host}" may be non-local. Confirm before running db:seed or db:wipe (destructive in default seed path).`,
      )
    }
  } catch {
    /* ignore parse errors */
  }
}
