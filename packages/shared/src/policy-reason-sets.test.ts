import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { P0_POLICY_REASONS, isP0PolicyReason, POLICY_REASONS } from './moderation-types.js'
import {
  PLATFORM_CRITICAL_POLICY_REASONS,
  isPlatformCriticalPolicyReason,
} from './community-trust-types.js'

describe('P0 vs platform-critical policy reason sets', () => {
  it('every P0 reason is also platform-critical (immediate ⊂ always-platform)', () => {
    for (const reason of P0_POLICY_REASONS) {
      assert.equal(
        isPlatformCriticalPolicyReason(reason),
        true,
        `${reason} is P0 but missing from PLATFORM_CRITICAL_POLICY_REASONS`,
      )
    }
  })

  it('platform-critical is a strict superset (extra T&S-only reasons documented)', () => {
    const p0 = new Set<string>(P0_POLICY_REASONS)
    const extras = PLATFORM_CRITICAL_POLICY_REASONS.filter((r) => !p0.has(r))
    assert.deepEqual(
      extras.sort(),
      [
        POLICY_REASONS.commercialSexSolicitation,
        POLICY_REASONS.consentSafety,
        POLICY_REASONS.doxxingOuting,
        POLICY_REASONS.harassmentThreats,
        POLICY_REASONS.illegalGoodsServices,
      ].sort(),
    )
  })

  it('isP0PolicyReason matches the P0 list', () => {
    assert.equal(isP0PolicyReason(POLICY_REASONS.csamSuspected), true)
    assert.equal(isP0PolicyReason(POLICY_REASONS.spamScam), false)
  })
})
