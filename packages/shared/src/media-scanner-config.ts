/**
 * T&S-4B - production scanner strictness and noop policy.
 * Browser-safe env readers (no Node imports).
 */

export const SCANNER_NOOP_PASSED_LABEL = 'NOOP_PASSED' as const

export type MediaScannerRuntimeProfile = 'production' | 'staging' | 'local' | 'test'

function envFlag(name: string): boolean | undefined {
  const raw = process.env[name]?.trim().toLowerCase()
  if (raw === undefined || raw === '') return undefined
  if (raw === '1' || raw === 'true' || raw === 'yes') return true
  if (raw === '0' || raw === 'false' || raw === 'no') return false
  return undefined
}

export function resolveMediaScannerRuntimeProfile(): MediaScannerRuntimeProfile {
  if (process.env.NODE_ENV === 'test') return 'test'
  if (process.env.C2K_ENV === 'staging' || process.env.NODE_ENV === 'staging') return 'staging'
  if (process.env.NODE_ENV === 'production' || process.env.C2K_ENV === 'production') {
    return 'production'
  }
  return 'local'
}

export function isProductionRuntime(): boolean {
  return resolveMediaScannerRuntimeProfile() === 'production'
}

export function isStagingRuntime(): boolean {
  return resolveMediaScannerRuntimeProfile() === 'staging'
}

export function isStrictScannerRuntime(): boolean {
  const profile = resolveMediaScannerRuntimeProfile()
  return profile === 'production' || profile === 'staging'
}

/** Default true in production and staging. False in local unless overridden. */
export function mediaScannerStrictModeEnabled(): boolean {
  const override = envFlag('MEDIA_SCANNER_STRICT_MODE')
  if (override !== undefined) return override
  return isStrictScannerRuntime()
}

/**
 * False in production and staging. The override is ignored there.
 * True in local and test unless overridden.
 */
export function mediaScannerAllowNoopEnabled(): boolean {
  if (isStrictScannerRuntime()) return false
  const override = envFlag('MEDIA_SCANNER_ALLOW_NOOP')
  if (override !== undefined) return override
  return true
}

/**
 * MEDIA_SCAN_SIMULATE* hooks are test and local only.
 * In production and staging they are no-ops no matter what env says.
 */
export function mediaScanSimulationEnabled(): boolean {
  return !isStrictScannerRuntime()
}

/**
 * Scanner-weakening env vars that must not be set in production or staging.
 * Used by the API startup guard.
 */
export function listForbiddenScannerOverridesForStrictRuntime(
  env: Record<string, string | undefined> = process.env
): string[] {
  const forbidden: string[] = []
  const allowNoop = env.MEDIA_SCANNER_ALLOW_NOOP?.trim().toLowerCase()
  if (allowNoop === '1' || allowNoop === 'true' || allowNoop === 'yes') {
    forbidden.push('MEDIA_SCANNER_ALLOW_NOOP')
  }
  if (env.MEDIA_SCANNER_MALWARE?.trim().toLowerCase() === 'noop') {
    forbidden.push('MEDIA_SCANNER_MALWARE=noop')
  }
  for (const key of Object.keys(env)) {
    if ((key === 'MEDIA_SCAN_SIMULATE' || key.startsWith('MEDIA_SCAN_SIMULATE_')) && env[key]?.trim()) {
      forbidden.push(key)
    }
  }
  return forbidden.sort()
}

export function mediaScannerRequireMalware(): boolean {
  const override = envFlag('MEDIA_SCANNER_REQUIRE_MALWARE')
  if (override !== undefined) return override
  return mediaScannerStrictModeEnabled()
}

export function mediaScannerRequireHash(): boolean {
  const override = envFlag('MEDIA_SCANNER_REQUIRE_HASH')
  if (override !== undefined) return override
  return false
}

export function mediaScannerRequireAdultClassifier(): boolean {
  const override = envFlag('MEDIA_SCANNER_REQUIRE_ADULT_CLASSIFIER')
  if (override !== undefined) return override
  return false
}

export function mediaScannerRequireOcr(): boolean {
  const override = envFlag('MEDIA_SCANNER_REQUIRE_OCR')
  if (override !== undefined) return override
  return false
}

/** Legacy malware mode string - `clamav` when strict, else `auto`. */
export function resolveMalwareScannerMode(): 'auto' | 'noop' | 'clamav' {
  const legacy = process.env.MEDIA_SCANNER_MALWARE?.toLowerCase()
  if (legacy === 'noop' || legacy === 'clamav' || legacy === 'auto') {
    if (legacy === 'noop' && !mediaScannerAllowNoopEnabled() && isStrictScannerRuntime()) {
      return 'clamav'
    }
    return legacy
  }
  if (!mediaScannerAllowNoopEnabled() && isStrictScannerRuntime()) return 'clamav'
  return 'auto'
}

export type MediaScannerStartupConfig = {
  runtimeProfile: MediaScannerRuntimeProfile
  strictMode: boolean
  allowNoop: boolean
  requireMalware: boolean
  requireHash: boolean
  requireAdultClassifier: boolean
  requireOcr: boolean
  malwareMode: 'auto' | 'noop' | 'clamav'
}

export function readMediaScannerStartupConfig(): MediaScannerStartupConfig {
  return {
    runtimeProfile: resolveMediaScannerRuntimeProfile(),
    strictMode: mediaScannerStrictModeEnabled(),
    allowNoop: mediaScannerAllowNoopEnabled(),
    requireMalware: mediaScannerRequireMalware(),
    requireHash: mediaScannerRequireHash(),
    requireAdultClassifier: mediaScannerRequireAdultClassifier(),
    requireOcr: mediaScannerRequireOcr(),
    malwareMode: resolveMalwareScannerMode(),
  }
}
