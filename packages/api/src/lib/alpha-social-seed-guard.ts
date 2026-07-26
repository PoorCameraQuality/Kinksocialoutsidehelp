/**
 * Stricter guard for alpha social seed — always requires explicit opt-in.
 */
import { isProductionRuntime } from './production-guard.js'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', 'postgres', 'host.docker.internal'])

export const ALPHA_SOCIAL_SEED_ENV = 'ALLOW_ALPHA_SOCIAL_SEED'
export const ALPHA_SOCIAL_FORCE_PROD_ENV = 'FORCE_ALPHA_SOCIAL_SEED_ON_PROD'

function databaseHost(env: NodeJS.ProcessEnv = process.env): string | null {
  const url = env.DATABASE_URL
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

export type AlphaSocialSeedGuardResult =
  | { allowed: true; host: string | null }
  | { allowed: false; reason: string }

/** Pure guard evaluation for tests (does not exit). */
export function evaluateAlphaSocialSeedAllowed(
  env: NodeJS.ProcessEnv = process.env,
): AlphaSocialSeedGuardResult {
  if (env[ALPHA_SOCIAL_SEED_ENV] !== 'true') {
    return {
      allowed: false,
      reason: `Set ${ALPHA_SOCIAL_SEED_ENV}=true to run the alpha social seed.`,
    }
  }
  if (env.USE_DATABASE !== 'true') {
    return {
      allowed: false,
      reason: 'Set USE_DATABASE=true to run the alpha social seed.',
    }
  }

  const host = databaseHost(env)
  const prodDb = looksLikeProductionDatabase(host)
  const isProd = env.NODE_ENV === 'production' || env.C2K_ENV === 'production'

  if (isProd && env[ALPHA_SOCIAL_FORCE_PROD_ENV] !== 'true') {
    return {
      allowed: false,
      reason: `Production runtime refused. Set ${ALPHA_SOCIAL_FORCE_PROD_ENV}=true only when intentionally seeding production.`,
    }
  }

  if (prodDb && env[ALPHA_SOCIAL_FORCE_PROD_ENV] !== 'true' && env[ALPHA_SOCIAL_SEED_ENV] !== 'true') {
    return {
      allowed: false,
      reason: `DATABASE_URL host "${host ?? 'unknown'}" looks non-local.`,
    }
  }

  return { allowed: true, host }
}

export function assertAlphaSocialSeedAllowed(log: Pick<Console, 'error' | 'warn' | 'info'> = console): void {
  const result = evaluateAlphaSocialSeedAllowed()
  if (!result.allowed) {
    log.error(`Alpha social seed refused: ${result.reason}`)
    process.exit(1)
  }

  const host = result.host
  const prodDb = looksLikeProductionDatabase(host)
  const isProd = isProductionRuntime()

  if (isProd || prodDb) {
    log.warn('')
    log.warn('═══════════════════════════════════════════════════════════════')
    log.warn('  WARNING: Alpha social seed on a production-like environment.')
    log.warn('  Append-only fictional rows — existing ECKE/event data is not wiped.')
    log.warn('═══════════════════════════════════════════════════════════════')
    log.warn('')
  }

  log.info(`Alpha social seed allowed (host=${host ?? 'default-local'}).`)
}
