/**
 * T&S-4B - legal-profile media policy mode (platform-wide explicit upload gate).
 */

import { z } from 'zod'
import { isExplicitMediaAllowed } from './content-policy.js'

export const MEDIA_POLICY_MODES = {
  communityOnly: 'community_only',
  attestedExplicitBeta: 'attested_explicit_beta',
  explicitEnabled: 'explicit_enabled',
} as const

export type MediaPolicyMode = (typeof MEDIA_POLICY_MODES)[keyof typeof MEDIA_POLICY_MODES]

export const MEDIA_POLICY_MODE_VALUES: readonly MediaPolicyMode[] = Object.values(MEDIA_POLICY_MODES)

export const mediaPolicyModeSchema = z.enum([
  MEDIA_POLICY_MODES.communityOnly,
  MEDIA_POLICY_MODES.attestedExplicitBeta,
  MEDIA_POLICY_MODES.explicitEnabled,
])

function envPolicyMode(): MediaPolicyMode | undefined {
  const raw = process.env.MEDIA_POLICY_MODE?.trim().toLowerCase()
  if (!raw) return undefined
  const parsed = mediaPolicyModeSchema.safeParse(raw)
  return parsed.success ? parsed.data : undefined
}

/** Effective mode - explicit_enabled treated as attested_explicit_beta for upload gates. */
export function resolveMediaPolicyMode(): MediaPolicyMode {
  const override = envPolicyMode()
  if (override) return override
  if (process.env.NODE_ENV === 'production' || process.env.C2K_ENV === 'production') {
    return MEDIA_POLICY_MODES.communityOnly
  }
  if (process.env.C2K_ENV === 'staging' || process.env.NODE_ENV === 'staging') {
    return MEDIA_POLICY_MODES.attestedExplicitBeta
  }
  return MEDIA_POLICY_MODES.attestedExplicitBeta
}

/** Upload/attestation gate - requires ALLOW_EXPLICIT_MEDIA plus attested beta mode. */
export function explicitUploadAllowedInPolicyMode(mode: MediaPolicyMode = resolveMediaPolicyMode()): boolean {
  if (!isExplicitMediaAllowed()) return false
  return (
    mode === MEDIA_POLICY_MODES.attestedExplicitBeta || mode === MEDIA_POLICY_MODES.explicitEnabled
  )
}

export const MEDIA_POLICY_BLOCK_MESSAGES = {
  explicitUpload:
    'Explicit sexual media uploads are not supported on this platform at this time.',
  explicitAttestation:
    'Explicit sexual media uploads are not supported on this platform at this time.',
} as const

export type MediaPolicyAdminSnapshot = {
  mode: MediaPolicyMode
  effectiveExplicitGate: 'blocked' | 'attested_beta'
  source: 'env'
}

export function readMediaPolicyAdminSnapshot(): MediaPolicyAdminSnapshot {
  const mode = resolveMediaPolicyMode()
  return {
    mode,
    effectiveExplicitGate: explicitUploadAllowedInPolicyMode(mode) ? 'attested_beta' : 'blocked',
    source: 'env',
  }
}
