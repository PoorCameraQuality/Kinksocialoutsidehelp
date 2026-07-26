import { z } from 'zod'

/** Required policy bundle version at signup - bump when terms/community rules change materially. */
export const CURRENT_POLICY_VERSION = '2026-06-01-v1'

export const AGE_VERIFICATION_STATUSES = {
  unverified: 'UNVERIFIED',
  selfAttested: 'SELF_ATTESTED',
  verified: 'VERIFIED',
  rejected: 'REJECTED',
} as const

export type AgeVerificationStatus =
  (typeof AGE_VERIFICATION_STATUSES)[keyof typeof AGE_VERIFICATION_STATUSES]

export const ageVerificationStatusSchema = z.enum([
  AGE_VERIFICATION_STATUSES.unverified,
  AGE_VERIFICATION_STATUSES.selfAttested,
  AGE_VERIFICATION_STATUSES.verified,
  AGE_VERIFICATION_STATUSES.rejected,
])
