import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'
import {
  listForbiddenScannerOverridesForStrictRuntime,
  mediaScanSimulationEnabled,
  mediaScannerAllowNoopEnabled,
  mediaScannerStrictModeEnabled,
  readMediaScannerStartupConfig,
  resolveMalwareScannerMode,
  resolveMediaScannerRuntimeProfile,
} from './media-scanner-config.js'

const ENV_KEYS = [
  'NODE_ENV',
  'C2K_ENV',
  'MEDIA_SCANNER_STRICT_MODE',
  'MEDIA_SCANNER_ALLOW_NOOP',
  'MEDIA_SCANNER_MALWARE',
  'MEDIA_SCAN_SIMULATE',
  'MEDIA_SCAN_SIMULATE_CLASSIFIER',
] as const

const saved: Record<string, string | undefined> = {}

describe('media-scanner-config', () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  })

  test('production defaults strict on and noop off', () => {
    for (const key of ENV_KEYS) saved[key] = process.env[key]
    process.env.NODE_ENV = 'production'
    delete process.env.MEDIA_SCANNER_STRICT_MODE
    delete process.env.MEDIA_SCANNER_ALLOW_NOOP
    assert.equal(resolveMediaScannerRuntimeProfile(), 'production')
    assert.equal(mediaScannerStrictModeEnabled(), true)
    assert.equal(mediaScannerAllowNoopEnabled(), false)
    assert.equal(resolveMalwareScannerMode(), 'clamav')
  })

  test('local defaults allow noop', () => {
    for (const key of ENV_KEYS) saved[key] = process.env[key]
    process.env.NODE_ENV = 'development'
    delete process.env.C2K_ENV
    delete process.env.MEDIA_SCANNER_ALLOW_NOOP
    assert.equal(mediaScannerAllowNoopEnabled(), true)
  })

  test('readMediaScannerStartupConfig surfaces flags', () => {
    const config = readMediaScannerStartupConfig()
    assert.ok('strictMode' in config)
    assert.ok('malwareMode' in config)
  })

  test('M8: production hard-ignores MEDIA_SCANNER_ALLOW_NOOP and noop malware mode', () => {
    for (const key of ENV_KEYS) saved[key] = process.env[key]
    process.env.NODE_ENV = 'production'
    process.env.MEDIA_SCANNER_ALLOW_NOOP = 'true'
    process.env.MEDIA_SCANNER_MALWARE = 'noop'
    assert.equal(mediaScannerAllowNoopEnabled(), false)
    assert.equal(resolveMalwareScannerMode(), 'clamav')
  })

  test('M9: simulation is disabled under production/staging', () => {
    for (const key of ENV_KEYS) saved[key] = process.env[key]
    process.env.NODE_ENV = 'production'
    process.env.MEDIA_SCAN_SIMULATE_CLASSIFIER = 'SAFE'
    assert.equal(mediaScanSimulationEnabled(), false)

    process.env.NODE_ENV = 'development'
    process.env.C2K_ENV = 'staging'
    assert.equal(mediaScanSimulationEnabled(), false)

    delete process.env.C2K_ENV
    assert.equal(mediaScanSimulationEnabled(), true)
  })

  test('M8/M9: forbidden override listing catches weakening env', () => {
    assert.deepEqual(
      listForbiddenScannerOverridesForStrictRuntime({
        MEDIA_SCANNER_ALLOW_NOOP: 'true',
        MEDIA_SCANNER_MALWARE: 'noop',
        MEDIA_SCAN_SIMULATE: 'FLAGGED',
        MEDIA_SCAN_SIMULATE_CLASSIFIER: 'SAFE',
        MEDIA_SCAN_SIMULATE_MALWARE: 'BLOCKED',
      }),
      [
        'MEDIA_SCANNER_ALLOW_NOOP',
        'MEDIA_SCANNER_MALWARE=noop',
        'MEDIA_SCAN_SIMULATE',
        'MEDIA_SCAN_SIMULATE_CLASSIFIER',
        'MEDIA_SCAN_SIMULATE_MALWARE',
      ].sort(),
    )
    // Explicitly disabling the override is not a violation.
    assert.deepEqual(
      listForbiddenScannerOverridesForStrictRuntime({
        MEDIA_SCANNER_ALLOW_NOOP: 'false',
        MEDIA_SCANNER_MALWARE: 'clamav',
      }),
      [],
    )
  })
})
