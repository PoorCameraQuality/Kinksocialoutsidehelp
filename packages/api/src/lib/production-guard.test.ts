import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
  allowAuthFallback,
  assertCorsOriginForStartup,
  assertDatabaseConfiguredForStartup,
  assertMediaScannerSafeForStartup,
  assertRateLimitEnabledForStartup,
  isAuthFallbackExplicitlyEnabled,
  isProductionRuntime,
} from './production-guard.js'

const ENV_KEYS = [
  'NODE_ENV',
  'C2K_ENV',
  'AUTH_ALLOW_FALLBACK',
  'VITE_AUTH_ALLOW_FALLBACK',
  'USE_DATABASE',
  'C2K_RATE_LIMIT_DISABLE',
  'CORS_ORIGIN',
  'MEDIA_SCANNER_ALLOW_NOOP',
  'MEDIA_SCAN_SIMULATE_CLASSIFIER',
] as const

function saveEnv(): Record<string, string | undefined> {
  const saved: Record<string, string | undefined> = {}
  for (const key of ENV_KEYS) saved[key] = process.env[key]
  return saved
}

function restoreEnv(saved: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
}

describe('production-guard', () => {
  let saved: Record<string, string | undefined>

  afterEach(() => {
    restoreEnv(saved)
  })

  it('isProductionRuntime is true when NODE_ENV or C2K_ENV is production', () => {
    saved = saveEnv()
    delete process.env.C2K_ENV
    process.env.NODE_ENV = 'production'
    assert.equal(isProductionRuntime(), true)

    process.env.NODE_ENV = 'development'
    process.env.C2K_ENV = 'production'
    assert.equal(isProductionRuntime(), true)
  })

  it('allowAuthFallback is always false in production', () => {
    saved = saveEnv()
    process.env.NODE_ENV = 'production'
    delete process.env.AUTH_ALLOW_FALLBACK
    delete process.env.VITE_AUTH_ALLOW_FALLBACK
    assert.equal(allowAuthFallback(), false)

    process.env.AUTH_ALLOW_FALLBACK = 'true'
    assert.equal(allowAuthFallback(), false)
  })

  it('allowAuthFallback defaults on in non-production unless explicitly false', () => {
    saved = saveEnv()
    process.env.NODE_ENV = 'development'
    delete process.env.AUTH_ALLOW_FALLBACK
    delete process.env.VITE_AUTH_ALLOW_FALLBACK
    assert.equal(allowAuthFallback(), true)

    process.env.AUTH_ALLOW_FALLBACK = 'false'
    assert.equal(allowAuthFallback(), false)
  })

  it('isAuthFallbackExplicitlyEnabled only when env is literally true', () => {
    saved = saveEnv()
    process.env.NODE_ENV = 'development'
    delete process.env.AUTH_ALLOW_FALLBACK
    assert.equal(isAuthFallbackExplicitlyEnabled(), false)

    process.env.AUTH_ALLOW_FALLBACK = 'true'
    assert.equal(isAuthFallbackExplicitlyEnabled(), true)

    process.env.AUTH_ALLOW_FALLBACK = 'false'
    assert.equal(isAuthFallbackExplicitlyEnabled(), false)
  })

  // PR 3 (A3/A5): production startup guards.

  function captureExit(run: () => void): number | null {
    const originalExit = process.exit
    let exitCode: number | null = null
    // @ts-expect-error test stub replaces the never-returning exit
    process.exit = (code?: number) => {
      exitCode = code ?? 0
      throw new Error('__exit__')
    }
    try {
      run()
    } catch (err) {
      if (!(err instanceof Error) || err.message !== '__exit__') throw err
    } finally {
      process.exit = originalExit
    }
    return exitCode
  }

  const silentLog = { info: () => {}, error: () => {} }

  it('assertDatabaseConfiguredForStartup refuses production without USE_DATABASE=true', () => {
    saved = saveEnv()
    process.env.NODE_ENV = 'production'
    delete process.env.USE_DATABASE
    assert.equal(captureExit(() => assertDatabaseConfiguredForStartup(silentLog)), 1)

    process.env.USE_DATABASE = 'false'
    assert.equal(captureExit(() => assertDatabaseConfiguredForStartup(silentLog)), 1)

    process.env.USE_DATABASE = 'true'
    assert.equal(captureExit(() => assertDatabaseConfiguredForStartup(silentLog)), null)
  })

  it('assertDatabaseConfiguredForStartup is a no-op outside production', () => {
    saved = saveEnv()
    process.env.NODE_ENV = 'development'
    delete process.env.C2K_ENV
    delete process.env.USE_DATABASE
    assert.equal(captureExit(() => assertDatabaseConfiguredForStartup(silentLog)), null)
  })

  it('assertRateLimitEnabledForStartup refuses production with C2K_RATE_LIMIT_DISABLE=true', () => {
    saved = saveEnv()
    process.env.NODE_ENV = 'production'
    process.env.USE_DATABASE = 'true'
    process.env.C2K_RATE_LIMIT_DISABLE = 'true'
    assert.equal(captureExit(() => assertRateLimitEnabledForStartup(silentLog)), 1)

    delete process.env.C2K_RATE_LIMIT_DISABLE
    assert.equal(captureExit(() => assertRateLimitEnabledForStartup(silentLog)), null)
  })

  it('assertRateLimitEnabledForStartup allows the disable flag outside production', () => {
    saved = saveEnv()
    process.env.NODE_ENV = 'development'
    delete process.env.C2K_ENV
    process.env.C2K_RATE_LIMIT_DISABLE = 'true'
    assert.equal(captureExit(() => assertRateLimitEnabledForStartup(silentLog)), null)
  })

  it('assertCorsOriginForStartup refuses production without a usable CORS_ORIGIN', () => {
    saved = saveEnv()
    process.env.NODE_ENV = 'production'
    delete process.env.CORS_ORIGIN
    assert.equal(captureExit(() => assertCorsOriginForStartup(silentLog)), 1)

    process.env.CORS_ORIGIN = ' , '
    assert.equal(captureExit(() => assertCorsOriginForStartup(silentLog)), 1)

    process.env.CORS_ORIGIN = 'https://kink.social'
    assert.equal(captureExit(() => assertCorsOriginForStartup(silentLog)), null)
  })

  it('assertCorsOriginForStartup is a no-op outside production', () => {
    saved = saveEnv()
    process.env.NODE_ENV = 'development'
    delete process.env.C2K_ENV
    delete process.env.CORS_ORIGIN
    assert.equal(captureExit(() => assertCorsOriginForStartup(silentLog)), null)
  })

  // PR 3 (M8/M9): scanner-weakening overrides refuse strict-runtime startup.

  it('assertMediaScannerSafeForStartup refuses production with noop/simulate overrides', () => {
    saved = saveEnv()
    process.env.NODE_ENV = 'production'
    process.env.MEDIA_SCANNER_ALLOW_NOOP = 'true'
    delete process.env.MEDIA_SCAN_SIMULATE_CLASSIFIER
    assert.equal(captureExit(() => assertMediaScannerSafeForStartup(silentLog)), 1)

    delete process.env.MEDIA_SCANNER_ALLOW_NOOP
    process.env.MEDIA_SCAN_SIMULATE_CLASSIFIER = 'SAFE'
    assert.equal(captureExit(() => assertMediaScannerSafeForStartup(silentLog)), 1)

    delete process.env.MEDIA_SCAN_SIMULATE_CLASSIFIER
    assert.equal(captureExit(() => assertMediaScannerSafeForStartup(silentLog)), null)
  })

  it('assertMediaScannerSafeForStartup also covers staging and allows local overrides', () => {
    saved = saveEnv()
    process.env.NODE_ENV = 'development'
    process.env.C2K_ENV = 'staging'
    process.env.MEDIA_SCANNER_ALLOW_NOOP = 'true'
    assert.equal(captureExit(() => assertMediaScannerSafeForStartup(silentLog)), 1)

    delete process.env.C2K_ENV
    assert.equal(captureExit(() => assertMediaScannerSafeForStartup(silentLog)), null)
  })
})
