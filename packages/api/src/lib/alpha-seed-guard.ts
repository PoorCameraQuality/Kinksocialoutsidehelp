/**
 * Safety guards for alpha demo seed — refuses accidental production runs.
 */
import { isProductionRuntime } from './production-guard.js'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', 'postgres', 'host.docker.internal'])

function databaseHost(): string | null {
  const url = process.env.DATABASE_URL
  if (!url) return null
  try {
    return new URL(url.replace(/^postgresql:\/\//, 'postgres://')).hostname.toLowerCase()
  } catch {
    return null
  }
}

function looksLikeProductionDatabase(host: string | null): boolean {
  if (!host) return false
  if (LOCAL_HOSTS.has(host)) return false
  return /(?:\.rds\.|\.supabase\.|neon\.tech|render\.com|railway\.|planetscale|azure|cloud\.google)/.test(
    host,
  )
}

export function assertAlphaSeedAllowed(log: Pick<Console, 'error' | 'warn' | 'info'> = console): void {
  const allowAlpha = process.env.ALLOW_ALPHA_SEED === 'true'
  const useDatabase = process.env.USE_DATABASE === 'true'
  const nonProdDev = process.env.NODE_ENV !== 'production' && useDatabase
  const forceProd = process.env.FORCE_ALPHA_SEED_ON_PROD === 'true'

  if (!allowAlpha && !nonProdDev) {
    log.error(
      'Alpha seed refused. Set ALLOW_ALPHA_SEED=true or run with NODE_ENV !== production and USE_DATABASE=true.',
    )
    process.exit(1)
  }

  const host = databaseHost()
  const prodDb = looksLikeProductionDatabase(host)
  const isProd = isProductionRuntime()

  if ((isProd || prodDb) && !forceProd && !allowAlpha) {
    log.error(
      `Alpha seed refused: DATABASE_URL host "${host ?? 'unknown'}" looks non-local. Set ALLOW_ALPHA_SEED=true to override.`,
    )
    process.exit(1)
  }

  if ((isProd || prodDb) && (forceProd || allowAlpha)) {
    log.warn('')
    log.warn('═══════════════════════════════════════════════════════════════')
    log.warn('  WARNING: Alpha seed running against a production-like database.')
    log.warn('  Demo content will be appended. Use db:clear:alpha:ecke to remove.')
    log.warn('═══════════════════════════════════════════════════════════════')
    log.warn('')
  }

  if (useDatabase === false && process.env.DATABASE_URL) {
    log.info('Alpha seed: USE_DATABASE not set; proceeding because DATABASE_URL is present.')
  }

  log.info(`Alpha seed allowed (host=${host ?? 'default-local'}).`)
}
