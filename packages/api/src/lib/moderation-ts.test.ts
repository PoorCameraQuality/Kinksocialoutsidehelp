import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LEGACY_REPORT_CATEGORIES,
  MODERATION_CASE_STATUSES,
  MODERATION_QUEUES,
  POLICY_REASONS,
  POLICY_REASON_VALUES,
  POLICY_SEVERITIES,
  P0_POLICY_REASONS,
  isKnownModerationCaseStatus,
  isKnownModerationQueue,
  isKnownPolicyReason,
  isKnownPolicySeverity,
  isP0PolicyReason,
  mapLegacyReportCategoryToPolicyReason,
  queueForPolicyReason,
  severityForPolicyReason,
} from '@c2k/shared'

test('moderation-ts. Policy reason enum is complete and known', () => {
  assert.equal(POLICY_REASON_VALUES.length, 15)
  for (const reason of POLICY_REASON_VALUES) {
    assert.equal(isKnownPolicyReason(reason), true, `missing type guard for ${reason}`)
  }
  assert.equal(isKnownPolicyReason('NOT_A_REASON'), false)
})

test('moderation-ts. Severity and queue defaults per reason', () => {
  assert.equal(severityForPolicyReason(POLICY_REASONS.csamSuspected), POLICY_SEVERITIES.critical)
  assert.equal(queueForPolicyReason(POLICY_REASONS.csamSuspected), MODERATION_QUEUES.minorSafetyRestricted)
  assert.equal(severityForPolicyReason(POLICY_REASONS.spamScam), POLICY_SEVERITIES.low)
  assert.equal(queueForPolicyReason(POLICY_REASONS.spamScam), MODERATION_QUEUES.spamAbuse)
})

test('moderation-ts · P0 reasons notify slice', () => {
  for (const reason of P0_POLICY_REASONS) {
    assert.equal(isP0PolicyReason(reason), true)
  }
  assert.equal(isP0PolicyReason(POLICY_REASONS.spamScam), false)
  assert.equal(isP0PolicyReason(POLICY_REASONS.harassmentThreats), false)
})

test('moderation-ts. Legacy category mapping', () => {
  const harassment = mapLegacyReportCategoryToPolicyReason(LEGACY_REPORT_CATEGORIES.harassment)
  assert.ok(harassment)
  assert.equal(harassment!.reason, POLICY_REASONS.harassmentThreats)
  assert.equal(harassment!.requiresRetriage, false)

  const illegal = mapLegacyReportCategoryToPolicyReason(LEGACY_REPORT_CATEGORIES.illegal)
  assert.ok(illegal)
  assert.equal(illegal!.reason, POLICY_REASONS.other)
  assert.equal(illegal!.requiresRetriage, true)

  assert.equal(mapLegacyReportCategoryToPolicyReason('unknown_legacy'), null)
})

test('moderation-ts. Case status and queue guards', () => {
  assert.equal(isKnownModerationCaseStatus(MODERATION_CASE_STATUSES.open), true)
  assert.equal(isKnownModerationCaseStatus('OPEN'), true)
  assert.equal(isKnownModerationQueue(MODERATION_QUEUES.appeals), true)
  assert.equal(isKnownPolicySeverity(POLICY_SEVERITIES.high), true)
})
